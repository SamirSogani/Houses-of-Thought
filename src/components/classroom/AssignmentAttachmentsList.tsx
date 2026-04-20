import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2 } from "lucide-react";
import {
  useAttachments,
  uploadAttachments,
  downloadAttachment,
  type AttachmentParentType,
} from "@/hooks/useAttachments";
import FileAttachmentInput from "@/components/ui/FileAttachmentInput";
import { toast } from "sonner";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  parentType: AttachmentParentType;
  parentId: string;
  /** Whether the current viewer can add or delete attachments. */
  canManage: boolean;
  title?: string;
  emptyHint?: string;
}

export default function AssignmentAttachmentsList({
  parentType,
  parentId,
  canManage,
  title = "Attachments",
  emptyHint = "No attachments yet.",
}: Props) {
  const { attachments, loading, refresh, remove } = useAttachments(parentType, parentId);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const existingTotal = attachments.reduce((a, x) => a + x.file_size, 0);

  const handleUpload = async () => {
    if (!pending.length) return;
    setBusy(true);
    const res = await uploadAttachments(parentType, parentId, pending);
    setBusy(false);
    if (!res.ok) {
      toast.error(`Upload failed: ${res.error}`);
      return;
    }
    toast.success(`Uploaded ${pending.length} file${pending.length === 1 ? "" : "s"}`);
    setPending([]);
    await refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">{attachments.length} file{attachments.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyHint}</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm border border-border"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1" title={a.file_name}>{a.file_name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{humanSize(a.file_size)}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => downloadAttachment(a.id)}
                aria-label={`Download ${a.file_name}`}
              >
                <Download className="h-4 w-4" />
              </Button>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (confirm(`Delete "${a.file_name}"?`)) await remove(a.id);
                  }}
                  aria-label={`Delete ${a.file_name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="space-y-2 pt-2 border-t border-border">
          <FileAttachmentInput
            value={pending}
            onChange={setPending}
            existingTotalBytes={existingTotal}
            existingCount={attachments.length}
            label="Add more attachments"
          />
          {pending.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleUpload} disabled={busy}>
                {busy ? "Uploading…" : `Upload ${pending.length} file${pending.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
