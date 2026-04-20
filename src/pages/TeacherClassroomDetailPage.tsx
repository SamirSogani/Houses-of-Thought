import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Trash2, Pencil, Save, X } from "lucide-react";
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
import { useClassrooms, useClassroomDetail } from "@/hooks/useClassrooms";
import ClassroomCodeBadge from "@/components/classroom/ClassroomCodeBadge";
import RosterTable from "@/components/classroom/RosterTable";
import { toast } from "sonner";

export default function TeacherClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateClassroom, deleteClassroom, regenerateCode } = useClassrooms();
  const { classroom, roster, loading, refresh, removeStudent } = useClassroomDetail(id);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingCap, setEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState("");

  useEffect(() => {
    if (classroom) {
      setNameDraft(classroom.name);
      setCapDraft(classroom.student_cap?.toString() || "");
    }
  }, [classroom]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading classroom…</p>
      </div>
    );
  }
  if (!classroom) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Classroom not found.</p>
        <Button onClick={() => navigate("/classrooms")}>Back to Classrooms</Button>
      </div>
    );
  }

  const saveName = async () => {
    if (!nameDraft.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    await updateClassroom(classroom.id, { name: nameDraft.trim() });
    await refresh();
    setEditingName(false);
    toast.success("Renamed");
  };

  const saveCap = async () => {
    const trimmed = capDraft.trim();
    const newCap = trimmed === "" ? null : parseInt(trimmed, 10);
    if (trimmed !== "" && (isNaN(newCap as any) || (newCap as number) < 1)) {
      toast.error("Cap must be a positive number");
      return;
    }
    if (newCap !== null && newCap < roster.length) {
      toast.error(`Cap cannot be lower than current student count (${roster.length})`);
      return;
    }
    await updateClassroom(classroom.id, { student_cap: newCap });
    await refresh();
    setEditingCap(false);
    toast.success("Cap updated");
  };

  const handleRegenerate = async () => {
    const { error } = await regenerateCode(classroom.id);
    if (error) toast.error("Could not regenerate code");
    else {
      await refresh();
      toast.success("New code generated");
    }
  };

  const handleDelete = async () => {
    const { error } = await deleteClassroom(classroom.id);
    if (error) toast.error("Could not delete classroom");
    else {
      toast.success("Classroom deleted");
      navigate("/classrooms");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/classrooms")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Classrooms
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Classroom header card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && saveName()}
                      className="text-xl font-display font-bold"
                    />
                    <Button size="icon" variant="ghost" onClick={saveName}><Save className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setNameDraft(classroom.name); setEditingName(false); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <CardTitle className="text-2xl font-display flex items-center gap-2">
                    {classroom.name}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardTitle>
                )}
              </div>
              <ClassroomCodeBadge code={classroom.code} size="lg" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" /> Regenerate Code
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate classroom code?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The old code will stop working immediately. Existing students stay enrolled. Share the new code with anyone you still want to invite.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRegenerate}>Regenerate</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Student cap:</span>
                {editingCap ? (
                  <>
                    <Input
                      type="number"
                      min={1}
                      value={capDraft}
                      onChange={(e) => setCapDraft(e.target.value)}
                      placeholder="Unlimited"
                      className="w-32 h-8"
                      onKeyDown={(e) => e.key === "Enter" && saveCap()}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveCap}><Save className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setCapDraft(classroom.student_cap?.toString() || ""); setEditingCap(false); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">{classroom.student_cap ?? "Unlimited"}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCap(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roster */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">
              Students ({roster.length}{classroom.student_cap ? ` / ${classroom.student_cap}` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RosterTable roster={roster} onRemove={removeStudent} />
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg font-display text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Classroom
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this classroom?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All students will be unlinked from this classroom. Their own houses and work are not affected. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
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
