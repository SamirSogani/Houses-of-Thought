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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), { status: 500, headers: corsHeaders });
    }

    const { messages, mode } = await req.json();

    // Clean messages
    const finalMessages = messages.map((m: any) => ({ role: m.role, content: m.content }));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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

      return new Response(JSON.stringify({ error: `AI error: ${errText}` }), {
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
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
