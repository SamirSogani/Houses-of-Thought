import { useMemo, useState } from "react";
import CommentPill from "./CommentPill";
import CommentSheet from "./CommentSheet";
import { useComments } from "@/hooks/useComments";
import { useUnreadComments } from "@/hooks/useUnreadComments";
import { useAuth } from "@/hooks/useAuth";
import { useOpenInlineCommentListener } from "./SubmissionCommentOverlay";
import type { CommentContextValue } from "@/hooks/useCommentContext";

interface Props {
  ctx: CommentContextValue;
  targetKind: string;
  targetId: string | null;
  targetLabel: string;
  className?: string;
  size?: "xs" | "sm";
  initialDraft?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Self-contained inline pill that fetches its own thread count, shows an unread
 * dot, opens a side sheet on click, and listens for selection-toolbar events
 * targeting its (kind, targetId) anchor.
 *
 * Renders nothing when the analysis is not part of an assignment submission.
 */
export default function InlinePill({
  ctx,
  targetKind,
  targetId,
  targetLabel,
  className,
  size = "xs",
  initialDraft,
  defaultOpen,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const [open, setOpenInternal] = useState(!!defaultOpen);
  const [draft, setDraft] = useState<string | undefined>(initialDraft);
  const setOpen = (v: boolean) => {
    setOpenInternal(v);
    if (!v) setDraft(undefined);
    onOpenChange?.(v);
  };

  useOpenInlineCommentListener(targetKind, targetId, (incomingDraft) => {
    setDraft(incomingDraft);
    setOpenInternal(true);
    onOpenChange?.(true);
  });

  const { comments } = useComments({
    assignmentId: ctx.assignmentId || undefined,
    targetType: "inline",
    submissionId: ctx.submissionId,
    analysisId: ctx.analysisId,
    targetKind,
    targetId,
  });
  const { rows } = useUnreadComments();

  const unreadCount = useMemo(() => {
    if (!user) return 0;
    const visible = comments.filter((c) => c.author_id !== user.id).length;
    if (!visible) return 0;
    const subUnread = rows
      .filter((r) => r.submission_id === ctx.submissionId)
      .reduce((a, r) => a + r.count, 0);
    return subUnread > 0 ? Math.min(visible, subUnread) : 0;
  }, [comments, rows, user, ctx.submissionId]);

  if (!ctx.hasContext) return null;

  return (
    <>
      <CommentPill
        count={comments.length}
        unread={unreadCount}
        onClick={() => setOpen(true)}
        className={className}
        size={size}
        label={`${comments.length} comments on ${targetLabel}`}
      />
      <CommentSheet
        open={open}
        onOpenChange={setOpen}
        ctx={ctx}
        targetKind={targetKind}
        targetId={targetId}
        targetLabel={targetLabel}
        initialDraft={draft}
      />
    </>
  );
}
