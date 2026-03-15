import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type SubQuestion = Tables<"sub_questions">;
type Analysis = Tables<"analyses">;

const POV_LABELS: Record<string, string> = {
  individual: "Individual",
  group: "Group",
  ideas_disciplines: "Ideas & Disciplines",
};

const POV_CLASSES: Record<string, string> = {
  individual: "pov-individual border-2",
  group: "pov-group border-2",
  ideas_disciplines: "pov-ideas border-2",
};

export default function ConsequencesPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [implications, setImplications] = useState("");

  useEffect(() => {
    loadData();
  }, [analysisId]);

  const loadData = async () => {
    const [aRes, sqRes] = await Promise.all([
      supabase.from("analyses").select("*").eq("id", analysisId!).maybeSingle(),
      supabase.from("sub_questions").select("*").eq("analysis_id", analysisId!).order("sort_order"),
    ]);
    setAnalysis(aRes.data);
    setSubQuestions(sqRes.data || []);
    // Load implications from consequences field (stored together)
    if (aRes.data) {
      try {
        const parsed = JSON.parse(aRes.data.consequences || "{}");
        setImplications(parsed.implications || "");
        // Keep consequences as user-entered text
      } catch {
        // Legacy: if consequences is plain text, treat as user-entered consequences
        setImplications("");
      }
    }
  };

  const updateConsequences = async (consequences: string, newImplications?: string) => {
    const impl = newImplications !== undefined ? newImplications : implications;
    const stored = JSON.stringify({ consequences, implications: impl });
    setAnalysis((prev) => (prev ? { ...prev, consequences: stored } : prev));
    await supabase
      .from("analyses")
      .update({ consequences: stored, updated_at: new Date().toISOString() })
      .eq("id", analysisId!);
  };

  const getUserConsequences = (): string => {
    if (!analysis?.consequences) return "";
    try {
      const parsed = JSON.parse(analysis.consequences);
      return parsed.consequences || "";
    } catch {
      return analysis.consequences || "";
    }
  };

  const setUserConsequences = (value: string) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      const stored = JSON.stringify({ consequences: value, implications });
      return { ...prev, consequences: stored };
    });
    const stored = JSON.stringify({ consequences: value, implications });
    supabase
      .from("analyses")
      .update({ consequences: stored, updated_at: new Date().toISOString() })
      .eq("id", analysisId!);
  };

  const generateImplications = async () => {
    if (!analysis || generating) return;
    setGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const userConsequences = getUserConsequences();

      const subConclusionsSummary = subQuestions
        .filter(sq => sq.sub_conclusion)
        .map((sq, i) => `${i + 1}. [${sq.pov_category}] "${sq.question}" → ${sq.sub_conclusion}`)
        .join("\n");

      const systemPrompt = `You are the House of Reason AI. Generate predicted implications (predicted consequences).

Given the user's overarching conclusion, predict what SHOULD logically follow if the conclusion is correct. These are PREDICTED outcomes — forward-looking projections, NOT summaries of existing reasoning.

${userConsequences ? `The user has already entered ACTUAL consequences that have unfolded. Use these to REFINE and UPDATE your predictions — acknowledge what has already happened and predict what may follow next.\n\nActual Consequences (entered by user):\n${userConsequences}\n` : ""}

Rules:
- Focus on predictive, forward-looking implications
- Cover short-term, medium-term, and long-term predictions
- Consider implications across individual, group, and systemic levels
- Be specific and substantive — no vague generalities
- If actual consequences are provided, distinguish between confirmed outcomes and remaining predictions
- Format as clear numbered points grouped by timeframe or category
- Write in flowing prose paragraphs, not just bullet lists

## Current Analysis: "${analysis.title}"
- Overarching Question: ${analysis.overarching_question || "Not set"}
- Overarching Conclusion: ${analysis.overarching_conclusion || "Not set"}
- Purpose: ${analysis.purpose || "Not set"}

## Sub-Conclusions:
${subConclusionsSummary || "None yet"}`;

      const res = await supabase.functions.invoke("groq-chat", {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Based on the overarching conclusion "${analysis.overarching_conclusion || analysis.overarching_question}", generate comprehensive predicted implications. What should logically follow if this conclusion is correct?${userConsequences ? " Factor in the actual consequences already entered." : ""}` },
          ],
          mode: "chat",
        },
      });

      if (res.error) throw new Error(res.error.message);
      const reply = res.data?.choices?.[0]?.message?.content || "";

      if (reply) {
        setImplications(reply);
        await updateConsequences(getUserConsequences(), reply);
        toast.success("Predicted implications generated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate implications");
    } finally {
      setGenerating(false);
    }
  };

  if (!analysis) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  const grouped = subQuestions.reduce<Record<string, SubQuestion[]>>((acc, sq) => {
    const key = sq.pov_category || "individual";
    if (!acc[key]) acc[key] = [];
    acc[key].push(sq);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container max-w-6xl">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate(`/analysis/${analysisId}`)} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {analysis.title}
          </button>
          <span>/</span>
          <span className="text-foreground">Consequences & Implications</span>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Consequences & Implications</h1>
        <p className="text-muted-foreground mb-8">
          Element 8 — Enter actual consequences as they unfold, and generate AI-predicted implications
        </p>

        {/* POV Reference Cards */}
        <div className="space-y-6 mb-8">
          {Object.entries(grouped).map(([pov, questions]) => (
            <div key={pov}>
              <h2 className="text-lg font-display font-semibold mb-3">{POV_LABELS[pov] || pov}</h2>
              <div className="space-y-2">
                {questions.map((sq) => (
                  <Card key={sq.id} className={`${POV_CLASSES[pov] || ""} opacity-80`}>
                    <CardContent className="pt-3 pb-3">
                      <p className="font-medium text-sm">{sq.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sq.sub_conclusion || "No conclusion yet"}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Consequences — User-entered only */}
        <Card className="house-zone house-zone-roof mb-6">
          <CardHeader>
            <CardTitle className="text-xl font-display">Consequences (Actual Outcomes)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Enter real-world consequences as they unfold. These are actual outcomes — not predictions. Updating these will refine the AI's predicted implications.
            </p>
            <Textarea
              placeholder="What has actually happened as a result of this conclusion? Enter observed outcomes here..."
              value={getUserConsequences()}
              onChange={(e) => setUserConsequences(e.target.value)}
              className="min-h-[120px] bg-card"
            />
          </CardContent>
        </Card>

        {/* Implications — AI-predicted */}
        <Card className="house-zone house-zone-roof">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-display">Implications (AI-Predicted Outcomes)</CardTitle>
              <Button
                onClick={generateImplications}
                disabled={generating || !analysis.overarching_conclusion}
                variant="outline"
                className="gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generating..." : "Generate Implications"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!analysis.overarching_conclusion && (
              <p className="text-destructive text-xs mb-3">Set an overarching conclusion first to enable AI generation.</p>
            )}
            <p className="text-sm text-muted-foreground mb-3">
              AI-predicted outcomes — what should logically follow if the conclusion is correct. Re-generate after entering actual consequences to get updated predictions.
            </p>
            {implications ? (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap border rounded-md p-4 bg-card">
                {implications}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-md bg-card">
                <p>No implications generated yet. Click "Generate Implications" to predict outcomes.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
