import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AttachmentParentType = "assignment" | "submission" | "comment";

export interface AttachmentRow {
  id: string;
  owner_id: string;
  parent_type: AttachmentParentType;
  parent_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

/** Lists attachments for a parent record (RLS handles visibility). */
export function useAttachments(parentType: AttachmentParentType | null, parentId: string | null) {
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!parentType || !parentId) {
      setAttachments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("attachments")
      .select("*")
      .eq("parent_type", parentType)
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true });
    setAttachments((data || []) as AttachmentRow[]);
    setLoading(false);
  }, [parentType, parentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("attachments").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete attachment");
      return false;
    }
    // Also remove the storage object (best-effort; if RLS blocks, the row is gone anyway)
    const target = attachments.find((a) => a.id === id);
    if (target) {
      await supabase.storage.from("attachments").remove([target.storage_path]).catch(() => {});
    }
    await refresh();
    return true;
  };

  return { attachments, loading, refresh, remove };
}

/** Uploads a batch of File objects to a parent record via the edge function. */
export async function uploadAttachments(
  parentType: AttachmentParentType,
  parentId: string,
  files: File[]
): Promise<{ ok: boolean; error?: string }> {
  if (!files.length) return { ok: true };
  const form = new FormData();
  form.append("parent_type", parentType);
  form.append("parent_id", parentId);
  files.forEach((f) => form.append("files", f));

  const { data, error } = await supabase.functions.invoke("upload-attachment", {
    body: form,
  });
  if (error) return { ok: false, error: error.message };
  if (!(data as any)?.ok) return { ok: false, error: (data as any)?.error || "upload_failed" };
  return { ok: true };
}

/** Asks the edge function for a 1-hour signed download URL and opens it in a new tab. */
export async function downloadAttachment(attachmentId: string) {
  const { data, error } = await supabase.functions.invoke("sign-attachment-url", {
    body: { attachment_id: attachmentId },
  });
  if (error || !(data as any)?.signed_url) {
    toast.error("Could not generate download link");
    return;
  }
  window.open((data as any).signed_url, "_blank", "noopener,noreferrer");
}
