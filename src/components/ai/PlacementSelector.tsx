import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PlacementSelectorProps {
  text: string;
  onSelect: (section: string) => void;
  onCancel: () => void;
}

const SECTIONS = [
  { key: "overarching_question", label: "Overarching Question" },
  { key: "purpose", label: "Purpose" },
  { key: "sub_purposes", label: "Sub-Purposes" },
  { key: "sub_question", label: "New Sub-Question" },
  { key: "consequences", label: "Consequences" },
  { key: "overarching_conclusion", label: "Overarching Conclusion" },
];

export default function PlacementSelector({ text, onSelect, onCancel }: PlacementSelectorProps) {
  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2 mr-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-primary">📍 Where should this be implemented?</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground italic truncate">"{text.slice(0, 80)}{text.length > 80 ? "..." : ""}"</p>
      <div className="grid grid-cols-2 gap-1.5">
        {SECTIONS.map((s) => (
          <Button
            key={s.key}
            variant="outline"
            size="sm"
            className="text-xs h-7 justify-start"
            onClick={() => onSelect(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
