const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Per-user rate limiting: max 10 requests per 60 seconds
const userRateMap = new Map<string, { count: number; resetAt: number }>();
const USER_RATE_LIMIT = 10;
const USER_RATE_WINDOW_MS = 60 * 1000;

function isUserRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = userRateMap.get(userId);
  if (!entry || now > entry.resetAt) {
    userRateMap.set(userId, { count: 1, resetAt: now + USER_RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > USER_RATE_LIMIT;
}

// ─── Provider State Tracking (same pattern as ai-router) ─
interface ProviderState {
  name: string;
  score: number;
  errorCount: number;
  successCount: number;
  cooldownUntil: number;
  consecutiveErrors: number;
  totalLatencyMs: number;
}

const providerStates: Record<string, ProviderState> = {
  gemini: { name: 'gemini', score: 80, errorCount: 0, successCount: 0, cooldownUntil: 0, consecutiveErrors: 0, totalLatencyMs: 0 },
  groq: { name: 'groq', score: 75, errorCount: 0, successCount: 0, cooldownUntil: 0, consecutiveErrors: 0, totalLatencyMs: 0 },
};

function recordSuccess(name: string, latencyMs: number) {
  const p = providerStates[name];
  if (!p) return;
  p.successCount++;
  p.totalLatencyMs += latencyMs;
  p.consecutiveErrors = 0;
  p.score = Math.min(100, p.score + 2);
}

function recordError(name: string, cooldownSecs = 30) {
  const p = providerStates[name];
  if (!p) return;
  p.errorCount++;
  p.consecutiveErrors++;
  p.cooldownUntil = Date.now() + cooldownSecs * 1000;
  p.score = Math.max(-50, p.score - 15);
}

function getProviderOrder(): string[] {
  return Object.values(providerStates)
    .filter(p => Date.now() >= p.cooldownUntil)
    .sort((a, b) => b.score - a.score)
    .map(p => p.name);
}

async function callProvider(name: string, messages: any[], temperature: number, maxTokens: number): Promise<Response> {
  if (name === 'gemini') {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY not configured');
    return await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-2.5-flash', messages, temperature, max_tokens: maxTokens }),
    });
  } else {
    const key = Deno.env.get('GROQ_API_KEY');
    if (!key) throw new Error('GROQ_API_KEY not configured');
    // Truncate for Groq
    let truncated = [...messages];
    const MAX_CHARS = 24000;
    let total = truncated.reduce((s, m) => s + (m.content?.length || 0), 0);
    while (total > MAX_CHARS && truncated.length > 2) {
      const removed = truncated.splice(1, 1);
      total -= removed[0]?.content?.length || 0;
    }
    return await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: truncated, temperature, max_tokens: Math.min(maxTokens, 8192) }),
    });
  }
}

