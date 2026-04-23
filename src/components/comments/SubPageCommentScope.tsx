import { useCommentContext, type CommentContextValue } from "@/hooks/useCommentContext";
import SubmissionCommentOverlay from "./SubmissionCommentOverlay";

/**
 * Sub-page convenience wrapper.
 *
 * Resolves the comment context for the given analysisId and, when the analysis
 * belongs to a submission, wraps children in a SubmissionCommentOverlay so
 * highlight-to-comment + AI-assist work. Always exposes the resolved context to
 * children via render prop so the page can render its per-item <InlinePill>s.
 *
 * When the analysis is NOT part of a submission (the author's normal editing
 * flow), children render unchanged with `ctx.hasContext === false`, and pills
 * suppress themselves automatically.
 */
interface Props {
  analysisId: string | undefined;
  contextSummary?: string;
  className?: string;
  children: (ctx: CommentContextValue) => React.ReactNode;
}

export default function SubPageCommentScope({ analysisId, contextSummary, className, children }: Props) {
  const ctx = useCommentContext(analysisId);
  if (!ctx.hasContext) return <>{children(ctx)}</>;
  return (
    <SubmissionCommentOverlay ctx={ctx} contextSummary={contextSummary} className={className}>
      {children(ctx)}
    </SubmissionCommentOverlay>
  );
}
