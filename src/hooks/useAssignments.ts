import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AssignmentMode = "empty" | "prefilled" | "template" | "none";
export type ResponseType = "acknowledge" | "text" | null;
export type SubmissionStatus = "in_progress" | "submitted";

export interface AssignmentRow {
  id: string;
  classroom_id: string;
  teacher_id: string;
  title: string;
  prompt: string;
  due_at: string | null;
  mode: AssignmentMode;
  response_type: ResponseType;
  prefilled_question: string | null;
  prefilled_sub_purposes: string | null;
  template_analysis_id: string | null;
  created_at: string;
  updated_at: string;
  comment_audience: "one_way" | "two_way";
}

export interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  analysis_id: string | null;
  status: SubmissionStatus;
  started_at: string;
  submitted_at: string | null;
  response_text?: string | null;
}

export interface CreateAssignmentInput {
  classroom_id: string;
  title: string;
  prompt: string;
  due_at: string | null;
  mode: AssignmentMode;
  response_type?: ResponseType;
  prefilled_question?: string | null;
  prefilled_sub_purposes?: string | null;
  template_analysis_id?: string | null;
  comment_audience?: "one_way" | "two_way";
}

/** Teacher hook: list assignments for a classroom + submission counts. */
export function useAssignments(classroomId: string | undefined) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, { total: number; submitted: number }>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!classroomId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("assignments")
      .select("*")
      .eq("classroom_id", classroomId)
      .order("created_at", { ascending: false });
    const list = (data || []) as AssignmentRow[];
    setAssignments(list);

    if (list.length) {
      const ids = list.map((a) => a.id);
      const { data: subs } = await (supabase as any)
        .from("assignment_submissions")
        .select("assignment_id, status")
        .in("assignment_id", ids);
      const counts: Record<string, { total: number; submitted: number }> = {};
      ids.forEach((id) => (counts[id] = { total: 0, submitted: 0 }));
      (subs || []).forEach((s: any) => {
        counts[s.assignment_id].total += 1;
        if (s.status === "submitted") counts[s.assignment_id].submitted += 1;
      });
      setSubmissionCounts(counts);
    } else {
      setSubmissionCounts({});
    }
    setLoading(false);
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createAssignment = async (input: CreateAssignmentInput) => {
    const { data, error } = await (supabase as any)
      .from("assignments")
      .insert(input)
      .select()
      .single();
    if (!error) await refresh();
    return { data, error };
  };

  const updateAssignment = async (id: string, patch: Partial<AssignmentRow>) => {
    const { error } = await (supabase as any).from("assignments").update(patch).eq("id", id);
    if (!error) await refresh();
    return { error };
  };

  const deleteAssignment = async (id: string) => {
    const { error } = await (supabase as any).from("assignments").delete().eq("id", id);
    if (!error) await refresh();
    return { error };
  };

  return { assignments, submissionCounts, loading, refresh, createAssignment, updateAssignment, deleteAssignment };
}

/** Teacher hook: detail for a single assignment + its submissions. */
export function useAssignmentDetail(assignmentId: string | undefined) {
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    const [a, s] = await Promise.all([
      (supabase as any).from("assignments").select("*").eq("id", assignmentId).maybeSingle(),
      (supabase as any)
        .from("assignment_submissions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("started_at", { ascending: false }),
    ]);
    setAssignment((a.data as AssignmentRow) || null);
    setSubmissions(((s.data as SubmissionRow[]) || []));
    setLoading(false);
  }, [assignmentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { assignment, submissions, loading, refresh };
}

/** Teacher: list of own analyses (for template picker). */
export function useTeacherAnalyses() {
  const [analyses, setAnalyses] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("analyses")
        .select("id, title")
        .order("updated_at", { ascending: false });
      setAnalyses((data || []).map((a) => ({ id: a.id, title: a.title })));
    })();
  }, []);
  return analyses;
}
