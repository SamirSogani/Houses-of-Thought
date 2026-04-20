import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, GraduationCap, CheckCircle2, LogOut } from "lucide-react";
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
import { useMyClassroom } from "@/hooks/useMyClassroom";
import { useStudentAssignments } from "@/hooks/useStudentAssignments";
import AssignmentsList from "@/components/classroom/AssignmentsList";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "That code doesn't match any classroom. Double-check it with your teacher.",
  already_in_classroom: "You're already in a classroom. Leave it before joining another one.",
  classroom_full: "This classroom has reached its student cap.",
  not_authenticated: "Please sign in first.",
};

export default function StudentClassroomPage() {
  const navigate = useNavigate();
  const { classroom, loading, join, leave } = useMyClassroom();
  const { items: assignments, startAssignment, submitAssignment, unsubmitAssignment } =
    useStudentAssignments(classroom?.id);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setError(null);
    if (!code.trim()) {
      setError("Please enter a code.");
      return;
    }
    setBusy(true);
    const { data, error: rpcErr } = await join(code.trim());
    setBusy(false);
    if (rpcErr) {
      setError("Something went wrong. Try again.");
      return;
    }
    const result = data as any;
    if (result?.ok) {
      toast.success(`Joined ${result.classroom_name || "classroom"}`);
      setCode("");
    } else {
      setError(ERROR_MESSAGES[result?.error] || "Could not join classroom.");
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    const { error: err } = await leave();
    setBusy(false);
    if (err) toast.error("Could not leave classroom");
    else toast.success("You left the classroom");
  };

  const handleStart = async (assignmentId: string) => {
    const { data, error: err } = await startAssignment(assignmentId);
    if (err) {
      toast.error("Could not start assignment");
      return;
    }
    const result = data as any;
    if (result?.ok && result.analysis_id) {
      toast.success("Assignment started");
      navigate(`/analysis/${result.analysis_id}`);
    } else {
      toast.error(result?.error || "Could not start assignment");
    }
  };

  const handleSubmit = async (submissionId: string) => {
    const { error: err } = await submitAssignment(submissionId);
    if (err) toast.error("Could not submit");
    else toast.success("Assignment submitted");
  };

  const handleUnsubmit = async (submissionId: string) => {
    const { error: err } = await unsubmitAssignment(submissionId);
    if (err) toast.error("Could not unsubmit");
    else toast.success("Submission withdrawn");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-display font-bold text-foreground">My Classroom</h1>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        {loading ? (
          <Card className="animate-pulse h-48" />
        ) : classroom ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">You're enrolled</span>
                </div>
                <CardTitle className="text-2xl font-display mt-1">{classroom.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Joined on {new Date(classroom.joined_at).toLocaleDateString()}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Classroom code:</span>{" "}
                  <span className="font-mono font-bold">{classroom.code}</span>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive border-destructive/30">
                      <LogOut className="h-4 w-4 mr-2" /> Leave Classroom
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave this classroom?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your work stays yours. You will be unlinked from this classroom and will no longer be visible to your teacher.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeave} disabled={busy}>Leave</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                <AssignmentsList
                  role="student"
                  items={assignments}
                  onStart={handleStart}
                  onOpen={(analysisId) => navigate(`/analysis/${analysisId}`)}
                  onSubmit={handleSubmit}
                  onUnsubmit={handleUnsubmit}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-display">Join a Classroom</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ask your teacher for the classroom code (looks like <span className="font-mono">HT-XXXX</span>) and enter it below.
              </p>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="HT-XXXX"
                  className="font-mono tracking-wider uppercase"
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
                <Button onClick={handleJoin} disabled={busy}>
                  {busy ? "Joining…" : "Join"}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
