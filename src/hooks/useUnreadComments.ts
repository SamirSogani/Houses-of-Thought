import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UnreadRow {
  assignment_id: string;
  submission_id: string | null;
  count: number;
}

/**
 * Returns unread-comment counts grouped by assignment + submission for the
 * current user. Refreshes on realtime comment events.
 */
export function useUnreadComments() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UnreadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any).rpc("unread_comment_counts");
    setRows(
      ((data || []) as any[]).map((r) => ({
        assignment_id: r.assignment_id,
        submission_id: r.submission_id,
        count: Number(r.count) || 0,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel(`unread-comments-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_reads" }, () => refresh())
      .subscribe();
    return () => {
      try {
        (supabase as any).removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [user, refresh]);

  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const byAssignment = (assignmentId: string) =>
    rows.filter((r) => r.assignment_id === assignmentId).reduce((a, r) => a + r.count, 0);
  const bySubmission = (submissionId: string) =>
    rows.filter((r) => r.submission_id === submissionId).reduce((a, r) => a + r.count, 0);

  return { rows, total, loading, refresh, byAssignment, bySubmission };
}
