const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Per-user rate limiting ─────────────────────────────
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

// ─── Provider State Tracking ────────────────────────────
interface ProviderState {
  name: string;
  baseScore: number;
  score: number;
  requestCount: number;
  errorCount: number;
  successCount: number;
  totalLatencyMs: number;
  lastErrorAt: number;
  cooldownUntil: number;
  consecutiveErrors: number;
}

const providerStates: Record<string, ProviderState> = {
  gemini: {
    name: 'gemini',
    baseScore: 80,
    score: 80,
    requestCount: 0,
    errorCount: 0,
    successCount: 0,
    totalLatencyMs: 0,
    lastErrorAt: 0,
    cooldownUntil: 0,
    consecutiveErrors: 0,
  },
  groq: {
    name: 'groq',
    baseScore: 75,
    score: 75,
    requestCount: 0,
    errorCount: 0,
    successCount: 0,
    totalLatencyMs: 0,
    lastErrorAt: 0,
    cooldownUntil: 0,
    consecutiveErrors: 0,
  },
};

function recalcScore(p: ProviderState): number {
  const now = Date.now();
  let score = p.baseScore;

  // Cooldown penalty
  if (now < p.cooldownUntil) {
    score -= 100; // effectively disabled
  }

  // Success rate bonus/penalty
  const total = p.successCount + p.errorCount;
  if (total > 0) {
    const successRate = p.successCount / total;
    score += (successRate - 0.5) * 20; // -10 to +10
  }

  // Latency bonus (lower is better)
  if (p.successCount > 0) {
    const avgLatency = p.totalLatencyMs / p.successCount;
    if (avgLatency < 2000) score += 5;
    else if (avgLatency > 10000) score -= 10;
  }

  // Consecutive error penalty
  score -= p.consecutiveErrors * 15;

  // Recent error decay (recover after 60s)
  if (p.lastErrorAt > 0) {
    const secsSinceError = (now - p.lastErrorAt) / 1000;
    if (secsSinceError < 30) score -= 10;
    else if (secsSinceError > 120) score += 5; // recovered
  }

  p.score = Math.max(-50, Math.min(100, score));
  return p.score;
}

function recordSuccess(name: string, latencyMs: number) {
  const p = providerStates[name];
  if (!p) return;
  p.requestCount++;
  p.successCount++;
  p.totalLatencyMs += latencyMs;
  p.consecutiveErrors = 0;
  recalcScore(p);
}

function recordError(name: string, cooldownSecs = 30) {
  const p = providerStates[name];
  if (!p) return;
  p.requestCount++;
  p.errorCount++;
  p.consecutiveErrors++;
  p.lastErrorAt = Date.now();
  p.cooldownUntil = Date.now() + cooldownSecs * 1000;
  recalcScore(p);
}

function selectProvider(preferredFor?: string): string[] {
  // Recalc all scores
  for (const p of Object.values(providerStates)) recalcScore(p);

  // For draft mode, prefer gemini (higher token limits, better for long-form)
  const providers = Object.values(providerStates)
    .filter(p => Date.now() >= p.cooldownUntil || p.score > -50)
    .sort((a, b) => {
      let aScore = a.score;
      let bScore = b.score;
      // Boost preferred provider for specific modes
      if (preferredFor === 'draft' && a.name === 'gemini') aScore += 15;
      if (preferredFor === 'draft' && b.name === 'gemini') bScore += 15;
      return bScore - aScore;
    });

  return providers.map(p => p.name);
}

// ─── Provider API Calls ─────────────────────────────────

interface AIRequest {
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  maxTokens: number;
}

async function callGemini(req: AIRequest): Promise<Response> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');

  return await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${geminiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    }),
  });
}

async function callGroq(req: AIRequest): Promise<Response> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) throw new Error('GROQ_API_KEY not configured');

  // Truncate for Groq's lower token limits
  let finalMessages = [...req.messages];
  const MAX_CHARS = 24000;
  let totalChars = finalMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  while (totalChars > MAX_CHARS && finalMessages.length > 2) {
    const removed = finalMessages.splice(1, 1);
    totalChars -= removed[0]?.content?.length || 0;
  }

  return await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: finalMessages,
      temperature: req.temperature,
      max_tokens: Math.min(req.maxTokens, 8192),
    }),
  });
}

const providerCallFns: Record<string, (req: AIRequest) => Promise<Response>> = {
  gemini: callGemini,
  groq: callGroq,
};

// ─── Unified call with routing + fallback ───────────────

