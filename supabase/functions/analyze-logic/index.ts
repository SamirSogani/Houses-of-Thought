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
      systemPrompt = `You are a strict evidence quality evaluator for academic reasoning. Rate the strength of evidence claims HONESTLY and HARSHLY. Most casual claims without citations are "weak" or "unsupported". Be fair but demanding.

Rating criteria:
- "very_strong": Backed by peer-reviewed research, verified data, direct measurements, or government statistics. Extremely rare for unsubstantiated claims.
- "strong": Well-sourced from reputable institutions, strong statistical backing, expert consensus. Requires clear specificity.
- "moderate": Reasonable claim with some basis but lacks specific evidence or citations. Partially supported.
- "weak": Anecdotal, vague, overgeneralized, or opinion-based. No specific data cited.
- "unsupported": No evidence whatsoever, purely speculative, or demonstrably false.

IMPORTANT: Default to "weak" or "unsupported" unless the claim contains specific, verifiable information. Vague statements like "studies show" without specifics are "weak". Personal opinions are "unsupported".

Return ONLY valid JSON:
{
  "ratings": [
    {"index": 0, "rating": "very_strong|strong|moderate|weak|unsupported", "reason": "string - brief explanation"}
  ]
}`;
      userPrompt = `Rate the evidence strength of these facts:\n\n${analysisContext}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400, headers: corsHeaders });
    }

    const maxRetries = 3;
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
          max_tokens: 4096,
        }),
      });

      if (groqResponse.status === 429) {
        const errBody = await groqResponse.text();
        const retryMatch = errBody.match(/try again in (\d+\.?\d*)s/);
        const waitSecs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 1 : (attempt + 1) * 10;
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
      // Try as-is first
      let result = tryParseJSON(str);
      if (result) return result;

      // Common LLM mistakes: mismatched brackets
      // Fix "] where it should be "} by counting brace depth
      let repaired = str;
      // Replace common pattern: ..."}] should be ..."}}}
      // Strategy: try multiple bracket fixes
      const fixes = [
        // Fix: closing ] used instead of } 
        () => {
          let s = str;
          // Balance braces: count { and } and [ and ]
          const opens = (s.match(/\{/g) || []).length;
          const closes = (s.match(/\}/g) || []).length;
          const openBrackets = (s.match(/\[/g) || []).length;
          const closeBrackets = (s.match(/\]/g) || []).length;
          
          if (opens > closes && closeBrackets > openBrackets) {
            // Replace excess ] with } from the end
            let diff = opens - closes;
            for (let i = 0; i < diff; i++) {
              const lastBracket = s.lastIndexOf(']');
              if (lastBracket >= 0) {
                s = s.substring(0, lastBracket) + '}' + s.substring(lastBracket + 1);
              }
            }
          }
          return s;
        },
        // Fix trailing commas before } or ]
        () => str.replace(/,\s*([}\]])/g, '$1'),
      ];

      for (const fix of fixes) {
        const fixed = fix();
        result = tryParseJSON(fixed);
        if (result) return result;
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
