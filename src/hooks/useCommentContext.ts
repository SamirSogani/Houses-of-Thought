import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CommentContextValue {
  loading: boolean;
  /** True if this analysis belongs to an assignment submission. */
  hasContext: boolean;
  assignmentId: string | null;
  submissionId: string | null;
  analysisId: string | null;
  studentId: string | null;
  teacherId: string | null;
  audience: "one_way" | "two_way";
  isTeacher: boolean;
  isOwnerStudent: boolean;
  /** Whether the current user can post inline/submission comments. */
  canPost: boolean;
  /** Whether the current user can resolve their own-submission comments. */
  canResolve: boolean;
  /** Read-only banner message when canPost is false. */
  readOnlyMessage?: string;
}

const EMPTY: CommentContextValue = {
  loading: true,
  hasContext: false,
  assignmentId: null,
  submissionId: null,
  analysisId: null,
  studentId: null,
  teacherId: null,
  audience: "two_way",
  isTeacher: false,
  isOwnerStudent: false,
  canPost: false,
  canResolve: false,
};

/**
 * Resolves the assignment/submission context for a given analysis so the inline
 * comment system knows whether to render pills, who the viewer is, and whether
 * they may post or resolve.
 */
export function useCommentContext(analysisId: string | undefined): CommentContextValue {
  const { user } = useAuth();
  const [value, setValue] = useState<CommentContextValue>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    if (!analysisId || !user) {
      setValue({ ...EMPTY, loading: false });
      return;
    }
    (async () => {
      const { data: a } = await (supabase as any)
        .from("analyses")
        .select("assignment_submission_id")
        .eq("id", analysisId)
        .maybeSingle();
      const subId = a?.assignment_submission_id;
      if (!subId) {
        if (!cancelled) setValue({ ...EMPTY, loading: false, analysisId });
        return;
      }
      const { data: s } = await (supabase as any)
        .from("assignment_submissions")
        .select("id, student_id, assignment_id")
        .eq("id", subId)
        .maybeSingle();
      if (!s) {
        if (!cancelled) setValue({ ...EMPTY, loading: false, analysisId });
        return;
      }
      const { data: asn } = await (supabase as any)
        .from("assignments")
        .select("id, teacher_id, comment_audience")
        .eq("id", s.assignment_id)
        .maybeSingle();
      if (!asn) {
        if (!cancelled) setValue({ ...EMPTY, loading: false, analysisId });
        return;
      }
      const isTeacher = asn.teacher_id === user.id;
      const isOwnerStudent = s.student_id === user.id;
      const audience: "one_way" | "two_way" = asn.comment_audience || "two_way";
      const canPost = isTeacher || (isOwnerStudent && audience === "two_way");
      const canResolve = isOwnerStudent;
      const readOnlyMessage =
        !canPost && isOwnerStudent && audience === "one_way"
          ? "Your teacher set this assignment to one-way. You can read feedback but not reply."
          : undefined;
      if (!cancelled) {
        setValue({
          loading: false,
          hasContext: true,
          assignmentId: asn.id,
          submissionId: s.id,
          analysisId,
          studentId: s.student_id,
          teacherId: asn.teacher_id,
          audience,
          isTeacher,
          isOwnerStudent,
          canPost,
          canResolve,
          readOnlyMessage,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId, user]);

  return value;
}
