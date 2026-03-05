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
  };

  const updateConsequences = async (value: string) => {
    setAnalysis((prev) => (prev ? { ...prev, consequences: value } : prev));
    await supabase
      .from("analyses")
      .update({ consequences: value, updated_at: new Date().toISOString() })
      .eq("id", analysisId!);
  };

  const generateConsequences = async () => {
    if (!analysis || generating) return;
    setGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const subConclusionsSummary = subQuestions
        .filter(sq => sq.sub_conclusion)
        .map((sq, i) => `${i + 1}. [${sq.pov_category}] "${sq.question}" → ${sq.sub_conclusion}`)
        .join("\n");

      const systemPrompt = `You are the House of Reason AI. Generate predictive consequences and implications.

Given the user's overarching conclusion and sub-conclusions, predict what COULD HAPPEN as a result. These are forward-looking outcomes — not summaries of existing reasoning.

Rules:
- Focus on predictive, actionable consequences
- Cover short-term, medium-term, and long-term implications
- Consider consequences across individual, group, and systemic levels
- Be specific and substantive — no vague generalities
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
            { role: "user", content: `Based on the overarching conclusion "${analysis.overarching_conclusion || analysis.overarching_question}", generate comprehensive predictive consequences and implications. What could happen if this conclusion is accepted and acted upon?` },
          ],
          mode: "chat",
        },
      });

      if (res.error) throw new Error(res.error.message);
      const reply = res.data?.choices?.[0]?.message?.content || "";

      if (reply) {
        await updateConsequences(reply);
        toast.success("Predictive consequences generated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate consequences");
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

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-display font-bold">Consequences & Implications</h1>
          <Button
            onClick={generateConsequences}
            disabled={generating || !analysis.overarching_conclusion}
            variant="outline"
            className="gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating..." : "Generate from AI"}
          </Button>
        </div>
        <p className="text-muted-foreground mb-8">
          Element 8 — Predict outcomes based on your overarching conclusion
          {!analysis.overarching_conclusion && (
            <span className="text-destructive ml-2 text-xs">(Set an overarching conclusion first to enable AI generation)</span>
          )}
        </p>

        {/* POV Reference Cards (non-clickable) */}
        <div className="space-y-6 mb-8">
          {Object.entries(grouped).map(([pov, questions]) => (
            <div key={pov}>
              <h2 className="text-lg font-display font-semibold mb-3">{POV_LABELS[pov] || pov}</h2>
              <div className="space-y-2">
                {questions.map((sq) => (
                  <Card key={sq.id} className={`${POV_CLASSES[pov] || ""} opacity-80`}>
                    <CardContent className="pt-3 pb-3">
                      <p className="font-medium text-sm">{sq.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sq.sub_conclusion || "No conclusion"}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Card className="house-zone house-zone-roof">
          <CardHeader>
            <CardTitle className="text-xl font-display">Predicted Consequences & Implications</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="What consequences and implications follow from your overarching conclusion? Click 'Generate from AI' to auto-populate."
              value={analysis.consequences}
              onChange={(e) => updateConsequences(e.target.value)}
              className="min-h-[200px] bg-card"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}