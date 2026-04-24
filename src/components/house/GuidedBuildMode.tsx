import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Compass,
  HelpCircle,
  Users,
  ListTree,
  BookOpen,
  AlertTriangle,
  Lightbulb,
  Flag,
  Telescope,
  ClipboardList,
  Home,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import LogicStrengthPanel from "./LogicStrengthPanel";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;
type StagingItem = Tables<"staging_items">;

interface GuidedBuildModeProps {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  profile: Tables<"profiles"> | null;
  onUpdateField: (field: keyof Analysis, value: string) => void;
  onExit: () => void;
  onReload: () => void;
}

interface StoredImplications {
  consequences?: string[];
  implications?: string[];
  ai_implications?: string;
}

function parseStored(raw: string): StoredImplications {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        consequences: Array.isArray(parsed.consequences) ? parsed.consequences : [],
        implications: Array.isArray(parsed.implications_list) ? parsed.implications_list : [],
        ai_implications: typeof parsed.implications === "string" ? parsed.implications : (parsed.ai_implications || ""),
      };
    }
  } catch {
    // legacy plain text — treat as a single consequence string
    return { consequences: raw ? [raw] : [] };
  }
  return {};
}

function serializeStored(data: StoredImplications): string {
  return JSON.stringify({
    consequences: data.consequences || [],
    implications_list: data.implications || [],
    ai_implications: data.ai_implications || "",
    implications: data.ai_implications || "",
  });
}

const STEPS = [
  { key: "intro", weight: 0, title: "Welcome", icon: Home },
  { key: "purpose", weight: 10, title: "Define Your Purpose", icon: Compass },
  { key: "question", weight: 10, title: "Ask the Right Question", icon: HelpCircle },
  { key: "pov", weight: 15, title: "Explore Different Perspectives", icon: Users },
  { key: "subq", weight: 20, title: "Break the Problem Down", icon: ListTree },
  { key: "info", weight: 15, title: "Build Your Foundation", icon: BookOpen },
  { key: "assumptions", weight: 10, title: "Examine Your Assumptions", icon: AlertTriangle },
  { key: "subconc", weight: 10, title: "Draw Sub-Conclusions", icon: Lightbulb },
  { key: "conclusion", weight: 5, title: "Form Your Conclusion", icon: Flag },
  { key: "implications", weight: 5, title: "Consider Implications", icon: Telescope },
  { key: "consequences", weight: 0, title: "Record Consequences", icon: ClipboardList },
  { key: "complete", weight: 0, title: "House Complete", icon: Check },
] as const;

