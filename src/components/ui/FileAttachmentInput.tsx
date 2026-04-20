import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Paperclip, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const ATTACHMENT_LIMITS = {
  MAX_FILE_SIZE: 15 * 1024 * 1024,
  MAX_FILES: 8,
  MAX_TOTAL: 40 * 1024 * 1024,
};

export const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/markdown",
  "application/rtf",
  "text/rtf",
  // Slides
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/heic",
  // Audio
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
];

const ALLOWED_SET = new Set(ALLOWED_MIME_TYPES);

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  value: File[];
  onChange: (files: File[]) => void;
  /** Optional bytes already attached on the parent record (counts toward MAX_TOTAL). */
  existingTotalBytes?: number;
  /** Optional count of files already attached on the parent record (counts toward MAX_FILES). */
  existingCount?: number;
  className?: string;
  disabled?: boolean;
  label?: string;
}

export default function FileAttachmentInput({
  value,
  onChange,
  existingTotalBytes = 0,
  existingCount = 0,
  className,
  disabled = false,
  label = "Attachments",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;
      const next = [...value];
      let currentTotal = existingTotalBytes + next.reduce((a, f) => a + f.size, 0);

      for (const f of incoming) {
        if (next.length + existingCount >= ATTACHMENT_LIMITS.MAX_FILES) {
          toast.error(`Max ${ATTACHMENT_LIMITS.MAX_FILES} files per upload`);
          break;
        }
        if (!ALLOWED_SET.has(f.type)) {
          toast.error(`"${f.name}" — file type not allowed`);
          continue;
        }
        if (f.size > ATTACHMENT_LIMITS.MAX_FILE_SIZE) {
          toast.error(`"${f.name}" exceeds 15 MB`);
          continue;
        }
        if (currentTotal + f.size > ATTACHMENT_LIMITS.MAX_TOTAL) {
          toast.error("Total attachments would exceed 40 MB");
          break;
        }
        // Dedupe by name + size
        if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
        next.push(f);
        currentTotal += f.size;
      }
      onChange(next);
    },
    [value, onChange, existingTotalBytes, existingCount]
  );

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    // Reset so picking the same file again still fires onChange
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    addFiles(dropped);
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          Up to {ATTACHMENT_LIMITS.MAX_FILES} files · 15 MB each · 40 MB total
        </span>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-md border-2 border-dashed p-3 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          disabled && "opacity-60 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {dragOver ? "Drop files to attach" : "Drag files here or click the paperclip"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4 mr-1" /> Attach
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_MIME_TYPES.join(",")}
            className="hidden"
            onChange={handlePick}
            disabled={disabled}
          />
        </div>

        {value.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {value.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-sm border border-border"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1" title={f.name}>{f.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{humanSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
