import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Concept = Tables<"concepts">;

export default function ConceptsPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view") === "builder" ? "?view=builder" : "";
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
      <div className="page-container">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate(`/analysis/${analysisId}${viewParam}`)} className="flex items-center gap-1 hover:text-foreground">
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
          <Button onClick={addConcept}>
            <Plus className="h-4 w-4 mr-2" /> Add Concept
          </Button>
        </div>

        {concepts.length === 0 ? (
          <Card className="house-zone house-zone-atmosphere text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">No concepts defined yet. Add your first concept to begin.</p>
              <Button onClick={addConcept}>
                <Plus className="h-4 w-4 mr-2" /> Add First Concept
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {concepts.map((concept) => (
              <Card key={concept.id} className="house-zone house-zone-atmosphere animate-fade-in">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-3">
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
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteConcept(concept.id)} className="text-destructive hover:text-destructive shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
