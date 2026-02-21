import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Assumption = Tables<"assumptions">;

const ASSUMPTION_TYPES = [
  { key: "unknown_unknowns", label: "Unknown Unknowns", element: "5.1", desc: "Things you don't know that you don't know", className: "house-zone-assumption" },
  { key: "foundational_concepts", label: "Foundational Concepts", element: "5.2", desc: "Underlying concepts taken for granted", className: "house-zone-assumption" },
  { key: "shaping_inferences", label: "Concepts that Shape Inferences", element: "5.3", desc: "Ideas influencing how you interpret evidence", className: "house-zone-assumption" },
] as const;

export default function AssumptionsPage() {
  const { analysisId, subQuestionId } = useParams<{ analysisId: string; subQuestionId: string }>();
  const navigate = useNavigate();
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [sqQuestion, setSqQuestion] = useState("");

  useEffect(() => {
    loadData();
  }, [subQuestionId]);

  const loadData = async () => {
    const [aRes, sqRes] = await Promise.all([
      supabase.from("assumptions").select("*").eq("sub_question_id", subQuestionId!).order("created_at"),
      supabase.from("sub_questions").select("question").eq("id", subQuestionId!).maybeSingle(),
    ]);
    setAssumptions(aRes.data || []);
    setSqQuestion(sqRes.data?.question || "");
  };

  const addAssumption = async (type: string) => {
    const { data, error } = await supabase
      .from("assumptions")
      .insert({ sub_question_id: subQuestionId!, assumption_type: type, content: "" })
      .select()
      .single();
    if (error) toast.error(error.message);
    else if (data) setAssumptions((prev) => [...prev, data]);
  };

  const updateAssumption = async (id: string, content: string) => {
    setAssumptions((prev) => prev.map((a) => (a.id === id ? { ...a, content } : a)));
    await supabase.from("assumptions").update({ content }).eq("id", id);
  };

  const deleteAssumption = async (id: string) => {
    await supabase.from("assumptions").delete().eq("id", id);
    setAssumptions((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container">
        <div className="breadcrumb-nav">
          <button
            onClick={() => navigate(`/analysis/${analysisId}/sub-question/${subQuestionId}`)}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {sqQuestion || "Sub-Question"}
          </button>
          <span>/</span>
          <span className="text-foreground">Assumptions</span>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Assumptions</h1>
        <p className="text-muted-foreground mb-8">Elements 5.1, 5.2, 5.3 — Examine the assumptions underlying your reasoning</p>

        <div className="space-y-8">
          {ASSUMPTION_TYPES.map((type) => {
            const items = assumptions.filter((a) => a.assumption_type === type.key);
            return (
              <div key={type.key}>
                <Card className={`house-zone ${type.className}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-display">{type.label}</CardTitle>
                        <p className="text-sm text-muted-foreground">Element {type.element} — {type.desc}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addAssumption(type.key)}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No assumptions listed yet</p>
                    ) : (
                      items.map((a) => (
                        <div key={a.id} className="flex gap-2 animate-fade-in">
                          <Textarea
                            placeholder="Describe this assumption..."
                            value={a.content}
                            onChange={(e) => updateAssumption(a.id, e.target.value)}
                            className="flex-1 bg-card min-h-[60px]"
                          />
                          <Button variant="ghost" size="icon" onClick={() => deleteAssumption(a.id)} className="text-destructive shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
