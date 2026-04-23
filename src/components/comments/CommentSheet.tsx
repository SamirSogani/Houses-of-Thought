import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import CommentThread from "./CommentThread";
import type { CommentContextValue } from "@/hooks/useCommentContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: CommentContextValue;
  /** Inline anchor — set to identify a specific block. */
  targetKind: string;
  targetId: string | null;
  /** Human-readable label for the section being commented on. */
  targetLabel: string;
  /** Optional initial draft (used by the highlight-to-comment toolbar). */
  initialDraft?: string;
}

const KIND_LABELS: Record<string, string> = {
  concept: "Concept",
  sub_question: "Sub-question",
  assumption: "Assumption",
  pov_label: "POV label",
  staging_item: "Staging item",
  staging_group: "Staging group",
  consequences: "Consequences",
  implications: "Implications",
  overarching_conclusion: "Overarching conclusion",
  overarching_question: "Overarching question",
  purpose: "Purpose",
  sub_purposes: "Sub-purposes",
  information: "Information / facts",
  sub_conclusion: "Sub-conclusion",
  zone_atmosphere: "Atmosphere — Concepts",
  zone_roof: "Roof — Purpose & 8a/8b",
  zone_ceiling: "Ceiling — Question & Conclusion",
  zone_columns: "Columns — Sub-questions",
};

function prettyKind(k: string) {
  return KIND_LABELS[k] || k.replace(/_/g, " ");
}

export default function CommentSheet({
  open,
  onOpenChange,
  ctx,
  targetKind,
  targetId,
  targetLabel,
  initialDraft,
}: Props) {
  if (!ctx.hasContext || !ctx.assignmentId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Comments</SheetTitle>
          <SheetDescription className="text-xs">
            <span className="font-medium text-foreground">{prettyKind(targetKind)}</span>
            {targetLabel ? <> · <span className="italic">{targetLabel}</span></> : null}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-4">
          <CommentThread
            assignmentId={ctx.assignmentId}
            targetType="inline"
            submissionId={ctx.submissionId}
            analysisId={ctx.analysisId}
            targetKind={targetKind}
            targetId={targetId}
            canPost={ctx.canPost}
            studentCanResolve={ctx.canResolve}
            readOnlyMessage={ctx.readOnlyMessage}
            teacherId={ctx.teacherId}
            initialDraft={initialDraft}
            emptyMessage={
              ctx.isTeacher
                ? "No comments here yet. Leave targeted feedback on this section."
                : ctx.canPost
                  ? "No comments here yet."
                  : "No teacher feedback on this section yet."
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