async function routedCall(messages: any[], temperature: number, maxTokens: number): Promise<{ data: any; provider: string }> {
  const order = getProviderOrder();
  if (order.length === 0) throw { status: 503, message: 'All AI providers temporarily unavailable' };

  for (const name of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const start = Date.now();
        const resp = await callProvider(name, messages, temperature, maxTokens);
        const latency = Date.now() - start;

        if (resp.status === 429) {
          const txt = await resp.text();
          const m = txt.match(/try again in (\d+\.?\d*)s/);
          recordError(name, m ? Math.ceil(parseFloat(m[1])) + 5 : 60);
          break;
        }
        if (!resp.ok) {
          await resp.text();
          recordError(name, 30);
          if (attempt === 0) continue;
          break;
        }

        const data = await resp.json();
        if (!data?.choices?.[0]?.message?.content) {
          recordError(name, 10);
          if (attempt === 0) continue;
          break;
        }

        recordSuccess(name, latency);
        console.log(`[analyze-logic] Served by ${name} in ${latency}ms`);
        return { data, provider: name };
      } catch (err: any) {
        if (err.status) throw err;
        recordError(name, 30);
        if (attempt === 0) continue;
        break;
      }
    }
  }
  throw { status: 503, message: 'All AI providers failed' };
}

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

    const userId = (claimsData.claims as any).sub;
    if (isUserRateLimited(userId)) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment before trying again.', code: 'RATE_LIMITED', retryable: true }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { mode, analysisContext } = await req.json();

    if (!analysisContext || typeof analysisContext !== 'string' || analysisContext.length > 20000) {
      return new Response(JSON.stringify({ error: 'Invalid or oversized analysisContext (max 20000 chars)' }), { status: 400, headers: corsHeaders });
    }

    const validModes = ['analyze', 'stress_test', 'improve', 'suggest_povs', 'strengthen_assumptions', 'suggest_evidence', 'find_sources', 'rate_evidence'];
    if (!mode || !validModes.includes(mode)) {
      return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400, headers: corsHeaders });
    }

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
      systemPrompt = `You are an academic research assistant. Suggest credible sources that could support the given fact. For each source, provide an MLA 9 formatted citation. Return ONLY valid JSON.

Return:
{
  "suggested_sources": [
    {"title": "string - source title", "type": "string - e.g. academic paper, government report, etc.", "description": "string - brief description of relevance", "search_query": "string - suggested search query to find this", "url": "string - URL if known, or empty string", "mlaCitation": "string - full MLA 9 citation, e.g. Author Last, First. \"Article Title.\" Site/Journal Name, Publisher, Day Month Year, URL."}
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

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const maxTokens = (mode === "analyze" || mode === "stress_test") ? 4096 : 4096;
    const { data, provider } = await routedCall(messages, 0.3, maxTokens);

    const content = data?.choices?.[0]?.message?.content || "";

    // Robust JSON extraction and repair
    function tryParseJSON(str: string): any {
      try { return JSON.parse(str); } catch { return null; }
    }

    function repairAndParse(str: string): any {
      // Remove control characters
      let s = str.replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\t' ? c : '');
      
      let result = tryParseJSON(s);
      if (result) return result;

      // Fix trailing commas
      s = s.replace(/,\s*([}\]])/g, '$1');
      result = tryParseJSON(s);
      if (result) return result;

      // Try to fix truncated JSON by closing open brackets/braces
      const openBraces = (s.match(/\{/g) || []).length;
      const closeBraces = (s.match(/\}/g) || []).length;
      const openBrackets = (s.match(/\[/g) || []).length;
      const closeBrackets = (s.match(/\]/g) || []).length;

      if (openBraces > closeBraces || openBrackets > closeBrackets) {
        // Truncated response — try to close it
        let fixed = s.replace(/,\s*$/, ''); // remove trailing comma
        // Remove any incomplete key-value pair at the end
        fixed = fixed.replace(/,?\s*"[^"]*":\s*"?[^"{}[\]]*$/, '');
        fixed = fixed.replace(/,?\s*"[^"]*":\s*$/, '');
        // Close remaining brackets/braces
        for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
        result = tryParseJSON(fixed);
        if (result) return result;
        // Also try with trailing comma cleanup
        result = tryParseJSON(fixed.replace(/,\s*([}\]])/g, '$1'));
        if (result) return result;
      }

      return null;
    }

    // Extract JSON from markdown code blocks or raw content
    let jsonText = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    } else {
      // Also handle unclosed code blocks (truncated responses)
      const unclosedMatch = content.match(/```(?:json)?\s*([\s\S]*)/);
      if (unclosedMatch) {
        jsonText = unclosedMatch[1].trim();
      }
    }

    let parsed = repairAndParse(jsonText);

    if (!parsed && jsonText !== content) {
      parsed = repairAndParse(content);
    }

    if (!parsed) {
      const objMatch = content.match(/\{[\s\S]*\}?/);
      if (objMatch) {
        parsed = repairAndParse(objMatch[0]);
      }
    }

    if (!parsed) {
      console.error('Failed to parse AI response:', content.substring(0, 1000));
      return new Response(JSON.stringify({ error: 'Failed to parse AI response. Please try again.' }), { status: 500, headers: corsHeaders });
    }

    // Add routing metadata
    parsed._routing = { provider };

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Unhandled error:', err);
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || 'Internal server error', retryable: status === 429 }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
