import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import CommentThread from "./CommentThread";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  submissionId: string;
  analysisId: string;
  targetKind: string;
  targetId: string | null;
  /** Display label for the section being commented on. */
  targetLabel: string;
  /** Whether the current user can post on this thread. */
  canPost: boolean;
  /** Whether the current user is a student who can resolve. */
  studentCanResolve?: boolean;
  readOnlyMessage?: string;
}

export default function InlineCommentDrawer(props: Props) {
  const {
    open,
    onOpenChange,
    assignmentId,
    submissionId,
    analysisId,
    targetKind,
    targetId,
    targetLabel,
    canPost,
    studentCanResolve,
    readOnlyMessage,
  } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Comments</SheetTitle>
          <SheetDescription className="text-xs">
            <span className="capitalize">{targetKind.replace(/_/g, " ")}</span> · {targetLabel}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-4">
          <CommentThread
            assignmentId={assignmentId}
            targetType="inline"
            submissionId={submissionId}
            analysisId={analysisId}
            targetKind={targetKind}
            targetId={targetId}
            canPost={canPost}
            studentCanResolve={studentCanResolve}
            readOnlyMessage={readOnlyMessage}
            emptyMessage="No comments on this section yet."
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
