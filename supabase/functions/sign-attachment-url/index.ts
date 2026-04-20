// Edge function: sign-attachment-url
// Returns a 1-hour signed URL for a single attachment, after verifying
// the caller is allowed to view it via public.can_view_attachment().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method_not_allowed");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return bad(401, "missing_auth");

  let body: { attachment_id?: string };
  try {
    body = await req.json();
  } catch {
    return bad(400, "invalid_body");
  }
  const id = String(body.attachment_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad(400, "bad_id");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return bad(401, "invalid_auth");

  // Use the user-scoped client so RLS on `attachments` enforces visibility.
  const { data: att, error } = await userClient
    .from("attachments")
    .select("id, storage_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (error || !att) return bad(403, "not_visible");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: signed, error: sErr } = await admin.storage
    .from("attachments")
    .createSignedUrl(att.storage_path, 60 * 60, { download: att.file_name });
  if (sErr || !signed?.signedUrl) return bad(500, "sign_failed");

  return new Response(JSON.stringify({ ok: true, signed_url: signed.signedUrl, file_name: att.file_name }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
