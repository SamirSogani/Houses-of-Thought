import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import SubPageCommentScope from "@/components/comments/SubPageCommentScope";
import InlinePill from "@/components/comments/InlinePill";

type Concept = Tables<"concepts">;

export default function ConceptsPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const readonly = searchParams.get("readonly") === "1";
  const navSuffix = readonly ? "?readonly=1" : (searchParams.get("view") === "builder" ? "?view=builder" : "");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [analysisTitle, setAnalysisTitle] = useState("");

  useEffect(() => {
    loadData();
  }, [analysisId]);

  const loadData = async () => {
    const [conceptsRes, analysisRes] = await Promise.all([
      supabase.from("concepts").select("*").eq("analysis_id", analysisId!).order("created_at"),
      supabase.from("analyses").select("title").eq("id", analysisId!).maybeSingle(),
    ]);
    setConcepts(conceptsRes.data || []);
    setAnalysisTitle(analysisRes.data?.title || "");
  };

  const addConcept = async () => {
    const { data, error } = await supabase
      .from("concepts")
      .insert({ analysis_id: analysisId!, term: "", definition: "" })
      .select()
      .single();
    if (error) toast.error(error.message);
    else if (data) setConcepts((prev) => [...prev, data]);
  };

  const updateConcept = async (id: string, field: "term" | "definition", value: string) => {
    setConcepts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    await supabase.from("concepts").update({ [field]: value }).eq("id", id);
  };

  const deleteConcept = async (id: string) => {
    await supabase.from("concepts").delete().eq("id", id);
    setConcepts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <SubPageCommentScope
        analysisId={analysisId}
        contextSummary={`Concepts for ${analysisTitle}`}
        className="page-container"
      >
        {(ctx) => (
          <>
            <div className="breadcrumb-nav">
              <button onClick={() => navigate(`/analysis/${analysisId}${navSuffix}`)} className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> {analysisTitle || "Analysis"}
              </button>
              <span>/</span>
              <span className="text-foreground">Concepts, Theories & Definitions</span>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-display font-bold">Concepts, Theories & Definitions</h1>
                <p className="text-muted-foreground mt-1">Element 1 — Define the core ideas fueling your analysis</p>
              </div>
              {!readonly && (
                <Button onClick={addConcept}>
                  <Plus className="h-4 w-4 mr-2" /> Add Concept
                </Button>
              )}
            </div>

            {concepts.length === 0 ? (
              <Card className="house-zone house-zone-atmosphere text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {readonly ? "No concepts defined." : "No concepts defined yet. Add your first concept to begin."}
                  </p>
                  {!readonly && (
                    <Button onClick={addConcept}>
                      <Plus className="h-4 w-4 mr-2" /> Add First Concept
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {concepts.map((concept) => (
                  <Card
                    key={concept.id}
                    className="house-zone house-zone-atmosphere animate-fade-in"
                    data-comment-kind="concept"
                    data-comment-target-id={concept.id}
                  >
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-3">
                          {readonly ? (
                            <>
                              <div className="font-semibold bg-card rounded border px-3 py-2 text-sm">
                                {concept.term || <span className="text-muted-foreground italic">No term</span>}
                              </div>
                              <div className="bg-card rounded border px-3 py-2 text-sm whitespace-pre-wrap min-h-[80px]">
                                {concept.definition || <span className="text-muted-foreground italic">No definition</span>}
                              </div>
                            </>
                          ) : (
                            <>
                              <Input
                                placeholder="Term or concept name"
                                value={concept.term}
                                onChange={(e) => updateConcept(concept.id, "term", e.target.value)}
                                className="font-semibold bg-card"
                              />
                              <Textarea
                                placeholder="Definition or explanation..."
                                value={concept.definition}
                                onChange={(e) => updateConcept(concept.id, "definition", e.target.value)}
                                className="min-h-[80px] bg-card"
                              />
                            </>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {ctx.hasContext && (
                            <InlinePill
                              ctx={ctx}
                              targetKind="concept"
                              targetId={concept.id}
                              targetLabel={concept.term || "Untitled concept"}
                            />
                          )}
                          {!readonly && (
                            <Button variant="ghost" size="icon" onClick={() => deleteConcept(concept.id)} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </SubPageCommentScope>
    </div>
  );
}
