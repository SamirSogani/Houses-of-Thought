import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import SubPageCommentScope from "@/components/comments/SubPageCommentScope";
import InlinePill from "@/components/comments/InlinePill";

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

export default function SynthesisPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const readonly = searchParams.get("readonly") === "1";
  const navSuffix = readonly ? "?readonly=1" : (searchParams.get("view") === "builder" ? "?view=builder" : "");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);

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

  const updateConclusion = async (value: string) => {
    setAnalysis((prev) => (prev ? { ...prev, overarching_conclusion: value } : prev));
    await supabase
      .from("analyses")
      .update({ overarching_conclusion: value, updated_at: new Date().toISOString() })
      .eq("id", analysisId!);
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
      <SubPageCommentScope
        analysisId={analysisId}
        contextSummary={`Overarching conclusion for ${analysis.title}`}
        className="page-container max-w-6xl"
      >
        {(ctx) => (
          <>
            <div className="breadcrumb-nav">
              <button onClick={() => navigate(`/analysis/${analysisId}${navSuffix}`)} className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> {analysis.title}
              </button>
              <span>/</span>
              <span className="text-foreground">Overarching Conclusion</span>
            </div>

            <h1 className="text-3xl font-display font-bold mb-2">Overarching Conclusion</h1>
            <p className="text-muted-foreground mb-8">Element 7.2 — Synthesize all sub-conclusions into your final answer</p>

            <div className="space-y-6 mb-8">
              {Object.entries(grouped).map(([pov, questions]) => (
                <div key={pov}>
                  <h2 className="text-lg font-display font-semibold mb-3">{POV_LABELS[pov] || pov}</h2>
                  <div className="space-y-3">
                    {questions.map((sq) => (
                      <Card
                        key={sq.id}
                        className={POV_CLASSES[pov] || ""}
                        data-comment-kind="sub_question"
                        data-comment-target-id={sq.id}
                      >
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm mb-1">{sq.question}</p>
                              <p className="text-sm text-muted-foreground">{sq.sub_conclusion || "No sub-conclusion yet"}</p>
                            </div>
                            {ctx.hasContext && (
                              <InlinePill
                                ctx={ctx}
                                targetKind="sub_question"
                                targetId={sq.id}
                                targetLabel={sq.question || "Sub-question"}
                              />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Card className="house-zone house-zone-ceiling" data-comment-kind="overarching_conclusion" data-comment-target-id={null}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xl font-display text-foreground">Your Overarching Conclusion</CardTitle>
                  {ctx.hasContext && (
                    <InlinePill
                      ctx={ctx}
                      targetKind="overarching_conclusion"
                      targetId={null}
                      targetLabel="Overarching Conclusion"
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {readonly ? (
                  <div className="bg-card rounded border px-3 py-3 text-sm whitespace-pre-wrap text-foreground min-h-[200px]">
                    {analysis.overarching_conclusion || <span className="text-muted-foreground italic">No conclusion drafted yet.</span>}
                  </div>
                ) : (
                  <Textarea
                    placeholder="Draft your overarching conclusion based on all the sub-conclusions above..."
                    value={analysis.overarching_conclusion}
                    onChange={(e) => updateConclusion(e.target.value)}
                    className="min-h-[200px] bg-card text-foreground"
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </SubPageCommentScope>
    </div>
  );
}
