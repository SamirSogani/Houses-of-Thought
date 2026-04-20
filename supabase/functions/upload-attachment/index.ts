// Edge function: upload-attachment
// Accepts multipart form-data with `parent_type`, `parent_id`, and one or more `files`.
// Validates parent ownership/membership server-side, validates file type/size/count,
// uploads to the private `attachments` bucket, and inserts rows into public.attachments.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_MIMES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/markdown",
  "application/rtf",
  "text/rtf",
  // Slides
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/heic",
  // Audio
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_FILES_PER_UPLOAD = 8;
const MAX_TOTAL_PER_RECORD = 40 * 1024 * 1024; // 40 MB

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

  // Validate caller via anon client + their JWT
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return bad(401, "invalid_auth");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad(400, "invalid_form");
  }

  const parentType = String(form.get("parent_type") ?? "");
  const parentId = String(form.get("parent_id") ?? "");
  if (!["assignment", "submission", "comment"].includes(parentType)) return bad(400, "bad_parent_type");
  if (!/^[0-9a-f-]{36}$/i.test(parentId)) return bad(400, "bad_parent_id");

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return bad(400, "no_files");
  if (files.length > MAX_FILES_PER_UPLOAD) return bad(400, "too_many_files");

  // Service-role client for the actual storage + DB writes (we already verified caller above)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Validate caller can attach to this parent
  const { data: canAttach, error: caErr } = await admin.rpc("can_attach_to", {
    p_parent_type: parentType,
    p_parent_id: parentId,
  });
  if (caErr) return bad(500, "perm_check_failed");
  // can_attach_to runs SECURITY DEFINER on auth.uid() — when called via service-role admin client,
  // auth.uid() is null, so we re-verify ownership manually here using the verified user.id.
  let allowed = false;
  if (parentType === "assignment") {
    const { data } = await admin.from("assignments").select("teacher_id").eq("id", parentId).maybeSingle();
    allowed = data?.teacher_id === user.id;
  } else if (parentType === "submission") {
    const { data } = await admin.from("assignment_submissions").select("student_id").eq("id", parentId).maybeSingle();
    allowed = data?.student_id === user.id;
  } else {
    allowed = false; // comments locked until phase 4
  }
  if (!allowed) return bad(403, "not_allowed");

  // Existing total for this parent
  const { data: existing } = await admin
    .from("attachments")
    .select("file_size")
    .eq("parent_type", parentType)
    .eq("parent_id", parentId);
  const existingTotal = (existing ?? []).reduce((acc, r: any) => acc + Number(r.file_size || 0), 0);

  let newTotal = 0;
  for (const f of files) {
    if (!ALLOWED_MIMES.has(f.type)) return bad(400, `bad_type:${f.name}`);
    if (f.size <= 0 || f.size > MAX_FILE_SIZE) return bad(400, `bad_size:${f.name}`);
    newTotal += f.size;
  }
  if (existingTotal + newTotal > MAX_TOTAL_PER_RECORD) return bad(400, "record_quota_exceeded");

  const inserted: any[] = [];
  const cleanup: string[] = [];

  for (const f of files) {
    const safeName = f.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const objectName = `${parentType}s/${parentId}/${crypto.randomUUID()}-${safeName}`;
    const buf = new Uint8Array(await f.arrayBuffer());

    const up = await admin.storage.from("attachments").upload(objectName, buf, {
      contentType: f.type,
      upsert: false,
    });
    if (up.error) {
      // Roll back anything we already uploaded in this batch
      for (const path of cleanup) await admin.storage.from("attachments").remove([path]);
      return bad(500, "upload_failed");
    }
    cleanup.push(objectName);

    const { data: row, error: insErr } = await admin
      .from("attachments")
      .insert({
        owner_id: user.id,
        parent_type: parentType,
        parent_id: parentId,
        storage_path: objectName,
        file_name: safeName,
        file_size: f.size,
        mime_type: f.type,
      })
      .select()
      .single();

    if (insErr) {
      for (const path of cleanup) await admin.storage.from("attachments").remove([path]);
      return bad(500, "db_insert_failed");
    }
    inserted.push(row);
  }

  return new Response(JSON.stringify({ ok: true, attachments: inserted }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
