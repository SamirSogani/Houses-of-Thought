import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { AssignmentMode, CreateAssignmentInput } from "@/hooks/useAssignments";
import { useTeacherAnalyses } from "@/hooks/useAssignments";

interface Props {
  classroomId: string;
  onCreate: (input: CreateAssignmentInput) => Promise<{ data: any; error: any }>;
}

export default function CreateAssignmentDialog({ classroomId, onCreate }: Props) {
  const teacherAnalyses = useTeacherAnalyses();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [mode, setMode] = useState<AssignmentMode>("empty");
  const [prefilledQuestion, setPrefilledQuestion] = useState("");
  const [prefilledSubPurposes, setPrefilledSubPurposes] = useState("");
  const [templateAnalysisId, setTemplateAnalysisId] = useState<string>("");

  const reset = () => {
    setTitle("");
    setPrompt("");
    setDueAt("");
    setMode("empty");
    setPrefilledQuestion("");
    setPrefilledSubPurposes("");
    setTemplateAnalysisId("");
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (mode === "prefilled" && !prefilledQuestion.trim()) {
      toast.error("Pre-filled mode needs an overarching question");
      return;
    }
    if (mode === "template" && !templateAnalysisId) {
      toast.error("Pick a template house");
      return;
    }
    setBusy(true);
    const { error } = await onCreate({
      classroom_id: classroomId,
      title: title.trim(),
      prompt: prompt.trim(),
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      mode,
      prefilled_question: mode === "prefilled" ? prefilledQuestion.trim() : null,
      prefilled_sub_purposes: mode === "prefilled" ? prefilledSubPurposes.trim() : null,
      template_analysis_id: mode === "template" ? templateAnalysisId : null,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not create assignment");
      return;
    }
    toast.success("Assignment created");
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 3 — Bias in Sources" />
          </div>
          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Instructions students will see when they open the assignment."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Due date (optional)</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Starting house</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AssignmentMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">Empty house</SelectItem>
                <SelectItem value="prefilled">Pre-filled question</SelectItem>
                <SelectItem value="template">Clone from one of my houses</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === "empty" && "Student gets a blank house tagged to this assignment."}
              {mode === "prefilled" && "Student gets a house with the overarching question already filled in."}
              {mode === "template" && "Student gets a full clone of one of your houses to fill in."}
            </p>
          </div>

          {mode === "prefilled" && (
            <>
              <div className="space-y-2">
                <Label>Overarching question</Label>
                <Textarea
                  value={prefilledQuestion}
                  onChange={(e) => setPrefilledQuestion(e.target.value)}
                  placeholder="What should students reason about?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Sub-purposes (optional)</Label>
                <Textarea
                  value={prefilledSubPurposes}
                  onChange={(e) => setPrefilledSubPurposes(e.target.value)}
                  placeholder="Additional framing or sub-purposes."
                  rows={2}
                />
              </div>
            </>
          )}

          {mode === "template" && (
            <div className="space-y-2">
              <Label>Template house</Label>
              <Select value={templateAnalysisId} onValueChange={setTemplateAnalysisId}>
                <SelectTrigger><SelectValue placeholder="Pick one of your houses" /></SelectTrigger>
                <SelectContent>
                  {teacherAnalyses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.title || "Untitled"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleCreate} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
