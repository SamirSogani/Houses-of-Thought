import { useEffect, useRef } from "react";
import CommentSelectionToolbar, { type SelectionPayload } from "./CommentSelectionToolbar";
import type { CommentContextValue } from "@/hooks/useCommentContext";

/**
 * Wraps a region of a page so that:
 *   • Highlighting text inside it shows a Comment / AI-assist toolbar.
 *   • The selected element's nearest [data-comment-kind] + [data-comment-target-id]
 *     ancestor identifies the inline target — we dispatch an "open-inline-comment"
 *     CustomEvent that the matching <InlinePill> picks up and opens itself with the
 *     pre-filled draft.
 *
 * Renders nothing extra when the analysis is not part of an assignment submission
 * or the current viewer cannot post comments.
 */
interface Props {
  ctx: CommentContextValue;
  children: React.ReactNode;
  contextSummary?: string;
  className?: string;
}

export interface OpenInlineCommentDetail {
  kind: string;
  targetId: string | null;
  draft: string;
}

export function dispatchOpenInlineComment(detail: OpenInlineCommentDetail) {
  window.dispatchEvent(new CustomEvent("open-inline-comment", { detail }));
}

export default function SubmissionCommentOverlay({ ctx, children, contextSummary, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const findAnchor = (): { kind: string; targetId: string | null } | null => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const node = sel.getRangeAt(0).commonAncestorContainer;
    let el: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    while (el) {
      const kind = el.getAttribute?.("data-comment-kind");
      if (kind) {
        const id = el.getAttribute("data-comment-target-id");
        return { kind, targetId: id && id !== "null" ? id : null };
      }
      el = el.parentElement;
    }
    return null;
  };

  const handleComment = (payload: SelectionPayload) => {
    const anchor = findAnchor();
    if (!anchor) return;
    dispatchOpenInlineComment({ kind: anchor.kind, targetId: anchor.targetId, draft: payload.draft });
  };

  // The toolbar only appears when there's actually a viewer who can post (otherwise
  // selecting text is just for reading). We render the children regardless so
  // pills still show for read-only viewers.
  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      {children}
      {ctx.hasContext && ctx.canPost && (
        <CommentSelectionToolbar
          containerRef={ref}
          onComment={handleComment}
          enableAI={ctx.isTeacher}
          contextSummary={contextSummary}
        />
      )}
    </div>
  );
}

/**
 * Hook: subscribes an InlinePill to "open-inline-comment" events that match its
 * (kind, targetId) anchor and opens it with the supplied draft.
 */
export function useOpenInlineCommentListener(
  kind: string,
  targetId: string | null,
  onOpen: (draft: string) => void,
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<OpenInlineCommentDetail>;
      if (!ev.detail) return;
      if (ev.detail.kind !== kind) return;
      if ((ev.detail.targetId || null) !== (targetId || null)) return;
      onOpen(ev.detail.draft);
    };
    window.addEventListener("open-inline-comment", handler as EventListener);
    return () => window.removeEventListener("open-inline-comment", handler as EventListener);
  }, [kind, targetId, onOpen]);
}
