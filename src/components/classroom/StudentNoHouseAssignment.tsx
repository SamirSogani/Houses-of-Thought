import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, CheckCircle2, FileText, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FileAttachmentInput from "@/components/ui/FileAttachmentInput";
import AssignmentAttachmentsList from "./AssignmentAttachmentsList";
import { uploadAttachments } from "@/hooks/useAttachments";
import type { AssignmentRow, SubmissionRow } from "@/hooks/useAssignments";

interface Props {
  assignment: AssignmentRow & { response_type?: "acknowledge" | "text" | null };
  submission: (SubmissionRow & { response_text?: string | null }) | null;
  onStart: (assignmentId: string) => Promise<{ data: any; error: any }>;
  onSubmit: (submissionId: string) => Promise<{ data: any; error: any }>;
  onUnsubmit: (submissionId: string) => Promise<{ data: any; error: any }>;
}

function formatDue(due: string | null) {
  if (!due) return "No due date";
  return new Date(due).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function StudentNoHouseAssignment({ assignment, submission, onStart, onSubmit, onUnsubmit }: Props) {
  const [responseText, setResponseText] = useState(submission?.response_text ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    setResponseText(submission?.response_text ?? "");
  }, [submission?.id, submission?.response_text]);

  const responseType = assignment.response_type ?? "text";
  const status: "not_started" | "in_progress" | "submitted" = !submission
    ? "not_started"
    : submission.status === "submitted"
    ? "submitted"
    : "in_progress";

  const ensureSubmission = async (): Promise<string | null> => {
    if (submission?.id) return submission.id;
    const { data, error } = await onStart(assignment.id);
    if (error || !(data as any)?.ok) {
      toast.error("Could not start assignment");
      return null;
    }
    return (data as any).submission_id as string;
  };

  const saveDraft = async () => {
    if (!submission?.id) return;
    setSavingDraft(true);
    const { error } = await (supabase as any)
      .from("assignment_submissions")
      .update({ response_text: responseText })
      .eq("id", submission.id);
    setSavingDraft(false);
    if (error) toast.error("Could not save draft");
    else toast.success("Draft saved");
  };

  const handleAcknowledge = async () => {
    setBusy(true);
    const subId = await ensureSubmission();
    if (!subId) { setBusy(false); return; }
    const { error } = await onSubmit(subId);
    setBusy(false);
    if (error) toast.error("Could not submit");
    else toast.success("Marked as done");
  };

  const handleTextSubmit = async () => {
    if (!responseText.trim() && !pendingFiles.length) {
      toast.error("Add a response or attach a file before submitting");
      return;
    }
    setBusy(true);
    const subId = await ensureSubmission();
    if (!subId) { setBusy(false); return; }

    // Save the text first
    const { error: upErr } = await (supabase as any)
      .from("assignment_submissions")
      .update({ response_text: responseText })
      .eq("id", subId);
    if (upErr) {
      setBusy(false);
      toast.error("Could not save response");
      return;
    }

    // Upload files (if any) attached to this submission
    if (pendingFiles.length) {
      const res = await uploadAttachments("submission", subId, pendingFiles);
      if (!res.ok) {
        setBusy(false);
        toast.error(`Files failed to upload: ${res.error}`);
        return;
      }
      setPendingFiles([]);
    }

    const { error } = await onSubmit(subId);
    setBusy(false);
    if (error) toast.error("Could not submit");
    else toast.success("Response submitted");
  };

  const handleUnsubmit = async () => {
    if (!submission?.id) return;
    const { error } = await onUnsubmit(submission.id);
    if (error) toast.error("Could not withdraw");
    else toast.success("Submission withdrawn — you can edit and resubmit");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-lg font-display">{assignment.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" /> {responseType === "acknowledge" ? "Acknowledge" : "Written response"}
              </Badge>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> {formatDue(assignment.due_at)}
              </span>
              {status === "submitted" && (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Submitted
                </Badge>
              )}
              {status === "in_progress" && <Badge variant="outline">In progress</Badge>}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignment.prompt && (
          <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.prompt}</p>
        )}

        <AssignmentAttachmentsList
          parentType="assignment"
          parentId={assignment.id}
          canManage={false}
          title="From your teacher"
          emptyHint="No attachments from your teacher."
        />

        {responseType === "acknowledge" ? (
          <div className="flex justify-end gap-2">
            {status === "submitted" ? (
              <Button variant="ghost" size="sm" onClick={handleUnsubmit}>Undo</Button>
            ) : (
              <Button onClick={handleAcknowledge} disabled={busy}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> {busy ? "Marking…" : "Mark Done"}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Your response</label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write your response here…"
                rows={5}
                disabled={status === "submitted"}
              />
            </div>

            {status !== "submitted" && (
              <FileAttachmentInput
                value={pendingFiles}
                onChange={setPendingFiles}
                label="Attach files (optional)"
              />
            )}

            {/* If already started, also show any files the student has uploaded */}
            {submission?.id && (
              <AssignmentAttachmentsList
                parentType="submission"
                parentId={submission.id}
                canManage={status !== "submitted"}
                title="Your uploaded files"
                emptyHint="You haven't uploaded any files yet."
              />
            )}

            <div className="flex justify-end gap-2">
              {status === "submitted" ? (
                <Button variant="ghost" size="sm" onClick={handleUnsubmit}>Unsubmit to edit</Button>
              ) : (
                <>
                  {submission?.id && (
                    <Button variant="outline" size="sm" onClick={saveDraft} disabled={savingDraft}>
                      {savingDraft ? "Saving…" : "Save draft"}
                    </Button>
                  )}
                  <Button onClick={handleTextSubmit} disabled={busy}>
                    <Send className="h-4 w-4 mr-1" /> {busy ? "Submitting…" : "Submit"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
