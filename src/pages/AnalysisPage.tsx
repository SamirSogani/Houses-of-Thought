import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Pencil, Bot } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import HouseVisualization from "@/components/house/HouseVisualization";
import AISidebar from "@/components/ai/AISidebar";
import TodoPanel from "@/components/house/TodoPanel";

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
  const [aiOpen, setAiOpen] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const [analysisRes, sqRes, profileRes] = await Promise.all([
      supabase.from("analyses").select("*").eq("id", id).maybeSingle(),
      supabase.from("sub_questions").select("*").eq("analysis_id", id).order("sort_order"),
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    if (analysisRes.error || !analysisRes.data) {
      toast.error("Analysis not found");
      navigate("/dashboard");
      return;
    }
    setAnalysis(analysisRes.data);
    setTitleDraft(analysisRes.data.title);
    setSubQuestions(sqRes.data || []);
    setProfile(profileRes.data || null);
    setLoading(false);
  }, [id, user, navigate]);

  useEffect(() => {
    if (id && user) loadData();
  }, [id, user, loadData]);

  const autoSave = useCallback(
    async (field: keyof Analysis, value: string) => {
      if (!id) return;
      await supabase.from("analyses").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
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

  const acceptAllDrafts = async () => {
    if (!id) return;
    await Promise.all([
      supabase.from("analyses").update({ is_draft: false, updated_at: new Date().toISOString() } as any).eq("id", id),
      supabase.from("sub_questions").update({ is_draft: false, updated_at: new Date().toISOString() } as any).eq("analysis_id", id),
    ]);
    toast.success("All drafts accepted!");
    loadData();
  };

  const declineAllDrafts = async () => {
    if (!id || !analysis) return;
    // Clear drafted analysis fields and delete drafted sub-questions
    await Promise.all([
      supabase.from("analyses").update({
        purpose: "", sub_purposes: "", overarching_question: "", consequences: "",
        is_draft: false, updated_at: new Date().toISOString(),
      } as any).eq("id", id),
      supabase.from("sub_questions").delete().eq("analysis_id", id).eq("is_draft", true as any),
    ]);
    toast.success("Drafts declined");
    loadData();
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
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setAiOpen(true)}
      >
        <Bot className="h-5 w-5" />
      </Button>

      <AISidebar
        open={aiOpen}
        onOpenChange={setAiOpen}
        analysis={analysis}
        subQuestions={subQuestions}
        profile={profile}
        onDraftComplete={loadData}
      />

      <div className="page-container max-w-6xl">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{analysis.title}</span>
        </div>

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

        <TodoPanel analysis={analysis} subQuestions={subQuestions} onNavigate={navigate} />

        <HouseVisualization
          analysis={analysis}
          subQuestions={subQuestions}
          onUpdateField={updateField}
          onNavigate={navigate}
          onAcceptDraft={acceptAllDrafts}
          onDeclineDraft={declineAllDrafts}
        />
      </div>
    </div>
  );
}
