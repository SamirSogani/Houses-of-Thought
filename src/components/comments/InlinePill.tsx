import { useMemo, useState } from "react";
import CommentPill from "./CommentPill";
import CommentSheet from "./CommentSheet";
import { useComments } from "@/hooks/useComments";
import { useUnreadComments } from "@/hooks/useUnreadComments";
import { useAuth } from "@/hooks/useAuth";
import type { CommentContextValue } from "@/hooks/useCommentContext";

interface Props {
  ctx: CommentContextValue;
  targetKind: string;
  /** Stable id of the row being commented on. Pass `null` for whole-zone targets. */
  targetId: string | null;
  /** Human-readable label shown in the sheet header. */
  targetLabel: string;
  className?: string;
  size?: "xs" | "sm";
  /** Optional ref-style trigger (used by selection toolbar to programmatically open). */
  initialDraft?: string;
  /** When true the pill is rendered open immediately. Used by the selection toolbar. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Self-contained inline pill that:
 *   • fetches its own thread count for this anchor
 *   • shows an unread red dot for the current user
 *   • opens the comment sheet on click
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
  const setOpen = (v: boolean) => {
    setOpenInternal(v);
    onOpenChange?.(v);
  };
  const { comments } = useComments({
    assignmentId: ctx.assignmentId || undefined,
    targetType: "inline",
    submissionId: ctx.submissionId,
    analysisId: ctx.analysisId,
    targetKind,
    targetId,
  });
  const { rows } = useUnreadComments();

  const unreadIds = useMemo(() => {
    if (!user) return new Set<string>();
    const visibleIds = new Set(comments.filter((c) => c.author_id !== user.id).map((c) => c.id));
    // We can't get per-thread unread without a join; approximate by using the
    // submission-level unread bucket and filtering to the ids we currently see.
    // The rpc returns ids grouped by submission only, so fall back to "any unread
    // on this submission" → mark dot if at least one of *our* visible comments is
    // newer than our last read. As a simpler heuristic we just say: if there's any
    // unread in this submission AND we have other-author comments, show the dot.
    const subUnread = rows
      .filter((r) => r.submission_id === ctx.submissionId)
      .reduce((a, r) => a + r.count, 0);
    if (subUnread > 0 && visibleIds.size > 0) return visibleIds;
    return new Set<string>();
  }, [comments, rows, user, ctx.submissionId]);

  if (!ctx.hasContext) return null;

  const count = comments.length;
  const unread = unreadIds.size;

  return (
    <>
      <CommentPill
        count={count}
        unread={unread}
        onClick={() => setOpen(true)}
        className={className}
        size={size}
        label={`${count} comments on ${targetLabel}`}
      />
      <CommentSheet
        open={open}
        onOpenChange={setOpen}
        ctx={ctx}
        targetKind={targetKind}
        targetId={targetId}
        targetLabel={targetLabel}
        initialDraft={initialDraft}
      />
    </>
  );
}
