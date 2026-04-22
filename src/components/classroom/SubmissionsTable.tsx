import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SubmissionRow } from "@/hooks/useAssignments";
import SubmissionResponseDialog from "./SubmissionResponseDialog";

interface Props {
  submissions: SubmissionRow[];
  /** Pass when the parent assignment has mode='none' so we render "View Response" instead. */
  isNoHouse?: boolean;
  /** Pass to enable the per-submission comments thread inside the dialog. */
  assignmentId?: string;
}

export default function SubmissionsTable({ submissions, isNoHouse = false, assignmentId }: Props) {
  const navigate = useNavigate();
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>("");

  useEffect(() => {
    if (!submissions.length) return;
    (async () => {
      const ids = Array.from(new Set(submissions.map((s) => s.student_id)));
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, role_title, about_me")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        const label =
          p.username?.trim() ||
          p.role_title?.trim() ||
          p.about_me?.trim()?.slice(0, 40) ||
          `Student ${p.user_id.slice(0, 6)}`;
        map[p.user_id] = label;
      });
      setNames(map);
    })();
  }, [submissions]);

  if (!submissions.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
        No submissions yet.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((s) => {
            const studentLabel = names[s.student_id] || `Student ${s.student_id.slice(0, 6)}`;
            return (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{studentLabel}</TableCell>
                <TableCell>
                  {s.status === "submitted" ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Submitted</Badge>
                  ) : (
                    <Badge variant="secondary">In progress</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(s.started_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.submitted_at ? new Date(s.submitted_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {isNoHouse || !s.analysis_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveId(s.id);
                        setActiveLabel(studentLabel);
                        setOpen(true);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" /> View Response
                    </Button>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveId(s.id);
                          setActiveLabel(studentLabel);
                          setOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" /> Comments
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/analysis/${s.analysis_id}?readonly=1`)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> View house
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <SubmissionResponseDialog
        open={open}
        onOpenChange={setOpen}
        submissionId={activeId}
        studentLabel={activeLabel}
        assignmentId={assignmentId}
      />
    </>
  );
}
