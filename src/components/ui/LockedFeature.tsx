import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LockedFeatureProps {
  /** When true, render the locked overlay & block interaction. When false, render children unchanged. */
  locked: boolean;
  /** Tooltip text. Defaults to "Not available on Student accounts." */
  message?: string;
  /** Visual size of the lock icon overlay. */
  iconSize?: "sm" | "md";
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a feature UI element. When `locked` is true:
 *  - Reduces opacity
 *  - Blocks all pointer interaction
 *  - Overlays a small 🔒 icon
 *  - Shows a tooltip on hover explaining why
 *
 * When `locked` is false, renders children unchanged with no overhead.
 */
export default function LockedFeature({
  locked,
  message = "Not available on Student accounts.",
  iconSize = "sm",
  className,
  children,
}: LockedFeatureProps) {
  if (!locked) return <>{children}</>;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <div
          className={cn("relative inline-block w-full", className)}
          aria-disabled="true"
        >
          <div className="opacity-50 pointer-events-none select-none">
            {children}
          </div>
          <div className="absolute inset-0 flex items-start justify-end p-1.5 pointer-events-none">
            <div className="bg-background/90 border border-border rounded-full p-1 shadow-sm">
              <Lock className={iconSize === "sm" ? "h-3 w-3 text-muted-foreground" : "h-4 w-4 text-muted-foreground"} />
            </div>
          </div>
          {/* Click-blocker that owns the tooltip trigger area */}
          <div className="absolute inset-0 cursor-not-allowed" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[220px]">
        {message}
      </TooltipContent>
    </Tooltip>
  );
}