export default function GuidedBuildMode({
  analysis,
  subQuestions,
  profile,
  onUpdateField,
  onExit,
  onReload,
}: GuidedBuildModeProps) {
  const analysisId = analysis.id;
  const [stepIndex, setStepIndex] = useState(0);
  const [reinforcement, setReinforcement] = useState<string | null>(null);

  // Local mirrors for inputs (live-synced to DB on blur / Enter)
  const [purpose, setPurpose] = useState(analysis.purpose || "");
  const [question, setQuestion] = useState(analysis.overarching_question || "");
  const [conclusion, setConclusion] = useState(analysis.overarching_conclusion || "");

  // POV labels
  const [povs, setPovs] = useState<Tables<"pov_labels">[]>([]);
  const [newPov, setNewPov] = useState("");
  const [newPovCategory, setNewPovCategory] = useState<"individual" | "group" | "ideas">("individual");

  // Sub-questions are passed in via prop; we add new ones via supabase
  const [newSubQ, setNewSubQ] = useState("");

  // For evidence/assumptions/sub-conclusions, work against the FIRST sub-question
  // (user-controlled "Done with this step" model — user can add more from the same UI).
  const activeSubQ = subQuestions[0] ?? null;
  const [evidence, setEvidence] = useState(activeSubQ?.information || "");
  const [assumption, setAssumption] = useState("");
  const [assumptionsList, setAssumptionsList] = useState<Tables<"assumptions">[]>([]);
  const [subConclusion, setSubConclusion] = useState(activeSubQ?.sub_conclusion || "");

  // Implications & consequences (stored serialized in analysis.consequences)
  const stored = useMemo(() => parseStored(analysis.consequences || ""), [analysis.consequences]);
  const [implications, setImplications] = useState<string[]>(stored.implications || []);
  const [consequences, setConsequences] = useState<string[]>(stored.consequences || []);
  const [newImplication, setNewImplication] = useState("");
  const [newConsequence, setNewConsequence] = useState("");

  // Sync local inputs whenever the active sub-question changes
  useEffect(() => {
    setEvidence(activeSubQ?.information || "");
    setSubConclusion(activeSubQ?.sub_conclusion || "");
  }, [activeSubQ?.id, activeSubQ?.information, activeSubQ?.sub_conclusion]);

  useEffect(() => {
    setPurpose(analysis.purpose || "");
    setQuestion(analysis.overarching_question || "");
    setConclusion(analysis.overarching_conclusion || "");
    const s = parseStored(analysis.consequences || "");
    setImplications(s.implications || []);
    setConsequences(s.consequences || []);
  }, [analysis.id]);

  // Load POVs + assumptions for active sub-question
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("pov_labels")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("sort_order");
      if (!cancel) setPovs(data || []);
    })();
    return () => { cancel = true; };
  }, [analysisId]);

  useEffect(() => {
    if (!activeSubQ) { setAssumptionsList([]); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("assumptions")
        .select("*")
        .eq("sub_question_id", activeSubQ.id)
        .order("created_at");
      if (!cancel) setAssumptionsList(data || []);
    })();
    return () => { cancel = true; };
  }, [activeSubQ?.id]);

  // ---------- progress calculation ----------
  const progress = useMemo(() => {
    let pct = 0;
    if ((analysis.purpose || "").trim().length > 0) pct += 10;
    if ((analysis.overarching_question || "").trim().length > 0) pct += 10;
    if (povs.length > 0) pct += 15;
    if (subQuestions.length > 0) pct += 20;
    const anyInfo = subQuestions.some((sq) => (sq.information || "").trim().length > 0);
    if (anyInfo) pct += 15;
    // Assumptions check requires a query; approximate with current loaded list when on step
    if (assumptionsList.length > 0) pct += 10;
    const anySubConc = subQuestions.some((sq) => (sq.sub_conclusion || "").trim().length > 0);
    if (anySubConc) pct += 10;
    if ((analysis.overarching_conclusion || "").trim().length > 0) pct += 5;
    if (implications.length > 0) pct += 5;
    return Math.min(100, pct);
  }, [analysis, povs.length, subQuestions, assumptionsList.length, implications.length]);

  // ---------- helpers ----------
  const showReinforcement = (msg: string) => {
    setReinforcement(msg);
    window.setTimeout(() => setReinforcement(null), 2200);
  };

  const goNext = (msg?: string) => {
    if (msg) showReinforcement(msg);
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  // ---------- field savers ----------
  const savePurpose = async () => {
    const v = purpose.trim();
    onUpdateField("purpose", v);
    await supabase.from("analyses").update({ purpose: v, updated_at: new Date().toISOString() }).eq("id", analysisId);
  };
  const saveQuestion = async () => {
    const v = question.trim();
    onUpdateField("overarching_question", v);
    await supabase.from("analyses").update({ overarching_question: v, updated_at: new Date().toISOString() }).eq("id", analysisId);
  };
  const saveConclusion = async () => {
    const v = conclusion.trim();
    onUpdateField("overarching_conclusion", v);
    await supabase.from("analyses").update({ overarching_conclusion: v, updated_at: new Date().toISOString() }).eq("id", analysisId);
  };

  const addPov = async () => {
    const label = newPov.trim();
    if (!label) return;
    const { data, error } = await supabase
      .from("pov_labels")
      .insert({ analysis_id: analysisId, label, parent_category: newPovCategory, sort_order: povs.length })
      .select()
      .single();
    if (error) { toast.error("Couldn't add perspective"); return; }
    setPovs((p) => [...p, data]);
    setNewPov("");
  };
  const removePov = async (id: string) => {
    await supabase.from("pov_labels").delete().eq("id", id);
    setPovs((p) => p.filter((x) => x.id !== id));
  };

  const addSubQ = async () => {
    const q = newSubQ.trim();
    if (!q) return;
    const { error } = await supabase
      .from("sub_questions")
      .insert({ analysis_id: analysisId, question: q, sort_order: subQuestions.length });
    if (error) { toast.error("Couldn't add sub-question"); return; }
    setNewSubQ("");
    onReload();
  };
  const removeSubQ = async (id: string) => {
    await supabase.from("sub_questions").delete().eq("id", id);
    onReload();
  };

  const saveEvidence = async () => {
    if (!activeSubQ) return;
    await supabase
      .from("sub_questions")
      .update({ information: evidence, updated_at: new Date().toISOString() })
      .eq("id", activeSubQ.id);
    onReload();
  };

  const addAssumption = async () => {
    if (!activeSubQ) return;
    const v = assumption.trim();
    if (!v) return;
    const { data, error } = await supabase
      .from("assumptions")
      .insert({ sub_question_id: activeSubQ.id, content: v, assumption_type: "unknown_unknowns" })
      .select()
      .single();
    if (error) { toast.error("Couldn't add assumption"); return; }
    setAssumptionsList((a) => [...a, data]);
    setAssumption("");
  };
  const removeAssumption = async (id: string) => {
    await supabase.from("assumptions").delete().eq("id", id);
    setAssumptionsList((a) => a.filter((x) => x.id !== id));
  };

  const saveSubConclusion = async () => {
    if (!activeSubQ) return;
    await supabase
      .from("sub_questions")
      .update({ sub_conclusion: subConclusion, updated_at: new Date().toISOString() })
      .eq("id", activeSubQ.id);
    onReload();
  };

  const persistImplicationsConsequences = async (impl: string[], cons: string[]) => {
    const current = parseStored(analysis.consequences || "");
    const updated = serializeStored({
      ...current,
      implications: impl,
      consequences: cons,
    });
    onUpdateField("consequences", updated);
    await supabase
      .from("analyses")
      .update({ consequences: updated, updated_at: new Date().toISOString() })
      .eq("id", analysisId);
  };

  const addImplication = async () => {
    const v = newImplication.trim();
    if (!v) return;
    const next = [...implications, v];
    setImplications(next);
    setNewImplication("");
    await persistImplicationsConsequences(next, consequences);
  };
  const removeImplication = async (idx: number) => {
    const next = implications.filter((_, i) => i !== idx);
    setImplications(next);
    await persistImplicationsConsequences(next, consequences);
  };

  const addConsequence = async () => {
    const v = newConsequence.trim();
    if (!v) return;
    const next = [...consequences, v];
    setConsequences(next);
    setNewConsequence("");
    await persistImplicationsConsequences(implications, next);
  };
  const removeConsequence = async (idx: number) => {
    const next = consequences.filter((_, i) => i !== idx);
    setConsequences(next);
    await persistImplicationsConsequences(implications, next);
  };

  const step = STEPS[stepIndex];
  const StepIcon = step.icon;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Persistent header: progress + exit */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 text-sm font-display">
            <Home className="h-4 w-4 text-primary" />
            <span className="text-foreground font-semibold">Your House</span>
            <span className="text-muted-foreground">— {progress}% complete</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground hover:text-foreground">
            Exit Guided Mode
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Reinforcement toast (subtle, inline) */}
      {reinforcement && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-foreground/90 flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          {reinforcement}
        </div>
      )}

      {/* Step body */}
      <div className="mt-8 mb-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <StepIcon className="h-5 w-5" />
          </div>
          {step.key !== "intro" && step.key !== "complete" && (
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-display">
              Step {stepIndex} of 10
            </span>
          )}
        </div>

        {step.key === "intro" && (
          <StepShell
            header="Welcome to Houses of Thought"
            body={
              <>
                Let's build your first house — step by step.
                <br />
                You'll move from a simple idea to a well-supported conclusion.
              </>
            }
          >
            <div className="flex gap-3">
              <Button onClick={() => goNext()} size="lg">Start Building <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <Button variant="ghost" onClick={onExit}>Skip to Free Build</Button>
            </div>
          </StepShell>
        )}

        {step.key === "purpose" && (
          <StepShell
            header="Step 1: Define Your Purpose"
            body="Why are you analyzing this? A clear purpose keeps your thinking focused and prevents you from drifting."
          >
            <Textarea
              placeholder='Example: "To evaluate whether…", "To understand…", "To decide…"'
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              onBlur={savePurpose}
              rows={4}
              className="mb-4"
            />
            <NavButtons
              onBack={goBack}
              onNext={async () => {
                await savePurpose();
                goNext("Strong start. A clear purpose gives your entire house direction.");
              }}
              nextLabel="Continue → Define Your Question"
              nextDisabled={!purpose.trim()}
            />
          </StepShell>
        )}

        {step.key === "question" && (
          <StepShell
            header="Step 2: Ask the Right Question"
            body="What is the main question you're trying to answer? Everything in your house will build toward this."
          >
            <Input
              placeholder='Example: "Should…?", "To what extent…?", "How does… affect…?"'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onBlur={saveQuestion}
              className="mb-4"
            />
            <NavButtons
              onBack={goBack}
              onNext={async () => {
                await saveQuestion();
                goNext("Good question. This will guide everything that follows.");
              }}
              nextLabel="Continue → Add Perspectives"
              nextDisabled={!question.trim()}
            />
          </StepShell>
        )}

        {step.key === "pov" && (
          <StepShell
            header="Step 3: Explore Different Perspectives"
            body="Strong reasoning considers multiple points of view. Add at least one perspective to begin."
            helper="You can add personal, group, or discipline-based perspectives."
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {(["individual", "group", "ideas"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNewPovCategory(cat)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    newPovCategory === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {cat === "individual" ? "Individual" : cat === "group" ? "Group" : "Ideas / Discipline"}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="e.g. Economist, Parent, Public-health perspective…"
                value={newPov}
                onChange={(e) => setNewPov(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPov())}
              />
              <Button onClick={addPov} variant="secondary"><Plus className="h-4 w-4" /></Button>
            </div>
            <ItemList items={povs.map((p) => ({ id: p.id, text: p.label, meta: p.parent_category }))} onRemove={removePov} />
            <NavButtons
              onBack={goBack}
              onNext={() =>
                goNext(
                  povs.length >= 2
                    ? "Even better. This helps reduce bias in your thinking."
                    : "Nice. Different perspectives reveal different insights."
                )
              }
              nextLabel="Continue → Break It Down"
              nextDisabled={povs.length === 0}
            />
          </StepShell>
        )}

        {step.key === "subq" && (
          <StepShell
            header="Step 4: Break the Problem Down"
            body="Big questions need smaller pieces. Add sub-questions to explore your main question from each perspective."
          >
            <div className="flex gap-2 mb-4">
              <Input
                placeholder='Example: "What evidence supports…?", "How does this impact…?"'
                value={newSubQ}
                onChange={(e) => setNewSubQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubQ())}
              />
              <Button onClick={addSubQ} variant="secondary"><Plus className="h-4 w-4" /></Button>
            </div>
            <ItemList items={subQuestions.map((s) => ({ id: s.id, text: s.question }))} onRemove={removeSubQ} />
            <NavButtons
              onBack={goBack}
              onNext={() => goNext("Good progress. These will guide your research and reasoning.")}
              nextLabel="Continue → Build Your Foundation"
              nextDisabled={subQuestions.length === 0}
            />
          </StepShell>
        )}

        {step.key === "info" && (
          <StepShell
            header="Step 5: Build Your Foundation"
            body="Add facts, data, or sources that help answer your sub-questions. Strong conclusions require strong evidence."
            helper="Look for information that is observable, measurable, and verifiable."
          >
            {activeSubQ ? (
              <>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-display mb-2">
                  For sub-question:
                </p>
                <p className="text-sm font-medium text-foreground mb-3 italic">"{activeSubQ.question}"</p>
                <Textarea
                  placeholder="Add observable, measurable, verifiable evidence. One per line."
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  onBlur={saveEvidence}
                  rows={6}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground mb-4">
                  You can add evidence to other sub-questions in Free Build Mode.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Add a sub-question first.</p>
            )}
            <NavButtons
              onBack={goBack}
              onNext={async () => {
                await saveEvidence();
                goNext("Solid foundation. Evidence strengthens your reasoning.");
              }}
              nextLabel="Continue → Examine Assumptions"
              nextDisabled={!evidence.trim()}
            />
          </StepShell>
        )}

        {step.key === "assumptions" && (
          <StepShell
            header="Step 6: Examine Your Assumptions"
            body="Every argument relies on assumptions. Identify the beliefs or ideas connecting your evidence to your conclusions."
            helper='Ask yourself: "What am I taking for granted here?"'
          >
            {activeSubQ ? (
              <>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="An assumption you're making…"
                    value={assumption}
                    onChange={(e) => setAssumption(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAssumption())}
                  />
                  <Button onClick={addAssumption} variant="secondary"><Plus className="h-4 w-4" /></Button>
                </div>
                <ItemList items={assumptionsList.map((a) => ({ id: a.id, text: a.content }))} onRemove={removeAssumption} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Add a sub-question first.</p>
            )}
            <NavButtons
              onBack={goBack}
              onNext={() => goNext("Good thinking. Questioning assumptions improves accuracy.")}
              nextLabel="Continue → Make Inferences"
              nextDisabled={assumptionsList.length === 0}
            />
          </StepShell>
        )}

        {step.key === "subconc" && (
          <StepShell
            header="Step 7: Draw Sub-Conclusions"
            body="Based on your evidence and assumptions, what can you conclude for each sub-question?"
            helper="Keep your conclusions clear and directly tied to your evidence."
          >
            {activeSubQ ? (
              <>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-display mb-2">
                  For sub-question:
                </p>
                <p className="text-sm font-medium text-foreground mb-3 italic">"{activeSubQ.question}"</p>
                <Textarea
                  placeholder="What do you conclude about this sub-question?"
                  value={subConclusion}
                  onChange={(e) => setSubConclusion(e.target.value)}
                  onBlur={saveSubConclusion}
                  rows={4}
                  className="mb-4"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Add a sub-question first.</p>
            )}
            <NavButtons
              onBack={goBack}
              onNext={async () => {
                await saveSubConclusion();
                goNext("Nice work. You're starting to build upward.");
              }}
              nextLabel="Continue → Reach a Final Conclusion"
              nextDisabled={!subConclusion.trim()}
            />
          </StepShell>
        )}

        {step.key === "conclusion" && (
          <StepShell
            header="Step 8: Form Your Conclusion"
            body="Now bring everything together. What is your final answer to your main question?"
            helper="Weigh your sub-conclusions carefully before deciding."
          >
            <Textarea
              placeholder="Your final conclusion to the overarching question."
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              onBlur={saveConclusion}
              rows={5}
              className="mb-4"
            />
            <NavButtons
              onBack={goBack}
              onNext={async () => {
                await saveConclusion();
                goNext("Strong work. Your house now has a clear conclusion.");
              }}
              nextLabel="Continue → Look Ahead"
              nextDisabled={!conclusion.trim()}
            />
          </StepShell>
        )}

        {step.key === "implications" && (
          <StepShell
            header="Step 9: Consider Implications"
            body="If your conclusion is correct, what might happen next? These are your predicted outcomes."
          >
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="A predicted outcome of your conclusion…"
                value={newImplication}
                onChange={(e) => setNewImplication(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImplication())}
              />
              <Button onClick={addImplication} variant="secondary"><Plus className="h-4 w-4" /></Button>
            </div>
            <ItemList
              items={implications.map((t, i) => ({ id: String(i), text: t }))}
              onRemove={(id) => removeImplication(Number(id))}
            />
            <NavButtons
              onBack={goBack}
              onNext={() => goNext("Good foresight. Thinking ahead strengthens decision-making.")}
              nextLabel="Continue → Track Outcomes"
              nextDisabled={implications.length === 0}
            />
          </StepShell>
        )}

        {step.key === "consequences" && (
          <StepShell
            header="Step 10: Record Consequences"
            body="As real-world outcomes occur, record them here. This helps you compare predictions with reality."
          >
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="A real-world outcome you've observed…"
                value={newConsequence}
                onChange={(e) => setNewConsequence(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addConsequence())}
              />
              <Button onClick={addConsequence} variant="secondary"><Plus className="h-4 w-4" /></Button>
            </div>
            <ItemList
              items={consequences.map((t, i) => ({ id: String(i), text: t }))}
              onRemove={(id) => removeConsequence(Number(id))}
            />
            <p className="text-xs text-muted-foreground mb-4">
              You can keep recording consequences over time from Free Build Mode.
            </p>
            <NavButtons
              onBack={goBack}
              onNext={() => goNext("Excellent. This is how strong thinkers refine their reasoning over time.")}
              nextLabel="Finish → See Your House"
            />
          </StepShell>
        )}

        {step.key === "complete" && (
          <CompletionScreen
            progress={progress}
            analysis={analysis}
            subQuestions={subQuestions}
            profile={profile}
            onReview={onExit}
            onRestart={() => setStepIndex(1)}
          />
        )}
      </div>
    </div>
  );
}

