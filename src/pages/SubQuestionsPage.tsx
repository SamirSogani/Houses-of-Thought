import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import SubPageCommentScope from "@/components/comments/SubPageCommentScope";
import InlinePill from "@/components/comments/InlinePill";

type SubQuestion = Tables<"sub_questions">;

export default function SubQuestionsPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const readonly = searchParams.get("readonly") === "1";
  const navSuffix = readonly ? "?readonly=1" : (searchParams.get("view") === "builder" ? "?view=builder" : "");
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [analysisTitle, setAnalysisTitle] = useState("");

  useEffect(() => {
    loadData();
  }, [analysisId]);

  const loadData = async () => {
    const [sqRes, aRes] = await Promise.all([
      supabase.from("sub_questions").select("*").eq("analysis_id", analysisId!).order("sort_order"),
      supabase.from("analyses").select("title").eq("id", analysisId!).maybeSingle(),
    ]);
    setSubQuestions(sqRes.data || []);
    setAnalysisTitle(aRes.data?.title || "");
  };

  const addSubQuestion = async () => {
    const { data, error } = await supabase
      .from("sub_questions")
      .insert({ analysis_id: analysisId!, question: "", sort_order: subQuestions.length })
      .select()
      .single();
    if (error) toast.error(error.message);
    else if (data) setSubQuestions((prev) => [...prev, data]);
  };

  const updateQuestion = async (id: string, value: string) => {
    setSubQuestions((prev) => prev.map((sq) => (sq.id === id ? { ...sq, question: value } : sq)));
    await supabase.from("sub_questions").update({ question: value, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const deleteSubQuestion = async (id: string) => {
    await supabase.from("sub_questions").delete().eq("id", id);
    setSubQuestions((prev) => prev.filter((sq) => sq.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <SubPageCommentScope
        analysisId={analysisId}
        contextSummary={`Sub-questions for ${analysisTitle}`}
        className="page-container"
      >
        {(ctx) => (
          <>
            <div className="breadcrumb-nav">
              <button onClick={() => navigate(`/analysis/${analysisId}${navSuffix}`)} className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> {analysisTitle || "Analysis"}
              </button>
              <span>/</span>
              <span className="text-foreground">Sub-Questions</span>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-display font-bold">Sub-Questions</h1>
                <p className="text-muted-foreground mt-1">Element 3.2 — Break your overarching question into sub-questions</p>
              </div>
              {!readonly && (
                <Button onClick={addSubQuestion}>
                  <Plus className="h-4 w-4 mr-2" /> Add Sub-Question
                </Button>
              )}
            </div>

            {subQuestions.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {readonly ? "No sub-questions yet." : "No sub-questions yet. Break your overarching question down."}
                  </p>
                  {!readonly && (
                    <Button onClick={addSubQuestion}>
                      <Plus className="h-4 w-4 mr-2" /> Add First Sub-Question
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {subQuestions.map((sq, i) => (
                  <Card
                    key={sq.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                    data-comment-kind="sub_question"
                    data-comment-target-id={sq.id}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-muted-foreground w-12 shrink-0">3.2.{i + 1}</span>
                        {readonly ? (
                          <div
                            className="flex-1 px-3 py-2 rounded border bg-card text-sm cursor-pointer hover:shadow-sm"
                            onClick={() => navigate(`/analysis/${analysisId}/sub-question/${sq.id}${navSuffix}`)}
                          >
                            {sq.question || <span className="text-muted-foreground italic">Untitled sub-question</span>}
                          </div>
                        ) : (
                          <Input
                            placeholder="Enter your sub-question..."
                            value={sq.question}
                            onChange={(e) => updateQuestion(sq.id, e.target.value)}
                            className="flex-1"
                          />
                        )}
                        {ctx.hasContext && (
                          <InlinePill
                            ctx={ctx}
                            targetKind="sub_question"
                            targetId={sq.id}
                            targetLabel={sq.question || `Sub-question 3.2.${i + 1}`}
                          />
                        )}
                        {!readonly && (
                          <Button variant="ghost" size="icon" onClick={() => deleteSubQuestion(sq.id)} className="text-destructive hover:text-destructive shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {subQuestions.length > 0 && !readonly && (
              <div className="mt-8 flex justify-end">
                <Button onClick={() => navigate(`/analysis/${analysisId}/pov-grouping${navSuffix}`)}>
                  Next: Group by Point of View →
                </Button>
              </div>
            )}
          </>
        )}
      </SubPageCommentScope>
    </div>
  );
}
