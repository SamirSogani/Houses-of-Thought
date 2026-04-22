import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  unread?: number;
  onClick: () => void;
  className?: string;
  size?: "sm" | "xs";
  label?: string;
}

/**
 * Tiny pill button shown next to commentable house elements.
 * Displays the comment count and a red dot when there are unread comments.
 */
export default function CommentPill({ count, unread = 0, onClick, className, size = "xs", label }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative gap-1 px-2 text-muted-foreground hover:text-foreground",
        size === "xs" ? "h-6 text-xs" : "h-7 text-xs",
        className,
      )}
      aria-label={label || `${count} comments${unread ? `, ${unread} unread` : ""}`}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      <span>{count}</span>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
      )}
    </Button>
  );
}