async function routedAICall(
  messages: Array<{ role: string; content: string }>,
  mode: string,
  temperature: number,
  maxTokens: number,
): Promise<{ data: any; provider: string }> {
  const preferredFor = (mode === 'draft') ? 'draft' : undefined;
  const providerOrder = selectProvider(preferredFor);

  if (providerOrder.length === 0) {
    throw { status: 503, message: 'All AI providers are temporarily unavailable. Please try again in a moment.' };
  }

  const aiReq: AIRequest = { messages, temperature, maxTokens };

  for (const providerName of providerOrder) {
    const callFn = providerCallFns[providerName];
    if (!callFn) continue;

    // Try up to 2 attempts per provider
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const startMs = Date.now();
        const response = await callFn(aiReq);
        const latencyMs = Date.now() - startMs;

        if (response.status === 429) {
          const errText = await response.text();
          const retryMatch = errText.match(/try again in (\d+\.?\d*)s/);
          const cooldown = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 5 : 60;
          console.log(`[ai-router] ${providerName} rate limited (attempt ${attempt + 1}), cooldown ${cooldown}s`);
          recordError(providerName, cooldown);
          break; // Move to next provider immediately on 429
        }

        if (response.status === 402) {
          recordError(providerName, 3600); // 1 hour cooldown for payment issues
          break;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[ai-router] ${providerName} error ${response.status}:`, errText);
          recordError(providerName, 30);
          if (attempt === 0) continue; // retry once
          break; // move to next provider
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          console.warn(`[ai-router] ${providerName} returned empty content`);
          recordError(providerName, 10);
          if (attempt === 0) continue;
          break;
        }

        recordSuccess(providerName, latencyMs);
        console.log(`[ai-router] Served by ${providerName} in ${latencyMs}ms (score: ${providerStates[providerName].score.toFixed(1)})`);
        return { data, provider: providerName };
      } catch (err: any) {
        if (err.status) throw err; // re-throw structured errors
        console.error(`[ai-router] ${providerName} exception:`, err.message);
        recordError(providerName, 30);
        if (attempt === 0) continue;
        break;
      }
    }
  }

  throw { status: 503, message: 'All AI providers failed. Please try again in a moment.' };
}

// ─── Main Handler ───────────────────────────────────────

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

    const userId = (claimsData.claims as any).sub;
    if (isUserRateLimited(userId)) {
      return new Response(JSON.stringify({
        error: 'Too many requests. Please wait a moment before trying again.',
        code: 'RATE_LIMITED',
        retryable: true,
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { messages, mode, batchIndex, totalBatches } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: messages required' }), { status: 400, headers: corsHeaders });
    }

    // Clean messages
    let finalMessages = messages.map((m: any) => ({ role: m.role, content: m.content }));

    // Batch continuation support (for draft batches)
    if (batchIndex !== undefined && totalBatches !== undefined && batchIndex > 0) {
      finalMessages.push({
        role: "user",
        content: `Continue generating the next batch (batch ${batchIndex + 1} of ${totalBatches}). Pick up exactly where you left off. Do NOT repeat any previously generated sub-questions. Return ONLY the new sub-questions in the same JSON array format.`,
      });
    }

    // Inject action mode instructions for chat mode
    if (mode === 'chat' && finalMessages.length > 0 && finalMessages[0].role === "system") {
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

    // Determine temperature and max tokens based on mode
    const temperature = mode === 'draft' ? 0.2 : 0.3;
    const maxTokens = mode === 'draft' ? 16384 : 8192;

    const { data, provider } = await routedAICall(finalMessages, mode || 'chat', temperature, maxTokens);

    // Add metadata
    const finishReason = data?.choices?.[0]?.finish_reason;
    data._meta = {
      finish_reason: finishReason,
      was_truncated: finishReason === 'length',
      provider,
    };

    // Provider status summary for debug
    data._routing = {
      selected: provider,
      scores: Object.fromEntries(
        Object.values(providerStates).map(p => [p.name, {
          score: Math.round(p.score),
          requests: p.requestCount,
          errors: p.errorCount,
          avgLatencyMs: p.successCount > 0 ? Math.round(p.totalLatencyMs / p.successCount) : null,
        }])
      ),
    };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[ai-router] Unhandled error:', err);

    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    const code = status === 429 ? 'RATE_LIMITED' : status === 402 ? 'PAYMENT_REQUIRED' : undefined;

    return new Response(JSON.stringify({
      error: message,
      code,
      retryable: status === 429,
    }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
