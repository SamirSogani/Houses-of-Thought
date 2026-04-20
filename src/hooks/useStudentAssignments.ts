import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AssignmentRow, SubmissionRow } from "./useAssignments";

export interface StudentAssignmentRow extends AssignmentRow {
  submission: SubmissionRow | null;
}

export function useStudentAssignments(classroomId: string | undefined) {
  const { user } = useAuth();
  const [items, setItems] = useState<StudentAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!classroomId || !user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: assignments } = await (supabase as any)
      .from("assignments")
      .select("*")
      .eq("classroom_id", classroomId)
      .order("due_at", { ascending: true, nullsFirst: false });

    const list = (assignments || []) as AssignmentRow[];
    if (!list.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = list.map((a) => a.id);
    const { data: subs } = await (supabase as any)
      .from("assignment_submissions")
      .select("*")
      .eq("student_id", user.id)
      .in("assignment_id", ids);

    const subMap = new Map<string, SubmissionRow>();
    (subs || []).forEach((s: any) => subMap.set(s.assignment_id, s));

    setItems(list.map((a) => ({ ...a, submission: subMap.get(a.id) || null })));
    setLoading(false);
  }, [classroomId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startAssignment = async (assignmentId: string) => {
    const { data, error } = await (supabase as any).rpc("start_assignment", {
      p_assignment_id: assignmentId,
    });
    if (!error) await refresh();
    return { data, error };
  };

  const submitAssignment = async (submissionId: string) => {
    const { data, error } = await (supabase as any).rpc("submit_assignment", {
      p_submission_id: submissionId,
    });
    if (!error) await refresh();
    return { data, error };
  };

  const unsubmitAssignment = async (submissionId: string) => {
    const { data, error } = await (supabase as any).rpc("unsubmit_assignment", {
      p_submission_id: submissionId,
    });
    if (!error) await refresh();
    return { data, error };
  };

  return { items, loading, refresh, startAssignment, submitAssignment, unsubmitAssignment };
}

/** Used by AnalysisPage to show the assignment banner if this analysis is part of a submission. */
export function useAnalysisAssignmentContext(analysisId: string | undefined) {
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!analysisId) return;
    setLoading(true);
    const { data: a } = await (supabase as any)
      .from("analyses")
      .select("assignment_submission_id")
      .eq("id", analysisId)
      .maybeSingle();
    const subId = a?.assignment_submission_id;
    if (!subId) {
      setSubmission(null);
      setAssignment(null);
      setLoading(false);
      return;
    }
    const { data: s } = await (supabase as any)
      .from("assignment_submissions")
      .select("*")
      .eq("id", subId)
      .maybeSingle();
    setSubmission((s as SubmissionRow) || null);
    if (s) {
      const { data: asn } = await (supabase as any)
        .from("assignments")
        .select("*")
        .eq("id", s.assignment_id)
        .maybeSingle();
      setAssignment((asn as AssignmentRow) || null);
    }
    setLoading(false);
  }, [analysisId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    if (!submission) return { error: new Error("No submission") };
    const { error } = await (supabase as any).rpc("submit_assignment", { p_submission_id: submission.id });
    if (!error) await refresh();
    return { error };
  };

  const unsubmit = async () => {
    if (!submission) return { error: new Error("No submission") };
    const { error } = await (supabase as any).rpc("unsubmit_assignment", { p_submission_id: submission.id });
    if (!error) await refresh();
    return { error };
  };

  return { submission, assignment, loading, refresh, submit, unsubmit };
}
