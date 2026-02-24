import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";

interface ProposedChangeCardProps {
  action: any;
  onApply: (action: any) => Promise<void>;
  onDismiss: () => void;
}

export default function ProposedChangeCard({ action, onApply, onDismiss }: ProposedChangeCardProps) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(action);
      setApplied(true);
    } catch {
      // Error already handled by parent via toast
    } finally {
      setApplying(false);
    }
  };

  if (applied) {
    return (
      <div className="rounded-lg border border-accent bg-accent/20 p-3 text-sm">
        <p className="text-accent-foreground font-medium">✅ Applied to House</p>
      </div>
    );
  }

  const renderChanges = () => {
    if (action.action === "update_analysis") {
      return Object.entries(action.fields || {}).map(([key, value]) => (
        <div key={key} className="text-xs space-y-0.5">
          <span className="font-semibold capitalize">{key.replace(/_/g, " ")}:</span>
          <p className="text-muted-foreground truncate">{String(value).slice(0, 120)}...</p>
        </div>
      ));
    }
    if (action.action === "update_sub_questions") {
      return (action.operations || []).map((op: any, i: number) => (
        <div key={i} className="text-xs">
          <span className="font-semibold capitalize">{op.op}:</span>{" "}
          <span className="text-muted-foreground">{op.question || op.id || "sub-question"}</span>
        </div>
      ));
    }
    return null;
  };

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-primary">📝 Proposed Change</p>
      <div className="space-y-1">{renderChanges()}</div>
      {action.explanation && (
        <p className="text-xs text-muted-foreground italic">{action.explanation}</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="default" onClick={handleApply} disabled={applying} className="text-xs h-7">
          {applying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Apply to House
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} disabled={applying} className="text-xs h-7">
          <X className="h-3 w-3 mr-1" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
