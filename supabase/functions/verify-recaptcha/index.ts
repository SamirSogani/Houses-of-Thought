import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCORE_THRESHOLD = 0.5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, action } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "No token provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretKey = Deno.env.get("RECAPTCHA_SECRET_KEY");

    if (!secretKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });

    const result = await verifyRes.json();
    const passed = Boolean(result.success) && Number(result.score ?? 0) >= SCORE_THRESHOLD && (!action || result.action === action);

    console.log(
      JSON.stringify({
        success: result.success,
        score: result.score,
        action: result.action,
        expectedAction: action,
        errorCodes: result["error-codes"] ?? [],
      }),
    );

    return new Response(JSON.stringify({ success: passed, score: result.score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("verify-recaptcha failed", error);

    return new Response(JSON.stringify({ success: false, error: "Verification failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
