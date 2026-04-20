import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, CalendarClock } from "lucide-react";
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
import SiteFooter from "@/components/layout/SiteFooter";
import { useAssignmentDetail, useAssignments } from "@/hooks/useAssignments";
import SubmissionsTable from "@/components/classroom/SubmissionsTable";
import { toast } from "sonner";

export default function TeacherAssignmentDetailPage() {
  const { id: classroomId, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const navigate = useNavigate();
  const { assignment, submissions, loading } = useAssignmentDetail(assignmentId);
  const { deleteAssignment } = useAssignments(classroomId);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!assignmentId) return;
    setBusy(true);
    const { error } = await deleteAssignment(assignmentId);
    setBusy(false);
    if (error) {
      toast.error("Could not delete assignment");
      return;
    }
    toast.success("Assignment deleted");
    navigate(`/classrooms/${classroomId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading assignment…</p>
      </div>
    );
  }
  if (!assignment) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Assignment not found.</p>
        <Button onClick={() => navigate(`/classrooms/${classroomId}`)}>Back to classroom</Button>
      </div>
    );
  }

  const submitted = submissions.filter((s) => s.status === "submitted").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/classrooms/${classroomId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to classroom
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-2xl font-display">{assignment.title}</CardTitle>
                <div className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Due {assignment.due_at ? new Date(assignment.due_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}
                </div>
              </div>
              <Badge variant="secondary" className="capitalize">{assignment.mode}</Badge>
            </div>
          </CardHeader>
          {assignment.prompt && (
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.prompt}</p>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">
              Submissions ({submitted}/{submissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionsTable submissions={submissions} />
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg font-display text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Assignment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this assignment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Students keep their houses, but the link to this assignment is removed and you'll lose your read-only view of their submitted work. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
