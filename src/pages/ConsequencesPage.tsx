import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
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
        <p className="text-muted-foreground mb-8">Element 8 — Predict outcomes based on your analysis</p>

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
              placeholder="What consequences and implications follow from your analysis?"
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
