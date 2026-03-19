import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";

interface DraftInfoPageProps {
  onBack: () => void;
  onDraft: (info: DraftInfo) => void;
  loading: boolean;
  defaultGoal?: string;
}

export interface DraftInfo {
  goal: string;
  background: string;
  stakeholders: string;
  constraints: string;
  subQuestionCount: number; // 0 means "as many as needed"
}

export default function DraftInfoPage({ onBack, onDraft, loading, defaultGoal }: DraftInfoPageProps) {
  const [info, setInfo] = useState<DraftInfo>({
    goal: defaultGoal || "",
    background: "",
    stakeholders: "",
    constraints: "",
    subQuestionCount: 6,
  });

  const update = (field: keyof DraftInfo, value: string | number) =>
    setInfo((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Draft Full House</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Provide background information so the AI can draft a complete House of Reason tailored to your needs.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="goal" className="text-xs font-medium">Goal / Main Question *</Label>
          <Textarea
            id="goal"
            placeholder="What is the core question or goal you want to analyze?"
            value={info.goal}
            onChange={(e) => update("goal", e.target.value)}
            className="text-sm min-h-[60px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="background" className="text-xs font-medium">Background Context</Label>
          <Textarea
            id="background"
            placeholder="What relevant background info should the AI know? (domain, history, prior decisions...)"
            value={info.background}
            onChange={(e) => update("background", e.target.value)}
            className="text-sm min-h-[80px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stakeholders" className="text-xs font-medium">Key Stakeholders / Perspectives</Label>
          <Textarea
            id="stakeholders"
            placeholder="Who are the key people, groups, or perspectives involved?"
            value={info.stakeholders}
            onChange={(e) => update("stakeholders", e.target.value)}
            className="text-sm min-h-[60px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="constraints" className="text-xs font-medium">Constraints / Boundaries</Label>
          <Textarea
            id="constraints"
            placeholder="Any limitations, deadlines, or boundaries to consider?"
            value={info.constraints}
            onChange={(e) => update("constraints", e.target.value)}
            className="text-sm min-h-[60px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="count" className="text-xs font-medium">Number of Sub-Questions</Label>
          <select
            id="count"
            value={info.subQuestionCount}
            onChange={(e) => update("subQuestionCount", parseInt(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value={0}>As many as needed</option>
            {[3, 4, 5, 6, 8, 10, 12, 15, 20].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <Button
          className="w-full gap-2"
          onClick={() => onDraft(info)}
          disabled={loading || !info.goal.trim()}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate Draft
        </Button>
      </div>
    </div>
  );
}
