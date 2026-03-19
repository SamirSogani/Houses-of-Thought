import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL");
    if (!OWNER_EMAIL) {
      return new Response(JSON.stringify({ error: "Owner not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is the owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create a client with the user's token to get their identity
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller || caller.email !== OWNER_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for admin queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    if (action === "list") {
      // Get all users from auth.users via admin API
      const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (usersError) throw usersError;

      // Get analysis counts per user
      const { data: analyses } = await adminClient.from("analyses").select("user_id, id");
      const analysisCountMap: Record<string, number> = {};
      (analyses || []).forEach((a: any) => {
        analysisCountMap[a.user_id] = (analysisCountMap[a.user_id] || 0) + 1;
      });

      // Get sidebar_chats counts per user
      const { data: chats } = await adminClient.from("sidebar_chats").select("user_id, id");
      const chatCountMap: Record<string, number> = {};
      (chats || []).forEach((c: any) => {
        chatCountMap[c.user_id] = (chatCountMap[c.user_id] || 0) + 1;
      });

      const userList = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        analysis_count: analysisCountMap[u.id] || 0,
        chat_count: chatCountMap[u.id] || 0,
      }));

      return new Response(JSON.stringify({ users: userList }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "user-detail") {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user's analyses with full details
      const { data: analyses } = await adminClient
        .from("analyses")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      // Get user's AI chats with ALL messages
      const { data: chats } = await adminClient
        .from("sidebar_chats")
        .select("id, chat_title, created_at, updated_at, messages, analysis_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      // Get user auth info
      const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(userId);

      return new Response(JSON.stringify({
        user: {
          id: targetUser?.id,
          email: targetUser?.email,
          created_at: targetUser?.created_at,
          last_sign_in_at: targetUser?.last_sign_in_at,
        },
        analyses: analyses || [],
        chats: (chats || []).map((c: any) => ({
          ...c,
          message_count: Array.isArray(c.messages) ? c.messages.length : 0,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analysis-detail") {
      const analysisId = url.searchParams.get("analysisId");
      if (!analysisId) {
        return new Response(JSON.stringify({ error: "analysisId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [analysisRes, sqRes, conceptsRes, assumptionsRes] = await Promise.all([
        adminClient.from("analyses").select("*").eq("id", analysisId).maybeSingle(),
        adminClient.from("sub_questions").select("*").eq("analysis_id", analysisId).order("sort_order"),
        adminClient.from("concepts").select("*").eq("analysis_id", analysisId),
        adminClient.from("assumptions").select("*"),
      ]);

      // Filter assumptions to those belonging to this analysis's sub-questions
      const sqIds = new Set((sqRes.data || []).map((sq: any) => sq.id));
      const relevantAssumptions = (assumptionsRes.data || []).filter((a: any) => sqIds.has(a.sub_question_id));

      return new Response(JSON.stringify({
        analysis: analysisRes.data,
        sub_questions: sqRes.data || [],
        concepts: conceptsRes.data || [],
        assumptions: relevantAssumptions,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
