import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type SubQuestion = Tables<"sub_questions">;

interface PovLabel {
  id: string;
  analysis_id: string;
  parent_category: string;
  label: string;
  sort_order: number;
}

const POV_CATEGORIES = [
  { key: "individual", label: "Individual", desc: "Personal perspective", className: "pov-individual border-2" },
  { key: "group", label: "Group", desc: "Collective/social perspective", className: "pov-group border-2" },
  { key: "ideas_disciplines", label: "Ideas & Disciplines", desc: "Academic/theoretical perspective", className: "pov-ideas border-2" },
] as const;

export default function PovGroupingPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view") === "builder" ? "?view=builder" : "";
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [analysisTitle, setAnalysisTitle] = useState("");
  const [povLabels, setPovLabels] = useState<PovLabel[]>([]);
  const [newLabelCat, setNewLabelCat] = useState<string | null>(null);
  const [newLabelText, setNewLabelText] = useState("");

  useEffect(() => {
    loadData();
  }, [analysisId]);

  const loadData = async () => {
    const [sqRes, aRes, plRes] = await Promise.all([
      supabase.from("sub_questions").select("*").eq("analysis_id", analysisId!).order("sort_order"),
      supabase.from("analyses").select("title").eq("id", analysisId!).maybeSingle(),
      supabase.from("pov_labels").select("*").eq("analysis_id", analysisId!).order("sort_order"),
    ]);
    setSubQuestions(sqRes.data || []);
    setAnalysisTitle(aRes.data?.title || "");
    setPovLabels((plRes.data as any) || []);
  };

  const updatePov = async (id: string, pov: string) => {
    setSubQuestions((prev) => prev.map((sq) => (sq.id === id ? { ...sq, pov_category: pov } : sq)));
    await supabase.from("sub_questions").update({ pov_category: pov, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const addLabel = async (parentCategory: string) => {
    if (!newLabelText.trim()) return;
    const { data, error } = await supabase.from("pov_labels").insert({
      analysis_id: analysisId!,
      parent_category: parentCategory,
      label: newLabelText.trim(),
      sort_order: povLabels.filter((l) => l.parent_category === parentCategory).length,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    setPovLabels((prev) => [...prev, data as any]);
    setNewLabelText("");
    setNewLabelCat(null);
  };

  const deleteLabel = async (id: string) => {
    await supabase.from("pov_labels").delete().eq("id", id);
    setPovLabels((prev) => prev.filter((l) => l.id !== id));
  };

  const assignLabel = async (sqId: string, labelId: string) => {
    setSubQuestions((prev) => prev.map((sq) => (sq.id === sqId ? { ...sq, pov_label_id: labelId } as any : sq)));
    await supabase.from("sub_questions").update({ pov_label_id: labelId, updated_at: new Date().toISOString() } as any).eq("id", sqId);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container max-w-6xl">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate(`/analysis/${analysisId}${viewParam}`)} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {analysisTitle || "Analysis"}
          </button>
          <span>/</span>
          <span className="text-foreground">POV Grouping</span>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Point of View Grouping</h1>
        <p className="text-muted-foreground mb-8">Element 4.1 — Assign each sub-question to a point of view category</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {POV_CATEGORIES.map((cat) => {
            const labels = povLabels.filter((l) => l.parent_category === cat.key);
            return (
              <div key={cat.key}>
                <Card className={cat.className}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-display flex items-center justify-between">
                      {cat.label}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setNewLabelCat(cat.key); setNewLabelText(""); }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{cat.desc}</p>
                  </CardHeader>
                  <CardContent className="space-y-3 min-h-[120px]">
                    {/* Add label input */}
                    {newLabelCat === cat.key && (
                      <div className="flex gap-2">
                        <Input
                          value={newLabelText}
                          onChange={(e) => setNewLabelText(e.target.value)}
                          placeholder="New label..."
                          className="text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && addLabel(cat.key)}
                        />
                        <Button size="sm" onClick={() => addLabel(cat.key)}>Add</Button>
                      </div>
                    )}

                    {/* Nested labels */}
                    {labels.map((lbl) => (
                      <div key={lbl.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                          <span>{lbl.label}</span>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteLabel(lbl.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        {subQuestions
                          .filter((sq) => sq.pov_category === cat.key && (sq as any).pov_label_id === lbl.id)
                          .map((sq) => (
                            <div
                              key={sq.id}
                              className="p-2 bg-card rounded-md border text-sm cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => navigate(`/analysis/${analysisId}/sub-question/${sq.id}${viewParam}`)}
                            >
                              {sq.question || "Untitled question"}
                            </div>
                          ))}
                      </div>
                    ))}

                    {/* Unlabeled in this category */}
                    {subQuestions
                      .filter((sq) => sq.pov_category === cat.key && !(sq as any).pov_label_id)
                      .map((sq) => (
                        <div
                          key={sq.id}
                          className="p-3 bg-card rounded-md border text-sm cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/analysis/${analysisId}/sub-question/${sq.id}${viewParam}`)}
                        >
                          {sq.question || "Untitled question"}
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Assign Sub-Questions */}
        <div className="mt-8">
          <h2 className="text-xl font-display font-semibold mb-4">Assign Sub-Questions</h2>
          <div className="space-y-3">
            {subQuestions.map((sq) => (
              <Card key={sq.id} className="animate-fade-in">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-sm flex-1 min-w-[200px]">{sq.question || "Untitled question"}</span>
                    <div className="flex gap-2 flex-wrap">
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
                  {/* Assign to nested label */}
                  {povLabels.filter((l) => l.parent_category === sq.pov_category).length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      <span className="text-xs text-muted-foreground mr-1">Label:</span>
                      {povLabels
                        .filter((l) => l.parent_category === sq.pov_category)
                        .map((lbl) => (
                          <Button
                            key={lbl.id}
                            size="sm"
                            variant={(sq as any).pov_label_id === lbl.id ? "default" : "outline"}
                            onClick={() => assignLabel(sq.id, lbl.id)}
                            className="text-xs h-6 px-2"
                          >
                            {lbl.label}
                          </Button>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