// ---------- subcomponents ----------

function StepShell({
  header,
  body,
  helper,
  children,
}: {
  header: string;
  body: React.ReactNode;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">{header}</h2>
      <p className="text-base text-muted-foreground mb-2 leading-relaxed">{body}</p>
      {helper && <p className="text-sm text-muted-foreground/80 italic mb-6">{helper}</p>}
      {!helper && <div className="mb-6" />}
      {children}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}

function ItemList({
  items,
  onRemove,
}: {
  items: { id: string; text: string; meta?: string }[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic mb-4">Nothing added yet.</p>;
  }
  return (
    <ul className="space-y-2 mb-4">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground break-words">{it.text}</p>
            {it.meta && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{it.meta}</p>}
          </div>
          <button
            onClick={() => onRemove(it.id)}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function CompletionScreen({
  progress,
  analysis,
  subQuestions,
  profile,
  onReview,
  onRestart,
}: {
  progress: number;
  analysis: Analysis;
  subQuestions: SubQuestion[];
  profile: Tables<"profiles"> | null;
  onReview: () => void;
  onRestart: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Home className="h-7 w-7 text-primary" />
        <h2 className="text-3xl font-display font-bold text-foreground">House Complete</h2>
      </div>
      <p className="text-base text-muted-foreground mb-6 leading-relaxed">
        You've built a full chain of reasoning — from purpose to conclusion.
        <br />
        Your thinking is now structured, transparent, and defensible.
      </p>

      <Card className="mb-6">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-display mb-1">Completion</p>
          <p className="text-3xl font-display font-bold text-foreground">{progress}%</p>
        </CardContent>
      </Card>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-display mb-2">
          Logic Strength & Suggested Improvements
        </p>
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <LogicStrengthPanel analysis={analysis} subQuestions={subQuestions} profile={profile} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onReview}>Review Your House</Button>
        <Button variant="secondary" onClick={onRestart}>Strengthen Weak Points</Button>
        <Button variant="ghost" onClick={onReview}>Start a New House</Button>
      </div>
    </div>
  );
}
