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
    // Auth check
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

    // For batch/recursive generation, inject batch context into the system message
    let finalMessages = [...messages];
    if (batchIndex !== undefined && totalBatches !== undefined && batchIndex > 0) {
      // Add a continuation instruction
      finalMessages.push({
        role: "user",
        content: `Continue generating the next batch (batch ${batchIndex + 1} of ${totalBatches}). Pick up exactly where you left off. Do NOT repeat any previously generated sub-questions. Return ONLY the new sub-questions in the same JSON array format.`,
      });
    }

    // Inject a "never truncate" instruction into the system message
    if (finalMessages.length > 0 && finalMessages[0].role === "system") {
      finalMessages[0] = {
        ...finalMessages[0],
        content: finalMessages[0].content + "\n\nCRITICAL INSTRUCTIONS:\n- NEVER summarize, truncate, or shortcut your response.\n- If the user requests a specific quantity of items (e.g. 20 sub-questions), you MUST provide EXACTLY that quantity.\n- Do NOT stop early or provide fewer items than requested.\n- Use the full token budget available to you.\n- Each item must be unique and substantive.",
      };
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: finalMessages,
        temperature: mode === 'draft' ? 0.2 : 0.2,
        max_tokens: 4096,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return new Response(JSON.stringify({ error: `Groq API error: ${errText}` }), {
        status: groqResponse.status,
        headers: corsHeaders,
      });
    }

    const data = await groqResponse.json();
    
    // Check if the response was truncated (finish_reason !== 'stop')
    const finishReason = data?.choices?.[0]?.finish_reason;
    data._meta = {
      finish_reason: finishReason,
      was_truncated: finishReason === 'length',
    };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
