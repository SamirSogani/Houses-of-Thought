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
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment before trying again.', code: 'RATE_LIMITED', retryable: true }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'Service configuration error: GEMINI_API_KEY not set' }), { status: 500, headers: corsHeaders });
    }

    const { messages, mode } = await req.json();

    // Clean messages: Gemini API uses the same OpenAI-compatible format via the v1beta endpoint
    const finalMessages = messages.map((m: any) => ({ role: m.role, content: m.content }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${geminiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: finalMessages,
        temperature: mode === 'draft' ? 0.2 : 0.3,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Lovable AI error:', response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: 'AI rate limit exceeded. Please wait a moment and try again.',
          code: 'RATE_LIMITED',
          retryable: true,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({
          error: 'AI credits exhausted. Please add credits in Settings → Workspace → Usage.',
          code: 'PAYMENT_REQUIRED',
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'AI service error. Please try again.' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
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
