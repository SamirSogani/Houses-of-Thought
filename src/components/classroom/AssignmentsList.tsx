import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, FileText, Sparkles, Copy, BookOpen, MessageSquare } from "lucide-react";
import type { AssignmentRow, SubmissionRow } from "@/hooks/useAssignments";
import StudentNoHouseAssignment from "./StudentNoHouseAssignment";

interface TeacherProps {
  role: "teacher";
  classroomId: string;
  assignments: AssignmentRow[];
  counts: Record<string, { total: number; submitted: number }>;
}

interface StudentProps {
  role: "student";
  items: Array<AssignmentRow & { submission: SubmissionRow | null }>;
  onStart: (assignmentId: string) => Promise<{ data: any; error: any }>;
  onOpen: (analysisId: string) => void;
  onSubmit: (submissionId: string) => Promise<{ data: any; error: any }>;
  onUnsubmit: (submissionId: string) => Promise<{ data: any; error: any }>;
}

type Props = TeacherProps | StudentProps;

const MODE_META: Record<string, { label: string; icon: any }> = {
  empty: { label: "Empty", icon: FileText },
  prefilled: { label: "Pre-filled", icon: Sparkles },
  template: { label: "Template", icon: Copy },
  none: { label: "No house", icon: MessageSquare },
};

function formatDue(due: string | null) {
  if (!due) return "No due date";
  const d = new Date(due);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}

export default function AssignmentsList(props: Props) {
  const navigate = useNavigate();

  if (props.role === "teacher") {
    if (!props.assignments.length) {
      return (
        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-md">
          No assignments yet. Click <span className="font-medium text-foreground">+ New Assignment</span> to create one.
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {props.assignments.map((a) => {
          const meta = MODE_META[a.mode] || MODE_META.empty;
          const Icon = meta.icon;
          const c = props.counts[a.id] || { total: 0, submitted: 0 };
          return (
            <Card
              key={a.id}
              className="p-4 hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => navigate(`/classrooms/${props.classroomId}/assignments/${a.id}`)}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-foreground truncate">{a.title}</h3>
                    <Badge variant="secondary" className="gap-1">
                      <Icon className="h-3 w-3" /> {meta.label}
                    </Badge>
                  </div>
                  {a.prompt && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.prompt}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> {formatDue(a.due_at)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Submissions</div>
                  <div className="text-base font-semibold text-foreground">
                    {c.submitted}/{c.total}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // Student view
  if (!props.items.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-md">
        No assignments yet. Your teacher will post them here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {props.items.map((a) => {
        // No-house assignments render their own inline card
        if (a.mode === "none") {
          return (
            <StudentNoHouseAssignment
              key={a.id}
              assignment={a}
              submission={a.submission}
              onStart={props.onStart}
              onSubmit={props.onSubmit}
              onUnsubmit={props.onUnsubmit}
            />
          );
        }

        const sub = a.submission;
        const status: "not_started" | "in_progress" | "submitted" =
          !sub ? "not_started" : sub.status === "submitted" ? "submitted" : "in_progress";
        const overdue = isOverdue(a.due_at) && status !== "submitted";

        return (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-semibold text-foreground truncate">{a.title}</h3>
                  {status === "submitted" && <Badge className="bg-emerald-600 hover:bg-emerald-600">Submitted</Badge>}
                  {status === "in_progress" && <Badge variant="secondary">In progress</Badge>}
                  {status === "not_started" && <Badge variant="outline">Not started</Badge>}
                  {overdue && <Badge variant="destructive">Overdue</Badge>}
                </div>
                {a.prompt && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{a.prompt}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> {formatDue(a.due_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {status === "not_started" && (
                  <Button size="sm" onClick={() => props.onStart(a.id)}>
                    <BookOpen className="h-4 w-4 mr-1" /> Start Assignment
                  </Button>
                )}
                {status === "in_progress" && sub && sub.analysis_id && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => props.onOpen(sub.analysis_id!)}>Open</Button>
                    <Button size="sm" onClick={() => props.onSubmit(sub.id)}>Submit</Button>
                  </>
                )}
                {status === "submitted" && sub && sub.analysis_id && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => props.onOpen(sub.analysis_id!)}>View</Button>
                    <Button size="sm" variant="ghost" onClick={() => props.onUnsubmit(sub.id)}>Unsubmit</Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
