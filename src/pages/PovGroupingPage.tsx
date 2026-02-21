import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type SubQuestion = Tables<"sub_questions">;

const POV_CATEGORIES = [
  { key: "individual", label: "Individual", desc: "Personal perspective", className: "pov-individual border-2" },
  { key: "group", label: "Group", desc: "Collective/social perspective", className: "pov-group border-2" },
  { key: "ideas_disciplines", label: "Ideas & Disciplines", desc: "Academic/theoretical perspective", className: "pov-ideas border-2" },
] as const;

export default function PovGroupingPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
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

  const updatePov = async (id: string, pov: string) => {
    setSubQuestions((prev) => prev.map((sq) => (sq.id === id ? { ...sq, pov_category: pov } : sq)));
    await supabase.from("sub_questions").update({ pov_category: pov, updated_at: new Date().toISOString() }).eq("id", id);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container max-w-6xl">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate(`/analysis/${analysisId}`)} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {analysisTitle || "Analysis"}
          </button>
          <span>/</span>
          <span className="text-foreground">POV Grouping</span>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Point of View Grouping</h1>
        <p className="text-muted-foreground mb-8">Element 4.1 — Assign each sub-question to a point of view category</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {POV_CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <Card className={cat.className}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-display">{cat.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{cat.desc}</p>
                </CardHeader>
                <CardContent className="space-y-2 min-h-[120px]">
                  {subQuestions
                    .filter((sq) => sq.pov_category === cat.key)
                    .map((sq) => (
                      <div
                        key={sq.id}
                        className="p-3 bg-card rounded-md border text-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/analysis/${analysisId}/sub-question/${sq.id}`)}
                      >
                        {sq.question || "Untitled question"}
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Unassigned */}
        <div className="mt-8">
          <h2 className="text-xl font-display font-semibold mb-4">Assign Sub-Questions</h2>
          <div className="space-y-3">
            {subQuestions.map((sq) => (
              <Card key={sq.id} className="animate-fade-in">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-sm flex-1 min-w-[200px]">{sq.question || "Untitled question"}</span>
                    <div className="flex gap-2">
                      {POV_CATEGORIES.map((cat) => (
                        <Button
                          key={cat.key}
                          size="sm"
                          variant={sq.pov_category === cat.key ? "default" : "outline"}
                          onClick={() => updatePov(sq.id, cat.key)}
                          className="text-xs"
                        >
                          {cat.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
