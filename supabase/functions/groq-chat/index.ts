const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), { status: 500, headers: corsHeaders });
    }

    const { messages, mode, batchIndex, totalBatches } = await req.json();

    // Strip non-standard properties (like 'action') that Groq rejects
    let finalMessages = messages.map((m: any) => ({ role: m.role, content: m.content }));

    // Truncate message history to avoid exceeding Groq's token limits
    // Keep system message + last few messages, trim middle if too long
    const MAX_CHARS = 24000; // ~6K tokens, safe for 12K TPM
    let totalChars = finalMessages.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);
    while (totalChars > MAX_CHARS && finalMessages.length > 2) {
      // Remove the second message (keep system prompt at index 0 and latest messages)
      const removed = finalMessages.splice(1, 1);
      totalChars -= removed[0]?.content?.length || 0;
    }

    if (batchIndex !== undefined && totalBatches !== undefined && batchIndex > 0) {
      finalMessages.push({
        role: "user",
        content: `Continue generating the next batch (batch ${batchIndex + 1} of ${totalBatches}). Pick up exactly where you left off. Do NOT repeat any previously generated sub-questions. Return ONLY the new sub-questions in the same JSON array format.`,
      });
    }

    // Inject strict instructions into system message
    if (finalMessages.length > 0 && finalMessages[0].role === "system") {
      finalMessages[0] = {
        ...finalMessages[0],
        content: finalMessages[0].content + `\n\nCRITICAL INSTRUCTIONS:
- NEVER summarize, truncate, or shortcut your response.
- If the user requests a specific quantity of items (e.g. 20 sub-questions), you MUST provide EXACTLY that quantity.
- Do NOT stop early or provide fewer items than requested.
- Use the full token budget available to you.
- Each item must be unique and substantive.

ACTION MODE INSTRUCTIONS:
When the user asks you to directly edit/update/change/fix any part of the House of Thought (Purpose, Sub-purposes, Overarching Question, Consequences, Sub-questions, Overarching Conclusion), you MUST respond with a JSON action block.

For analysis field updates, respond with:
{"action":"update_analysis","fields":{"purpose":"...","sub_purposes":"...","overarching_question":"...","consequences":"...","overarching_conclusion":"..."},"explanation":"Brief explanation of what you changed"}

Only include fields that need changing. For sub-question operations:
{"action":"update_sub_questions","operations":[{"op":"add","question":"...","pov_category":"individual|group|ideas_disciplines","information":"...","sub_conclusion":"..."},{"op":"update","id":"<sub_question_id>","question":"...","information":"...","sub_conclusion":"..."},{"op":"delete","id":"<sub_question_id>"}],"explanation":"Brief explanation"}

If the user is NOT asking for a direct edit, respond normally with text. Only use action blocks when the user explicitly wants to change House data.
IMPORTANT: Always wrap action responses in \`\`\`json code fences.`,
      };
    }

    const maxRetries = 5;
    let groqResponse: Response | null = null;
    let lastRateLimitBody = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: finalMessages,
          temperature: mode === 'draft' ? 0.2 : 0.3,
          max_tokens: 8192,
        }),
      });

      if (groqResponse.status === 429) {
        lastRateLimitBody = await groqResponse.text();
        const retryMatch = lastRateLimitBody.match(/try again in (\d+\.?\d*)s/);
        const waitSecs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : Math.min(90, 15 + attempt * 10);
        console.log(`Rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${waitSecs}s...`);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        continue;
      }

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        return new Response(JSON.stringify({ error: `Groq API error: ${errText}` }), {
          status: groqResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      break;
    }

    if (!groqResponse || !groqResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Groq API rate limit exceeded after retries. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
        retryable: true,
        provider: 'groq',
        details: lastRateLimitBody,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await groqResponse.json();
    const finishReason = data?.choices?.[0]?.finish_reason;
    data._meta = {
      finish_reason: finishReason,
      was_truncated: finishReason === 'length',
    };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders });
  }
});
