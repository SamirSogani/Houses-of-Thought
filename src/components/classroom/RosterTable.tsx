import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, UserCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RosterRow } from "@/hooks/useClassrooms";

interface DisplayRow extends RosterRow {
  display_name?: string;
}

export default function RosterTable({
  roster,
  onRemove,
}: {
  roster: RosterRow[];
  onRemove: (memberId: string) => Promise<{ error: any }>;
}) {
  const [rows, setRows] = useState<DisplayRow[]>(roster);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (roster.length === 0) {
        setRows([]);
        return;
      }
      const ids = roster.map((r) => r.student_id);
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("user_id, username, role_title, about_me")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        map[p.user_id] =
          p.username?.trim() ||
          p.role_title?.trim() ||
          (p.about_me ? p.about_me.slice(0, 40) : "") ||
          "";
      });
      if (cancelled) return;
      setRows(
        roster.map((r) => ({
          ...r,
          display_name: map[r.student_id] || `Student ${r.student_id.slice(0, 8)}`,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [roster]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg">
        <UserCircle2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No students have joined yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Share the classroom code to invite students.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Student</th>
            <th className="text-left px-4 py-2 font-medium">Joined</th>
            <th className="text-right px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-muted/20">
              <td className="px-4 py-2">
                <div className="font-medium text-foreground">{r.display_name}</div>
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {new Date(r.joined_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-2 text-right">
                <AlertDialog>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove student?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This student will be unlinked from your classroom. Their own work and houses are not affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setRemoving(null)}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          if (removing) await onRemove(removing);
                          setRemoving(null);
                        }}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
