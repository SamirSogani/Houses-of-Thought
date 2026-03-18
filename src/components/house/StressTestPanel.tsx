import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Shield, Swords, CheckCircle2, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface StressTestPanelProps {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  profile: Tables<"profiles"> | null;
  onBack?: () => void;
}

interface Vulnerability {
  target: string;
  counter_argument: string;
  severity: "strong" | "needs_review" | "weak";
  pov: string;
  suggestion: string;
}

interface StressResult {
  vulnerabilities: Vulnerability[];
  resilience_score: number;
  overall_assessment: string;
}

function buildContext(analysis: Analysis, subQuestions: SubQuestion[], profile: Tables<"profiles"> | null): string {
  let ctx = `Title: ${analysis.title}\nPurpose: ${analysis.purpose || "N/A"}\nQuestion: ${analysis.overarching_question || "N/A"}\nConclusion: ${analysis.overarching_conclusion || "N/A"}\nConsequences: ${analysis.consequences || "N/A"}\n\n`;
  if (profile) {
    ctx += `POV: Bio=${profile.biological}, Social=${profile.social}, Familial=${profile.familial}, Individual=${profile.individual}\n\n`;
  }
  subQuestions.forEach((sq, i) => {
    ctx += `SQ${i + 1} [${sq.pov_category}]: "${sq.question}" Info: ${sq.information || "None"} Conclusion: ${sq.sub_conclusion || "None"}\n`;
  });
  return ctx;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "strong") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (severity === "needs_review") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
  return <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const label = severity === "strong" ? "Strong" : severity === "needs_review" ? "Needs Review" : "Weak";
  const variant = severity === "strong" ? "default" : severity === "needs_review" ? "secondary" : "destructive";
  return <Badge variant={variant} className="text-[9px] h-4">{label}</Badge>;
}

export default function StressTestPanel({ analysis, subQuestions, profile, onBack }: StressTestPanelProps) {
  const [result, setResult] = useState<StressResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [attackMode, setAttackMode] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const ctx = buildContext(analysis, subQuestions, profile);
      const mode = attackMode ? "stress_test" : "stress_test";
      const attackCtx = attackMode
        ? ctx + "\n\nATTACK MODE: Be aggressive. Simulate a formal debate opponent. Challenge EVERY assumption and conclusion from the strongest opposing position. Score resilience harshly."
        : ctx;

      const res = await supabase.functions.invoke("analyze-logic", {
        body: { mode, analysisContext: attackCtx },
      });

      if (res.error) throw new Error(res.error.message);
      setResult(res.data);
    } catch (err: any) {
      toast.error(err.message || "Stress test failed");
    } finally {
      setLoading(false);
    }
  };

  const resilienceColor = (score: number) => {
    if (score >= 75) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-destructive";
  };

  const resilienceProgressColor = (score: number) => {
    if (score >= 75) return "[&>div]:bg-green-500";
    if (score >= 50) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-destructive";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {onBack && (
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <h3 className="text-sm font-display font-semibold flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            Stress Test
          </h3>
        </div>
      </div>

      {/* Attack Mode Toggle */}
      <div className="flex items-center justify-between bg-muted/50 rounded p-2">
        <div className="flex items-center gap-1.5">
          <Swords className="h-3.5 w-3.5 text-destructive" />
          <span className="text-[11px] font-medium">AI Attack Mode</span>
        </div>
        <button
          onClick={() => setAttackMode(!attackMode)}
          className={`w-8 h-4 rounded-full transition-colors relative ${attackMode ? "bg-destructive" : "bg-muted-foreground/30"}`}
        >
          <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${attackMode ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>

      <Button size="sm" variant={attackMode ? "destructive" : "outline"} className="w-full h-8 text-xs gap-1.5" onClick={runTest} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
        {loading ? "Testing..." : attackMode ? "Launch Attack" : "Run Stress Test"}
      </Button>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-xs text-muted-foreground">{attackMode ? "Simulating debate..." : "Testing resilience..."}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Resilience Score */}
          <div className="text-center space-y-1">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Resilience Score</p>
            <div className={`text-2xl font-display font-bold ${resilienceColor(result.resilience_score)}`}>
              {result.resilience_score}
            </div>
            <Progress value={result.resilience_score} className={`h-1.5 ${resilienceProgressColor(result.resilience_score)}`} />
          </div>

          {/* Assessment */}
          <div className="bg-primary/5 border border-primary/20 rounded p-2">
            <p className="text-[10px] text-foreground leading-relaxed break-words whitespace-pre-wrap">{result.overall_assessment}</p>
          </div>

          {/* Vulnerabilities */}
          {result.vulnerabilities.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">Vulnerabilities Found ({result.vulnerabilities.length})</p>
              {result.vulnerabilities.map((v, i) => (
                <div key={i} className="bg-card border border-border rounded p-2 space-y-1.5 overflow-hidden">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <SeverityIcon severity={v.severity} />
                      <span className="text-[10px] font-medium break-words min-w-0">{v.target}</span>
                    </div>
                    <SeverityBadge severity={v.severity} />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{v.counter_argument}</p>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] h-4">{v.pov}</Badge>
                  </div>
                  <div className="bg-muted/50 rounded p-1.5">
                    <p className="text-[9px] text-muted-foreground"><span className="font-medium">Suggestion:</span> {v.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
