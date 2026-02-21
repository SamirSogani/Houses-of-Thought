import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CloudUpload, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import HouseVisualization from "@/components/house/HouseVisualization";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    const [analysisRes, sqRes] = await Promise.all([
      supabase.from("analyses").select("*").eq("id", id!).maybeSingle(),
      supabase.from("sub_questions").select("*").eq("analysis_id", id!).order("sort_order"),
    ]);
    if (analysisRes.error || !analysisRes.data) {
      toast.error("Analysis not found");
      navigate("/dashboard");
      return;
    }
    setAnalysis(analysisRes.data);
    setTitleDraft(analysisRes.data.title);
    setSubQuestions(sqRes.data || []);
    setLoading(false);
  };

  const autoSave = useCallback(
    async (field: keyof Analysis, value: string) => {
      if (!id) return;
      const { error } = await supabase
        .from("analyses")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) toast.error("Save failed: " + error.message);
    },
    [id]
  );

  const updateField = (field: keyof Analysis, value: string) => {
    setAnalysis((prev) => (prev ? { ...prev, [field]: value } : prev));
    autoSave(field, value);
  };

  const saveTitle = async () => {
    if (!id) return;
    await supabase.from("analyses").update({ title: titleDraft, updated_at: new Date().toISOString() }).eq("id", id);
    setAnalysis((prev) => (prev ? { ...prev, title: titleDraft } : prev));
    setEditingTitle(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading analysis...</div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container max-w-6xl">
        {/* Breadcrumb */}
        <div className="breadcrumb-nav">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{analysis.title}</span>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="text-2xl font-display font-bold"
                autoFocus
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              />
            </div>
          ) : (
            <h1
              className="text-3xl font-display font-bold text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
              onClick={() => setEditingTitle(true)}
            >
              {analysis.title}
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </h1>
          )}
        </div>

        {/* House Visualization */}
        <HouseVisualization
          analysis={analysis}
          subQuestions={subQuestions}
          onUpdateField={updateField}
          onNavigate={navigate}
        />
      </div>
    </div>
  );
}
