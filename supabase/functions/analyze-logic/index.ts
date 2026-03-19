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

    const { mode, analysisContext } = await req.json();
    // mode: "analyze" | "stress_test" | "improve" | "suggest_povs" | "strengthen_assumptions" | "suggest_evidence" | "find_sources"

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "analyze") {
      systemPrompt = `You are a reasoning quality analyzer. Evaluate the reasoning structure and return ONLY a valid JSON object.

Analyze:
1. Evidence Strength (0-25): Are conclusions supported by facts? Are there enough information blocks?
2. Assumption Reliability (0-25): Are assumptions justified? Any logical leaps?
3. Logical Consistency (0-25): Do reasoning chains make sense? Any contradictions?
4. Completeness (0-25): Missing facts, sub-questions, POVs?

Return this exact JSON structure:
{
  "score": <0-100>,
  "categories": {
    "evidence_strength": {"score": <0-25>, "status": "strong|needs_improvement|problem", "details": "string"},
    "assumption_reliability": {"score": <0-25>, "status": "strong|needs_improvement|problem", "details": "string"},
    "logical_consistency": {"score": <0-25>, "status": "strong|needs_improvement|problem", "details": "string"},
    "completeness": {"score": <0-25>, "status": "strong|needs_improvement|problem", "details": "string"}
  },
  "suggestions": ["string - actionable improvement suggestions, max 5"],
  "reasoning_summary": "string - brief overall assessment"
}`;
      userPrompt = `Analyze this reasoning structure:\n\n${analysisContext}`;
    } else if (mode === "stress_test") {
      systemPrompt = `You are a reasoning stress tester. Generate counter-arguments and identify vulnerabilities. Return ONLY valid JSON.

For each conclusion, generate counter-arguments from alternative POVs (ethical, economic, social, personal).

Return:
{
  "vulnerabilities": [
    {
      "target": "string - which conclusion/assumption is targeted",
      "counter_argument": "string - the counter-argument",
      "severity": "strong|needs_review|weak",
      "pov": "string - from which perspective",
      "suggestion": "string - how to strengthen"
    }
  ],
  "resilience_score": <0-100>,
  "overall_assessment": "string"
}`;
      userPrompt = `Stress test this reasoning:\n\n${analysisContext}`;
    } else if (mode === "improve") {
      systemPrompt = `You are a reasoning improvement assistant. Suggest specific improvements to strengthen the argument. Return ONLY valid JSON.

Return:
{
  "improvements": [
    {"area": "string", "current_issue": "string", "suggestion": "string", "priority": "high|medium|low"}
  ]
}`;
      userPrompt = `Suggest improvements for:\n\n${analysisContext}`;
    } else if (mode === "suggest_povs") {
      systemPrompt = `You are a perspective analyst. Suggest additional points of view that are missing from the analysis. Return ONLY valid JSON.

Return:
{
  "suggested_povs": [
    {"category": "individual|group|ideas_disciplines", "label": "string", "rationale": "string", "sample_question": "string"}
  ]
}`;
      userPrompt = `Suggest missing POVs for:\n\n${analysisContext}`;
    } else if (mode === "strengthen_assumptions") {
      systemPrompt = `You are an assumption analyst. Identify weak assumptions and suggest how to strengthen them. Return ONLY valid JSON.

Return:
{
  "weak_assumptions": [
    {"assumption": "string", "issue": "string", "suggestion": "string", "severity": "high|medium|low"}
  ]
}`;
      userPrompt = `Analyze assumptions in:\n\n${analysisContext}`;
    } else if (mode === "suggest_evidence") {
      systemPrompt = `You are a research assistant. Suggest additional evidence and facts to strengthen the reasoning. Return ONLY valid JSON.

Return:
{
  "suggested_evidence": [
    {"fact": "string", "evidence_strength": "very_strong|strong|moderate", "rationale": "string", "source_type": "string"}
  ]
}`;
      userPrompt = `Suggest evidence for:\n\n${analysisContext}`;
    } else if (mode === "find_sources") {
      systemPrompt = `You are an academic research assistant. Suggest credible sources that could support the given fact. Return ONLY valid JSON.

Return:
{
  "suggested_sources": [
    {"title": "string - source title", "type": "string - e.g. academic paper, government report, etc.", "description": "string - brief description of relevance", "search_query": "string - suggested search query to find this"}
  ]
}`;
      userPrompt = `Suggest credible sources for this fact:\n\n${analysisContext}`;
    } else if (mode === "rate_evidence") {
      systemPrompt = `You are a fair and calibrated evidence quality evaluator for academic reasoning. Rate each claim honestly based on what is actually stated. Do NOT default to any single rating — use the full range appropriately.

Rating criteria:
- "very_strong": Contains specific, verifiable data points — cites peer-reviewed research, government statistics, direct measurements, or named institutional reports with numbers or dates.
- "strong": Makes a specific, factual claim that is widely accepted or references reputable sources, even if not formally cited. Contains concrete details (names, numbers, dates, places).
- "moderate": A reasonable, plausible claim that has some factual basis but lacks specifics. Could be verified but isn't cited. General knowledge claims fall here.
- "weak": Vague, overgeneralized, anecdotal, or opinion-presented-as-fact. Uses hedging language like "some say" or "studies show" without specifics.
- "unsupported": Pure opinion, speculation, or demonstrably false. No factual basis whatsoever.

Evaluate each fact INDEPENDENTLY based on its own content. Two similar-sounding facts can have different ratings if one is more specific than the other.

Return ONLY valid JSON:
{
  "ratings": [
    {"index": 0, "rating": "very_strong|strong|moderate|weak|unsupported", "reason": "string - brief explanation of why this specific rating"}
  ]
}`;
      userPrompt = `Rate the evidence strength of these facts:\n\n${analysisContext}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400, headers: corsHeaders });
    }

    const maxRetries = 5;
    let groqResponse: Response | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: (mode === "analyze" || mode === "stress_test") ? 2048 : 4096,
        }),
      });

      if (groqResponse.status === 429) {
        const errBody = await groqResponse.text();
        const retryMatch = errBody.match(/try again in (\d+\.?\d*)s/);
        const waitSecs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : (attempt + 1) * 15;
        console.log(`Rate limited, waiting ${waitSecs}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        continue;
      }

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        return new Response(JSON.stringify({ error: `AI error: ${errText}` }), { status: groqResponse.status, headers: corsHeaders });
      }
      break;
    }

    if (!groqResponse || !groqResponse.ok) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait and try again.' }), { status: 429, headers: corsHeaders });
    }

    const data = await groqResponse.json();
    const content = data?.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response, with repair for common LLM mistakes
    function tryParseJSON(str: string): any {
      try { return JSON.parse(str); } catch { return null; }
    }

    function repairAndParse(str: string): any {
      let result = tryParseJSON(str);
      if (result) return result;

      // Fix trailing commas
      let cleaned = str.replace(/,\s*([}\]])/g, '$1');
      result = tryParseJSON(cleaned);
      if (result) return result;

      // Try replacing each ] with } one at a time to find the broken one
      const opens = (str.match(/\{/g) || []).length;
      const closes = (str.match(/\}/g) || []).length;
      if (opens > closes) {
        const diff = opens - closes;
        // Find all ] positions and try replacing combinations
        const positions: number[] = [];
        for (let i = 0; i < str.length; i++) {
          if (str[i] === ']') positions.push(i);
        }
        // Try replacing each single ] with } 
        for (const pos of positions) {
          let s = str.substring(0, pos) + '}' + str.substring(pos + 1);
          result = tryParseJSON(s);
          if (result) return result;
          // Also try with trailing comma fix
          result = tryParseJSON(s.replace(/,\s*([}\]])/g, '$1'));
          if (result) return result;
        }
        // Try replacing from innermost positions (more likely to be the error)
        if (diff <= positions.length) {
          for (let i = 0; i <= positions.length - diff; i++) {
            let s = str;
            for (let j = 0; j < diff; j++) {
              const p = positions[i + j] + j * 0; // positions don't shift since same length
              s = s.substring(0, positions[i + j]) + '}' + s.substring(positions[i + j] + 1);
            }
            result = tryParseJSON(s);
            if (result) return result;
          }
        }
      }

      return null;
    }

    let jsonText = content;
    // Extract from code fences if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let parsed = repairAndParse(jsonText);

    if (!parsed && jsonText !== content) {
      // Try the raw content too
      parsed = repairAndParse(content);
    }

    if (!parsed) {
      // Last resort: find JSON object in text
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = repairAndParse(objMatch[0]);
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: content }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
