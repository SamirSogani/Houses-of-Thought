import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import AssignmentAttachmentsList from "./AssignmentAttachmentsList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
  studentLabel: string;
}

export default function SubmissionResponseDialog({ open, onOpenChange, submissionId, studentLabel }: Props) {
  const [responseText, setResponseText] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !submissionId) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("assignment_submissions")
        .select("response_text, status, submitted_at")
        .eq("id", submissionId)
        .maybeSingle();
      setResponseText(data?.response_text ?? "");
      setStatus(data?.status ?? "");
      setSubmittedAt(data?.submitted_at ?? null);
      setLoading(false);
    })();
  }, [open, submissionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Response from {studentLabel}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {status === "submitted" ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Submitted</Badge>
              ) : (
                <Badge variant="secondary">In progress</Badge>
              )}
              {submittedAt && <span>{new Date(submittedAt).toLocaleString()}</span>}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Written response</h4>
              {responseText ? (
                <p className="text-sm text-foreground whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3">
                  {responseText}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">(No written response.)</p>
              )}
            </div>

            {submissionId && (
              <AssignmentAttachmentsList
                parentType="submission"
                parentId={submissionId}
                canManage={false}
                title="Student's uploaded files"
                emptyHint="No files uploaded with this response."
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
