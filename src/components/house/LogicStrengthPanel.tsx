import { useState, useEffect, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Brain, Eye, BookOpen, Lightbulb, Shield, History, ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { ScrollArea } from "@/components/ui/scroll-area";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface LogicStrengthPanelProps {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  profile: Tables<"profiles"> | null;
  onStartStressTest?: () => void;
}

interface CategoryResult {
  score: number;
  status: "strong" | "needs_improvement" | "problem";
  details: string;
}

interface AnalysisResult {
  score: number;
  categories: {
    evidence_strength: CategoryResult;
    assumption_reliability: CategoryResult;
    logical_consistency: CategoryResult;
    completeness: CategoryResult;
  };
  suggestions: string[];
  reasoning_summary: string;
}

interface HistoryRecord {
  id: string;
  score: number;
  result: AnalysisResult;
  created_at: string;
}

function summarizeInfo(info: string): string {
  if (!info) return "None";
  try {
    const facts = JSON.parse(info);
    if (Array.isArray(facts)) return facts.map((f: any) => f.text || f).join("; ").slice(0, 200);
  } catch {}
  return info.slice(0, 200);
}

function buildAnalysisContext(analysis: Analysis, subQuestions: SubQuestion[], profile: Tables<"profiles"> | null): string {
  let ctx = `Q: ${analysis.overarching_question || "N/A"}\nConclusion: ${analysis.overarching_conclusion || "N/A"}\n`;
  if (subQuestions.length > 0) {
    ctx += `\nSub-Questions (${subQuestions.length}):\n`;
    subQuestions.forEach((sq, i) => {
      ctx += `${i + 1}. [${sq.pov_category}] "${sq.question}" → ${sq.sub_conclusion || "None"} (Info: ${summarizeInfo(sq.information)})\n`;
    });
  }
  return ctx;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Very Strong Reasoning";
  if (score >= 75) return "Strong Reasoning";
  if (score >= 50) return "Moderate Reasoning";
  if (score >= 25) return "Weak Reasoning";
  return "Unsupported Reasoning";
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-destructive";
}

function getProgressColor(score: number): string {
  if (score >= 75) return "[&>div]:bg-green-500";
  if (score >= 50) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-destructive";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "strong") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "needs_improvement") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
  return <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

const categoryIcons: Record<string, typeof Brain> = {
  evidence_strength: BookOpen,
  assumption_reliability: Eye,
  logical_consistency: Brain,
  completeness: Lightbulb,
};

const categoryLabels: Record<string, string> = {
  evidence_strength: "Evidence Strength",
  assumption_reliability: "Assumption Reliability",
  logical_consistency: "Logical Consistency",
  completeness: "Completeness",
};

export default function LogicStrengthPanel({ analysis, subQuestions, profile, onStartStressTest }: LogicStrengthPanelProps) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [improvementsLoading, setImprovementsLoading] = useState<string | null>(null);
  const [view, setView] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryRecord | null>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("test_results")
      .select("*")
      .eq("analysis_id", analysis.id)
      .eq("test_type", "logic_strength")
      .order("created_at", { ascending: false });
    setHistory((data || []).map((d: any) => ({ id: d.id, score: d.score, result: d.result as AnalysisResult, created_at: d.created_at })));
  }, [analysis.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const saveResult = async (data: AnalysisResult) => {
    await supabase.from("test_results").insert({
      analysis_id: analysis.id,
      test_type: "logic_strength",
      result: data as any,
      score: data.score,
    } as any);
    loadHistory();
  };

  const deleteResult = async (id: string) => {
    await supabase.from("test_results").delete().eq("id", id);
    setHistory(prev => prev.filter(h => h.id !== id));
    if (selectedHistory?.id === id) setSelectedHistory(null);
  };

  const analyzeLogic = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const ctx = buildAnalysisContext(analysis, subQuestions, profile);
      const res = await supabase.functions.invoke("analyze-logic", {
        body: { mode: "analyze", analysisContext: ctx },
      });
      if (res.error) throw new Error(res.error.message);
      setResult(res.data);
      setSelectedHistory(null);
      await saveResult(res.data);
      setView("current");
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  const runAiAction = async (mode: string, label: string) => {
    setImprovementsLoading(mode);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const ctx = buildAnalysisContext(analysis, subQuestions, profile);
      const res = await supabase.functions.invoke("analyze-logic", {
        body: { mode, analysisContext: ctx },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      if (data.improvements) toast.success(`${data.improvements.length} improvement suggestions generated.`);
      else if (data.suggested_povs) toast.success(`${data.suggested_povs.length} POV suggestions generated.`);
      else if (data.weak_assumptions) toast.success(`${data.weak_assumptions.length} assumption issues found.`);
      else if (data.suggested_evidence) toast.success(`${data.suggested_evidence.length} evidence suggestions generated.`);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${label}`);
    } finally {
      setImprovementsLoading(null);
    }
  };

  const displayResult = selectedHistory?.result || result;

  const renderResult = (data: AnalysisResult) => (
    <div className="space-y-3">
      <div className="text-center space-y-1">
        <div className={`text-3xl font-display font-bold ${getScoreColor(data.score)}`}>{data.score}</div>
        <Progress value={data.score} className={`h-2 ${getProgressColor(data.score)}`} />
        <p className={`text-xs font-medium ${getScoreColor(data.score)}`}>{getScoreLabel(data.score)}</p>
      </div>
      <div className="space-y-2">
        {Object.entries(data.categories).map(([key, cat]) => {
          const Icon = categoryIcons[key] || Brain;
          return (
            <div key={key} className="bg-muted/50 rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium">{categoryLabels[key]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <StatusIcon status={cat.status} />
                  <span className="text-[10px] font-mono">{cat.score}/25</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{cat.details}</p>
            </div>
          );
        })}
      </div>
      <div className="bg-primary/5 border border-primary/20 rounded p-2">
        <p className="text-[11px] text-foreground leading-relaxed">{data.reasoning_summary}</p>
      </div>
      {data.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Reasoning Feedback</p>
          {data.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground">
              <Lightbulb className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (view === "history") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setView("current"); setSelectedHistory(null); }} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <h3 className="text-sm font-display font-semibold flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" />
            Logic Test History
          </h3>
        </div>
        {selectedHistory ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setSelectedHistory(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back to list
              </button>
              <span className="text-[10px] text-muted-foreground">{new Date(selectedHistory.created_at).toLocaleString()}</span>
            </div>
            {renderResult(selectedHistory.result)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {history.length === 0 && <p className="text-xs text-muted-foreground italic">No previous tests.</p>}
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between bg-muted/50 rounded p-2 cursor-pointer hover:bg-muted" onClick={() => setSelectedHistory(h)}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${getScoreColor(h.score)}`}>{h.score}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteResult(h.id); }} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-semibold flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          Logic Strength
        </h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setView("history")} title="View history">
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={analyzeLogic} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            {displayResult ? "Re-analyze" : "Analyze"}
          </Button>
        </div>
      </div>

      {!displayResult && !loading && (
        <p className="text-xs text-muted-foreground italic">Click "Analyze" to evaluate your reasoning strength.</p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-xs text-muted-foreground">Analyzing reasoning...</span>
        </div>
      )}

      {displayResult && (
        <>
          {renderResult(displayResult)}
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => runAiAction("improve", "improve")} disabled={!!improvementsLoading}>
              {improvementsLoading === "improve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
              Improve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => runAiAction("suggest_evidence", "suggest evidence")} disabled={!!improvementsLoading}>
              {improvementsLoading === "suggest_evidence" ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
              Evidence
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => runAiAction("suggest_povs", "suggest POVs")} disabled={!!improvementsLoading}>
              {improvementsLoading === "suggest_povs" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              POVs
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => runAiAction("strengthen_assumptions", "strengthen assumptions")} disabled={!!improvementsLoading}>
              {improvementsLoading === "strengthen_assumptions" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
              Assumptions
            </Button>
          </div>
          {onStartStressTest && (
            <Button size="sm" variant="default" className="w-full h-8 text-xs gap-1.5" onClick={onStartStressTest}>
              <Shield className="h-3.5 w-3.5" />
              Run Stress Test
            </Button>
          )}
        </>
      )}

      {history.length > 0 && (
        <button onClick={() => setView("history")} className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center py-1">
          View {history.length} previous test{history.length !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
