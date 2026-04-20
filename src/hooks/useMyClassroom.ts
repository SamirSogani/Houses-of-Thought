import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MyClassroom {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  joined_at: string;
}

/** Student hook: which classroom (if any) am I in? */
export function useMyClassroom() {
  const { user } = useAuth();
  const [classroom, setClassroom] = useState<MyClassroom | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setClassroom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: member } = await (supabase as any)
      .from("classroom_members")
      .select("classroom_id, joined_at")
      .eq("student_id", user.id)
      .maybeSingle();

    if (!member) {
      setClassroom(null);
      setLoading(false);
      return;
    }

    const { data: c } = await (supabase as any)
      .from("classrooms")
      .select("id, name, code, teacher_id")
      .eq("id", member.classroom_id)
      .maybeSingle();

    if (c) {
      setClassroom({ ...(c as any), joined_at: member.joined_at });
    } else {
      setClassroom(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const join = async (code: string) => {
    const { data, error } = await (supabase as any).rpc("join_classroom", { p_code: code });
    if (!error) await refresh();
    return { data, error };
  };

  const leave = async () => {
    const { data, error } = await (supabase as any).rpc("leave_classroom");
    if (!error) await refresh();
    return { data, error };
  };

  return { classroom, loading, refresh, join, leave };
}
