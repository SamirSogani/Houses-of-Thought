import { Button } from "@/components/ui/button";
import { Plus, Trash2, Clock, CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DraftRun {
  id: string;
  status: string;
  draft_info: any;
  iterations: number;
  sub_questions_generated: number;
  final_logic_score: number;
  final_resilience_score: number;
  log_messages: string[];
  created_at: string;
}

interface DraftHistoryViewProps {
  runs: DraftRun[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onDeleteRun: (id: string) => void;
  onNewDraft: () => void;
  onBack: () => void;
}

export default function DraftHistoryView({ runs, selectedRunId, onSelectRun, onDeleteRun, onNewDraft, onBack }: DraftHistoryViewProps) {
  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm flex-1">Draft History</span>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onNewDraft}>
          <Plus className="h-3.5 w-3.5" /> New Draft
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {runs.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12 px-4">
            <p>No draft runs yet.</p>
            <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={onNewDraft}>
              <Plus className="h-3.5 w-3.5" /> Start First Draft
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {runs.map((run) => (
              <div
                key={run.id}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                  selectedRunId === run.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
                onClick={() => onSelectRun(run.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(run.status)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {run.draft_info?.goal ? `"${run.draft_info.goal.slice(0, 50)}${run.draft_info.goal.length > 50 ? "..." : ""}"` : "Draft Run"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleDateString()} · {run.sub_questions_generated} SQs · {run.iterations} rounds
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDeleteRun(run.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {run.status === "completed" && (
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span>Logic: <strong className="text-foreground">{run.final_logic_score}/100</strong></span>
                    <span>Resilience: <strong className="text-foreground">{run.final_resilience_score}/100</strong></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function DraftRunDetail({ run, onBack }: { run: DraftRun; onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm flex-1 truncate">
          {run.draft_info?.goal?.slice(0, 40) || "Draft Run"}
        </span>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
          {/* Summary */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{run.status}</p>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground">Sub-Questions</p>
                <p className="font-medium">{run.sub_questions_generated}</p>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground">Logic Score</p>
                <p className="font-medium">{run.final_logic_score}/100</p>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground">Resilience</p>
                <p className="font-medium">{run.final_resilience_score}/100</p>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground">Iterations</p>
                <p className="font-medium">{run.iterations}</p>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium">{new Date(run.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Input */}
          {run.draft_info && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Input</h4>
              <div className="bg-muted rounded-md px-3 py-2 text-sm space-y-1">
                <p><span className="text-muted-foreground">Goal:</span> {run.draft_info.goal}</p>
                {run.draft_info.background && <p><span className="text-muted-foreground">Background:</span> {run.draft_info.background}</p>}
                {run.draft_info.stakeholders && <p><span className="text-muted-foreground">Stakeholders:</span> {run.draft_info.stakeholders}</p>}
                {run.draft_info.constraints && <p><span className="text-muted-foreground">Constraints:</span> {run.draft_info.constraints}</p>}
                <p><span className="text-muted-foreground">Sub-Q Count:</span> {run.draft_info.subQuestionCount === 0 ? "As many as needed" : run.draft_info.subQuestionCount}</p>
              </div>
            </div>
          )}

          {/* Log */}
          {run.log_messages && run.log_messages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity Log</h4>
              <div className="space-y-1">
                {run.log_messages.map((msg, i) => (
                  <div key={i} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
