import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2, Eye, Send, Undo2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { AssignmentRow, SubmissionRow } from "@/hooks/useAssignments";

interface Props {
  assignment: AssignmentRow;
  submission: SubmissionRow;
  readonly?: boolean;
  onSubmit?: () => void;
  onUnsubmit?: () => void;
}

function formatDue(due: string | null) {
  if (!due) return "No due date";
  return new Date(due).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function AssignmentBanner({ assignment, submission, readonly, onSubmit, onUnsubmit }: Props) {
  const submitted = submission.status === "submitted";

  return (
    <div className="border-b border-border bg-primary/5">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {readonly ? <Eye className="h-4 w-4 text-primary shrink-0" /> : submitted ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <CalendarClock className="h-4 w-4 text-primary shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {readonly ? "Viewing as teacher" : "Assignment"}
              </span>
              <span className="font-medium text-sm text-foreground truncate">{assignment.title}</span>
              {submitted ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Submitted</Badge>
              ) : (
                <Badge variant="secondary">In progress</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Due {formatDue(assignment.due_at)}
              {assignment.prompt ? ` · ${assignment.prompt}` : ""}
            </div>
          </div>
        </div>

        {!readonly && (
          <div className="flex items-center gap-2">
            {submitted ? (
              <Button size="sm" variant="outline" onClick={onUnsubmit}>
                <Undo2 className="h-4 w-4 mr-1" /> Unsubmit
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm">
                    <Send className="h-4 w-4 mr-1" /> Submit
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit this assignment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your teacher will be able to view this house. You can still unsubmit it later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onSubmit}>Submit</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
