import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Pencil, Bot, LayoutGrid, Building2, TrendingUp, Shield, ChevronLeft, ChevronRight, Users, Search, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import HouseVisualization from "@/components/house/HouseVisualization";
import InteractiveHouseBuilder from "@/components/house/InteractiveHouseBuilder";
import SubmissionCommentOverlay from "@/components/comments/SubmissionCommentOverlay";
import { useCommentContext } from "@/hooks/useCommentContext";
import AISidebar from "@/components/ai/AISidebar";
import TodoPanel from "@/components/house/TodoPanel";
import LogicStrengthPanel from "@/components/house/LogicStrengthPanel";
import StressTestPanel from "@/components/house/StressTestPanel";
import AdminUsersPanel from "@/components/house/AdminUsersPanel";
import ResearchPanel from "@/components/house/ResearchPanel";
import { usePermissions } from "@/hooks/usePermissions";
import { useAnalysisAssignmentContext } from "@/hooks/useStudentAssignments";
import AssignmentBanner from "@/components/classroom/AssignmentBanner";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [viewMode, setViewMode] = useState<"standard" | "builder">(searchParams.get("view") === "builder" ? "builder" : "standard");
  const [toolPanel, setToolPanel] = useState<"none" | "logic" | "stress" | "admin" | "research">("none");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [panelWidth, setPanelWidth] = useState(288);
  const isResizing = useRef(false);
  const [mobileToolOpen, setMobileToolOpen] = useState(false);
  const [mobileToolType, setMobileToolType] = useState<"logic" | "stress" | "admin" | "research">("logic");
  const { permissions } = usePermissions(profile);
  const readonly = searchParams.get("readonly") === "1";
  const { submission, assignment, submit, unsubmit } = useAnalysisAssignmentContext(id);
  const commentCtx = useCommentContext(id);
  const navSuffix = readonly ? "?readonly=1" : (searchParams.get("view") === "builder" ? "?view=builder" : "");
  const houseContextSummary = analysis
    ? `Title: ${analysis.title}\nQuestion: ${analysis.overarching_question || "—"}\nPurpose: ${analysis.purpose || "—"}\nConclusion: ${analysis.overarching_conclusion || "—"}`
    : undefined;

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

  // Check if user is the owner
  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke("admin-users", { body: null, method: "GET" }).then(({ data, error }) => {
      setIsOwner(!error && Array.isArray(data?.users));
    }).catch(() => setIsOwner(false));
  }, [user]);

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

  const showToolPanel = toolPanel !== "none" && !sidebarCollapsed;

  const openMobileTool = (type: "logic" | "stress" | "admin" | "research") => {
    setMobileToolType(type);
    setMobileToolOpen(true);
  };

  const handleSubmit = async () => {
    const { error } = await submit();
    if (error) toast.error("Could not submit");
    else toast.success("Assignment submitted");
  };
  const handleUnsubmit = async () => {
    const { error } = await unsubmit();
    if (error) toast.error("Could not unsubmit");
    else toast.success("Submission withdrawn");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {assignment && submission && (
        <AssignmentBanner
          assignment={assignment}
          submission={submission}
          readonly={readonly}
          onSubmit={handleSubmit}
          onUnsubmit={handleUnsubmit}
        />
      )}
      <div className="flex-1 flex flex-col md:flex-row">
      {/* Left Sidebar — View Toggle + Tools (Desktop only) */}
      {!readonly && (
      <aside className="hidden md:flex w-14 shrink-0 border-r border-border bg-card/80 flex-col items-center py-4 gap-2 sticky top-0 h-screen">
        {/* View toggles */}
        <button
          onClick={() => setViewMode("standard")}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${viewMode === "standard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          title="Standard Editing View"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
        <button
          onClick={() => setViewMode("builder")}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${viewMode === "builder" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          title="Interactive House Builder"
        >
          <Building2 className="h-5 w-5" />
        </button>

        <div className="w-8 border-t border-border my-1" />

        {/* Classroom entry — Teacher → /classrooms, Student → /classroom */}
        {(permissions.canCreateClassrooms || permissions.canJoinClassroom) && (
          <button
            onClick={() => navigate(permissions.canCreateClassrooms ? "/classrooms" : "/classroom")}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted"
            title={permissions.canCreateClassrooms ? "Classrooms" : "My Classroom"}
          >
            <GraduationCap className="h-5 w-5" />
          </button>
        )}

        {/* Research Mode toggle — only for accounts that use the dedicated Research panel (Students) */}
        {permissions.canUseResearchPanel && (
          <button
            onClick={() => { setToolPanel(toolPanel === "research" ? "none" : "research"); setSidebarCollapsed(false); }}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${toolPanel === "research" && !sidebarCollapsed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            title="Research Mode"
          >
            <Search className="h-5 w-5" />
          </button>
        )}

        {/* Tool toggles */}
        <button
          onClick={() => { setToolPanel(toolPanel === "logic" ? "none" : "logic"); setSidebarCollapsed(false); }}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${toolPanel === "logic" && !sidebarCollapsed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          title="Logic Strength Meter"
        >
          <TrendingUp className="h-5 w-5" />
        </button>
        <button
          onClick={() => { setToolPanel(toolPanel === "stress" ? "none" : "stress"); setSidebarCollapsed(false); }}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${toolPanel === "stress" && !sidebarCollapsed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          title="Reasoning Stress Test"
        >
          <Shield className="h-5 w-5" />
        </button>

        {isOwner && (
          <>
            <div className="w-8 border-t border-border my-1" />
            <button
              onClick={() => { setToolPanel(toolPanel === "admin" ? "none" : "admin"); setSidebarCollapsed(false); }}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${toolPanel === "admin" && !sidebarCollapsed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              title="Admin: Users"
            >
              <Users className="h-5 w-5" />
            </button>
          </>
        )}
      </aside>
      )}

      {/* Resizable Tool Panel */}
      {!readonly && showToolPanel && (
        <aside
          className="shrink-0 bg-card/50 sticky top-0 h-screen flex flex-col overflow-hidden relative"
          style={{ width: panelWidth, minWidth: 220, maxWidth: 600 }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-display font-semibold text-muted-foreground">
              {toolPanel === "logic" ? "Logic Strength" : toolPanel === "stress" ? "Stress Test" : toolPanel === "research" ? "Research" : "Admin: Users"}
            </span>
            <button onClick={() => setSidebarCollapsed(true)} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <ScrollArea className="flex-1 p-3">
            {toolPanel === "logic" && (
              <LogicStrengthPanel
                analysis={analysis}
                subQuestions={subQuestions}
                profile={profile}
                onStartStressTest={() => setToolPanel("stress")}
              />
            )}
            {toolPanel === "stress" && (
              <StressTestPanel
                analysis={analysis}
                subQuestions={subQuestions}
                profile={profile}
                onBack={() => setToolPanel("logic")}
              />
            )}
            {toolPanel === "research" && <ResearchPanel analysisId={id} />}
            {toolPanel === "admin" && <AdminUsersPanel />}
          </ScrollArea>
          {/* Drag handle */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize flex items-center justify-center border-r border-border hover:border-primary hover:bg-primary/10 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              isResizing.current = true;
              const startX = e.clientX;
              const startW = panelWidth;
              const onMouseMove = (ev: MouseEvent) => {
                if (!isResizing.current) return;
                const newW = Math.min(600, Math.max(220, startW + ev.clientX - startX));
                setPanelWidth(newW);
              };
              const onMouseUp = () => {
                isResizing.current = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
              };
              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
            }}
          >
            <div className="w-0.5 h-8 rounded-full bg-muted-foreground/30 hover:bg-primary/50 transition-colors" />
          </div>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
        <div className="flex items-center justify-around py-2 px-2">
          <button
            onClick={() => setViewMode("standard")}
            className={`flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-[3rem] ${viewMode === "standard" ? "text-primary" : "text-muted-foreground"}`}
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px]">Standard</span>
          </button>
          <button
            onClick={() => setViewMode("builder")}
            className={`flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-[3rem] ${viewMode === "builder" ? "text-primary" : "text-muted-foreground"}`}
          >
            <Building2 className="h-5 w-5" />
            <span className="text-[10px]">Builder</span>
          </button>
          <button
            onClick={() => openMobileTool("logic")}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-[3rem] text-muted-foreground"
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-[10px]">Logic</span>
          </button>
          <button
            onClick={() => openMobileTool("stress")}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-[3rem] text-muted-foreground"
          >
            <Shield className="h-5 w-5" />
            <span className="text-[10px]">Stress</span>
          </button>
          {permissions.canUseResearchPanel && (
            <button
              onClick={() => openMobileTool("research")}
              className="flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-[3rem] text-muted-foreground"
            >
              <Search className="h-5 w-5" />
              <span className="text-[10px]">Research</span>
            </button>
          )}
          {permissions.canUseAISidebar && (
            <button
              onClick={() => setAiOpen(true)}
              className="flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-[3rem] text-muted-foreground"
            >
              <Bot className="h-5 w-5" />
              <span className="text-[10px]">AI</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Tool Drawer */}
      <Sheet open={mobileToolOpen} onOpenChange={setMobileToolOpen}>
        <SheetContent side="bottom" className="h-[75vh] rounded-t-xl md:hidden">
          <SheetHeader>
            <SheetTitle className="font-display">
              {mobileToolType === "logic" ? "Logic Strength" : mobileToolType === "stress" ? "Stress Test" : mobileToolType === "research" ? "Research" : "Admin: Users"}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-4 h-[calc(75vh-5rem)]">
            {mobileToolType === "logic" && (
              <LogicStrengthPanel
                analysis={analysis}
                subQuestions={subQuestions}
                profile={profile}
                onStartStressTest={() => { setMobileToolType("stress"); }}
              />
            )}
            {mobileToolType === "stress" && (
              <StressTestPanel
                analysis={analysis}
                subQuestions={subQuestions}
                profile={profile}
                onBack={() => { setMobileToolType("logic"); }}
              />
            )}
            {mobileToolType === "research" && <ResearchPanel analysisId={id} />}
            {mobileToolType === "admin" && <AdminUsersPanel />}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 min-w-0 pb-20 md:pb-0">
        {/* AI FAB + Sidebar (desktop) — gated by account permissions */}
        {!readonly && permissions.canUseAISidebar && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="hidden md:flex fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
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
          </>
        )}
        <SubmissionCommentOverlay ctx={commentCtx} contextSummary={houseContextSummary} className="page-container max-w-6xl">
          <div className="breadcrumb-nav">
            <button onClick={() => readonly ? navigate(-1) : navigate("/dashboard")} className="flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> {readonly ? "Back" : "Dashboard"}
            </button>
            <span>/</span>
            <span className="text-foreground truncate max-w-[200px]">{analysis.title}</span>
          </div>

          <div className="flex items-center gap-3 mb-8">
            {editingTitle && !readonly ? (
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
                className={`text-3xl font-display font-bold text-foreground flex items-center gap-2 ${readonly ? "" : "cursor-pointer hover:text-primary transition-colors"}`}
                onClick={() => !readonly && setEditingTitle(true)}
              >
                {analysis.title}
                {!readonly && <Pencil className="h-4 w-4 text-muted-foreground" />}
              </h1>
            )}
          </div>

          {viewMode === "standard" ? (
            <>
              {!readonly && <TodoPanel analysis={analysis} subQuestions={subQuestions} onNavigate={navigate} />}
              <HouseVisualization
                analysis={analysis}
                subQuestions={subQuestions}
                onUpdateField={updateField}
                onNavigate={navigate}
                onAcceptDraft={acceptAllDrafts}
                onDeclineDraft={declineAllDrafts}
                commentCtx={commentCtx}
                readonly={readonly}
                navSuffix={navSuffix}
              />
            </>
          ) : (
            <InteractiveHouseBuilder
              analysis={analysis}
              subQuestions={subQuestions}
              profile={profile}
              onNavigate={navigate}
              onUpdateField={updateField}
            />
          )}
        </SubmissionCommentOverlay>
      </div>
      </div>
    </div>
  );
}
