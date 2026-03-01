import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface TodoPanelProps {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  onNavigate: (path: string) => void;
}

interface TodoItem {
  label: string;
  section: string;
  required: boolean;
  path?: string;
}

export default function TodoPanel({ analysis, subQuestions, onNavigate }: TodoPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const todos: TodoItem[] = [];

  // Required sections
  if (!analysis.overarching_question?.trim()) {
    todos.push({ label: "Add overarching question", section: "question", required: true });
  }
  if (subQuestions.length === 0) {
    todos.push({ label: "Add sub-questions", section: "subQuestions", required: true, path: `/analysis/${analysis.id}/sub-questions` });
  }
  // Check if any sub-question has assumptions
  const hasAssumptions = subQuestions.some(sq => sq.information?.trim());
  if (subQuestions.length > 0 && !hasAssumptions) {
    todos.push({ label: "Add assumptions to sub-questions", section: "assumptions", required: true, path: `/analysis/${analysis.id}/sub-questions` });
  }

  // Optional sections — only show if partially started
  if (!analysis.purpose?.trim() && analysis.sub_purposes?.trim()) {
    todos.push({ label: "Add purpose", section: "purpose", required: false });
  }
  if (analysis.purpose?.trim() && !analysis.sub_purposes?.trim()) {
    todos.push({ label: "Add sub-purposes", section: "subPurposes", required: false });
  }
  if (!analysis.consequences?.trim() && (analysis.overarching_question?.trim() || subQuestions.length > 0)) {
    todos.push({ label: "Add consequences", section: "consequences", required: false, path: `/analysis/${analysis.id}/consequences` });
  }
  if (!analysis.overarching_conclusion?.trim() && subQuestions.some(sq => sq.sub_conclusion?.trim())) {
    todos.push({ label: "Synthesize overarching conclusion", section: "conclusion", required: false, path: `/analysis/${analysis.id}/synthesis` });
  }

  if (todos.length === 0) return null;

  const requiredTodos = todos.filter(t => t.required);
  const optionalTodos = todos.filter(t => !t.required);

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <AlertCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground flex-1">
          To-Do ({todos.length} {todos.length === 1 ? "item" : "items"})
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {requiredTodos.map((todo, i) => (
            <div
              key={`req-${i}`}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
              onClick={() => todo.path && onNavigate(todo.path)}
            >
              <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
              <span className="flex-1 text-foreground">{todo.label}</span>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
          ))}
          {optionalTodos.map((todo, i) => (
            <div
              key={`opt-${i}`}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
              onClick={() => todo.path && onNavigate(todo.path)}
            >
              <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
              <span className="flex-1 text-muted-foreground">{todo.label}</span>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
