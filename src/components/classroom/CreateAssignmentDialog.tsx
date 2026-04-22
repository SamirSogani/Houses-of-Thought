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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { AssignmentMode, CreateAssignmentInput, ResponseType } from "@/hooks/useAssignments";
import { useTeacherAnalyses } from "@/hooks/useAssignments";
import FileAttachmentInput from "@/components/ui/FileAttachmentInput";
import { uploadAttachments } from "@/hooks/useAttachments";

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
  const [responseType, setResponseType] = useState<NonNullable<ResponseType>>("text");
  const [prefilledQuestion, setPrefilledQuestion] = useState("");
  const [prefilledSubPurposes, setPrefilledSubPurposes] = useState("");
  const [templateAnalysisId, setTemplateAnalysisId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [commentAudience, setCommentAudience] = useState<"one_way" | "two_way">("two_way");

  const reset = () => {
    setTitle("");
    setPrompt("");
    setDueAt("");
    setMode("empty");
    setResponseType("text");
    setPrefilledQuestion("");
    setPrefilledSubPurposes("");
    setTemplateAnalysisId("");
    setFiles([]);
    setCommentAudience("two_way");
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
    const { data, error } = await onCreate({
      classroom_id: classroomId,
      title: title.trim(),
      prompt: prompt.trim(),
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      mode,
      response_type: mode === "none" ? responseType : null,
      prefilled_question: mode === "prefilled" ? prefilledQuestion.trim() : null,
      prefilled_sub_purposes: mode === "prefilled" ? prefilledSubPurposes.trim() : null,
      template_analysis_id: mode === "template" ? templateAnalysisId : null,
    });
    if (error || !data?.id) {
      setBusy(false);
      toast.error("Could not create assignment");
      return;
    }

    // Upload attachments (if any) — failure here doesn't roll back the assignment
    if (files.length) {
      const res = await uploadAttachments("assignment", data.id, files);
      if (!res.ok) {
        setBusy(false);
        toast.warning("Assignment created, but attachments failed. You can add them from the assignment page.");
        reset();
        setOpen(false);
        return;
      }
    }

    setBusy(false);
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

          <FileAttachmentInput value={files} onChange={setFiles} label="Attachments (optional)" />

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
                <SelectItem value="none">No house — direct response</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === "empty" && "Student gets a blank house tagged to this assignment."}
              {mode === "prefilled" && "Student gets a house with the overarching question already filled in."}
              {mode === "template" && "Student gets a full clone of one of your houses to fill in."}
              {mode === "none" && "No house is created. Student responds directly to your prompt."}
            </p>
          </div>

          {mode === "none" && (
            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
              <Label>How should students respond?</Label>
              <RadioGroup value={responseType} onValueChange={(v) => setResponseType(v as "acknowledge" | "text")}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="acknowledge" id="rt-ack" className="mt-1" />
                  <label htmlFor="rt-ack" className="text-sm cursor-pointer flex-1">
                    <span className="font-medium text-foreground">Acknowledge</span>
                    <span className="block text-xs text-muted-foreground">Students click "Mark Done" — useful for readings or announcements.</span>
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="text" id="rt-text" className="mt-1" />
                  <label htmlFor="rt-text" className="text-sm cursor-pointer flex-1">
                    <span className="font-medium text-foreground">Written response</span>
                    <span className="block text-xs text-muted-foreground">Students type a response and can attach files.</span>
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

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
