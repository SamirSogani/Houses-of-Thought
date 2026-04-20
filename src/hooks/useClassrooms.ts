import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ClassroomRow {
  id: string;
  teacher_id: string;
  name: string;
  code: string;
  student_cap: number | null;
  created_at: string;
  updated_at: string;
}

export interface RosterRow {
  id: string;
  student_id: string;
  joined_at: string;
}

/** Teacher hook: list, create, update, delete classrooms. */
export function useClassrooms() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("classrooms")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setClassrooms([]);
    } else {
      setClassrooms((data || []) as ClassroomRow[]);
      // counts
      const ids = (data || []).map((c: any) => c.id);
      if (ids.length) {
        const { data: members } = await (supabase as any)
          .from("classroom_members")
          .select("classroom_id")
          .in("classroom_id", ids);
        const map: Record<string, number> = {};
        (members || []).forEach((m: any) => {
          map[m.classroom_id] = (map[m.classroom_id] || 0) + 1;
        });
        setCounts(map);
      } else {
        setCounts({});
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createClassroom = async (name: string, studentCap: number | null) => {
    const { data, error } = await (supabase as any)
      .from("classrooms")
      .insert({ name, student_cap: studentCap })
      .select()
      .single();
    if (!error) await refresh();
    return { data, error };
  };

  const updateClassroom = async (id: string, patch: Partial<ClassroomRow>) => {
    const { error } = await (supabase as any).from("classrooms").update(patch).eq("id", id);
    if (!error) await refresh();
    return { error };
  };

  const deleteClassroom = async (id: string) => {
    const { error } = await (supabase as any).from("classrooms").delete().eq("id", id);
    if (!error) await refresh();
    return { error };
  };

  const regenerateCode = async (id: string) => {
    const { data, error } = await (supabase as any).rpc("regenerate_classroom_code", {
      p_classroom_id: id,
    });
    if (!error) await refresh();
    return { data, error };
  };

  return {
    classrooms,
    counts,
    loading,
    refresh,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    regenerateCode,
  };
}

export function useClassroomDetail(classroomId: string | undefined) {
  const [classroom, setClassroom] = useState<ClassroomRow | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!classroomId) return;
    setLoading(true);
    const [c, m] = await Promise.all([
      (supabase as any).from("classrooms").select("*").eq("id", classroomId).maybeSingle(),
      (supabase as any)
        .from("classroom_members")
        .select("*")
        .eq("classroom_id", classroomId)
        .order("joined_at", { ascending: false }),
    ]);
    setClassroom((c.data as ClassroomRow) || null);
    setRoster(((m.data as RosterRow[]) || []));
    setLoading(false);
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const removeStudent = async (memberId: string) => {
    const { error } = await (supabase as any).from("classroom_members").delete().eq("id", memberId);
    if (!error) await refresh();
    return { error };
  };

  return { classroom, roster, loading, refresh, removeStudent };
}
