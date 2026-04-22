import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CommentTargetType = "submission" | "inline" | "assignment";

export interface CommentRow {
  id: string;
  assignment_id: string;
  submission_id: string | null;
  analysis_id: string | null;
  target_type: CommentTargetType;
  target_kind: string | null;
  target_id: string | null;
  author_id: string;
  author_role: "teacher" | "student";
  body: string;
  resolved_at: string | null;
  resolved_by: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface UseCommentsOptions {
  assignmentId: string | undefined;
  targetType: CommentTargetType;
  submissionId?: string | null;
  analysisId?: string | null;
  targetKind?: string | null;
  targetId?: string | null;
}

/**
 * Fetches + subscribes to comments for a given thread.
 * Filters client-side after a broad fetch by assignment_id (server RLS already
 * narrows what the user can see).
 */
export function useComments(opts: UseCommentsOptions) {
  const { assignmentId, targetType, submissionId, analysisId, targetKind, targetId } = opts;
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const matches = useCallback(
    (c: CommentRow) => {
      if (c.assignment_id !== assignmentId) return false;
      if (c.target_type !== targetType) return false;
      if (targetType === "assignment") return true;
      if (submissionId && c.submission_id !== submissionId) return false;
      if (targetType === "inline") {
        if (targetKind && c.target_kind !== targetKind) return false;
        if (targetId !== undefined && targetId !== null && c.target_id !== targetId) return false;
        if ((targetId === null || targetId === undefined) && c.target_id !== null) return false;
      }
      return true;
    },
    [assignmentId, targetType, submissionId, targetKind, targetId],
  );

  const refresh = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    let q = (supabase as any)
      .from("comments")
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("target_type", targetType)
      .order("created_at", { ascending: true });
    if (submissionId) q = q.eq("submission_id", submissionId);
    if (targetType === "inline") {
      if (targetKind) q = q.eq("target_kind", targetKind);
      if (targetId) q = q.eq("target_id", targetId);
    }
    const { data } = await q;
    setComments((data || []) as CommentRow[]);
    setLoading(false);
  }, [assignmentId, targetType, submissionId, targetKind, targetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime
  useEffect(() => {
    if (!assignmentId) return;
    const channel = (supabase as any)
      .channel(`comments-${assignmentId}-${targetType}-${submissionId || "x"}-${targetKind || "x"}-${targetId || "x"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `assignment_id=eq.${assignmentId}` },
        (payload: any) => {
          const row = (payload.new || payload.old) as CommentRow | null;
          if (!row) return;
          if (!matches(row)) return;
          setComments((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some((p) => p.id === row.id)) return prev;
              return [...prev, payload.new as CommentRow].sort((a, b) =>
                a.created_at.localeCompare(b.created_at),
              );
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((p) => (p.id === row.id ? (payload.new as CommentRow) : p));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((p) => p.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      try {
        (supabase as any).removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [assignmentId, targetType, submissionId, targetKind, targetId, matches]);

  const post = useCallback(
    async (body: string) => {
      if (!assignmentId) return { error: { message: "no_assignment" } };
      const { data, error } = await (supabase as any).rpc("post_comment", {
        p_assignment_id: assignmentId,
        p_target_type: targetType,
        p_target_kind: targetKind ?? null,
        p_target_id: targetId ?? null,
        p_submission_id: submissionId ?? null,
        p_analysis_id: analysisId ?? null,
        p_body: body,
      });
      return { data, error };
    },
    [assignmentId, targetType, submissionId, analysisId, targetKind, targetId],
  );

  const edit = useCallback(async (id: string, body: string) => {
    const { data, error } = await (supabase as any).rpc("edit_comment", { p_id: id, p_body: body });
    return { data, error };
  }, []);

  const remove = useCallback(async (id: string) => {
    const { data, error } = await (supabase as any).rpc("delete_comment", { p_id: id });
    return { data, error };
  }, []);

  const resolve = useCallback(async (id: string) => {
    const { data, error } = await (supabase as any).rpc("resolve_comment", { p_id: id });
    return { data, error };
  }, []);

  const unresolve = useCallback(async (id: string) => {
    const { data, error } = await (supabase as any).rpc("unresolve_comment", { p_id: id });
    return { data, error };
  }, []);

  const filtered = useMemo(() => comments.filter(matches), [comments, matches]);

  return { comments: filtered, loading, refresh, post, edit, remove, resolve, unresolve };
}

/** Marks a set of comment ids as read for the current user. */
export async function markCommentsRead(ids: string[]) {
  if (!ids.length) return;
  await (supabase as any).rpc("mark_comments_read", { p_ids: ids });
}
