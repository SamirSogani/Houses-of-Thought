import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  HelpCircle,
  Users,
  ListTree,
  Flag,
  Plus,
  Trash2,
  Sparkles,
  Check,
  Home,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  type DemoSession,
  type DemoPovCategory,
  cryptoId,
  emptyDemo,
  sampleDemo,
  loadDemo,
  saveDemo,
  clearDemo,
  stagePendingImport,
} from "@/lib/demoSession";

type StepKey = "start" | "purpose" | "question" | "povs" | "subq" | "conclusion" | "done";

const STEPS: { key: StepKey; title: string; weight: number }[] = [
  { key: "start", title: "Start", weight: 0 },
  { key: "purpose", title: "Purpose", weight: 20 },
  { key: "question", title: "Question", weight: 20 },
  { key: "povs", title: "Perspectives", weight: 20 },
  { key: "subq", title: "Sub-questions", weight: 20 },
  { key: "conclusion", title: "Conclusion", weight: 20 },
  { key: "done", title: "Save", weight: 0 },
];

const POV_CATEGORIES: { key: DemoPovCategory; label: string }[] = [
  { key: "individual", label: "Individual" },
  { key: "group", label: "Group" },
  { key: "ideas", label: "Ideas" },
];

export default function DemoPage() {
  const navigate = useNavigate();
  const [demo, setDemo] = useState<DemoSession | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);

  // Load existing demo on mount
  useEffect(() => {
    const existing = loadDemo();
    if (existing) {
      setDemo(existing);
      // skip start screen if there's already work
      setStepIdx(1);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (demo) saveDemo(demo);
  }, [demo]);

  const update = (patch: Partial<DemoSession>) =>
    setDemo((d) => (d ? { ...d, ...patch } : d));

  const startBlank = () => {
    const d = emptyDemo();
    setDemo(d);
    setStepIdx(1);
  };
  const startSample = () => {
    const d = sampleDemo();
    setDemo(d);
    setStepIdx(1);
  };

  const progress = useMemo(() => {
    if (!demo) return 0;
    let p = 0;
    if (demo.purpose.trim()) p += 20;
    if (demo.overarching_question.trim()) p += 20;
    if (demo.povs.length > 0) p += 20;
    if (demo.subQuestions.length > 0) p += 20;
    if (demo.overarching_conclusion.trim()) p += 20;
    return p;
  }, [demo]);

  const triggerSave = () => {
    if (!demo) return;
    stagePendingImport(demo);
    navigate("/auth?mode=signup&import=demo");
  };

  const restart = () => {
    if (!confirm("Discard your demo House and start over?")) return;
    clearDemo();
    setDemo(null);
    setStepIdx(0);
  };

  const step = STEPS[stepIdx];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
          >
            <Home className="h-5 w-5" />
            <span className="font-display font-semibold">Houses of Thought</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Demo · saved on this device
            </span>
            {demo && (
              <Button size="sm" onClick={triggerSave}>
                <Save className="h-4 w-4 mr-1.5" /> Save my House
              </Button>
            )}
          </div>
        </div>
        {demo && (
          <div className="max-w-4xl mx-auto px-4 pb-3">
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {!demo || step.key === "start" ? (
          <StartScreen onBlank={startBlank} onSample={startSample} />
        ) : step.key === "purpose" ? (
          <FieldStep
            icon={<Compass className="h-6 w-6" />}
            title="Why are you thinking about this?"
            description="Your purpose is the goal of your reasoning — what you want to figure out or decide."
            placeholder="e.g. Decide whether starting a club is worth my time."
            value={demo.purpose}
            onChange={(v) => update({ purpose: v })}
          />
        ) : step.key === "question" ? (
          <FieldStep
            icon={<HelpCircle className="h-6 w-6" />}
            title="What's your overarching question?"
            description="A single, focused question your House will answer."
            placeholder="e.g. Should I start a club at school?"
            value={demo.overarching_question}
            onChange={(v) => update({ overarching_question: v })}
            single
          />
        ) : step.key === "povs" ? (
          <PovStep demo={demo} update={update} />
        ) : step.key === "subq" ? (
          <SubQStep demo={demo} update={update} />
        ) : step.key === "conclusion" ? (
          <FieldStep
            icon={<Flag className="h-6 w-6" />}
            title="What's your tentative conclusion?"
            description="Based on the perspectives and sub-questions above, what's your current best answer?"
            placeholder="e.g. Yes — but only if at least 5 students commit upfront."
            value={demo.overarching_conclusion}
            onChange={(v) => update({ overarching_conclusion: v })}
          />
        ) : (
          <DoneScreen demo={demo} onSave={triggerSave} onRestart={restart} />
        )}

        {demo && step.key !== "start" && step.key !== "done" && (
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx <= 1}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <div className="text-xs text-muted-foreground">
              Step {stepIdx} of {STEPS.length - 2}
            </div>
            <Button
              onClick={() =>
                setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))
              }
            >
              {stepIdx === STEPS.length - 2 ? "Finish" : "Next"}{" "}
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        )}

        {demo && step.key !== "start" && (
          <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={restart}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Restart demo
            </button>
            <p className="text-xs text-muted-foreground">
              No account needed. Your work is saved on this device until you create one.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function StartScreen({ onBlank, onSample }: { onBlank: () => void; onSample: () => void }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> No sign-up required
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
          Try Houses of Thought
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Build a small House in under 2 minutes. Your work is saved on this device — sign up later only if you want to keep it.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
          onClick={onSample}
        >
          <CardContent className="p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-lg">
              Use a sample question
            </h3>
            <p className="text-sm text-muted-foreground">
              Start with <em>"Should I start a club at school?"</em> — already filled in so you can see how a House works.
            </p>
            <p className="text-xs text-primary font-medium pt-1">
              Recommended →
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
          onClick={onBlank}
        >
          <CardContent className="p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-lg">
              Start with my own question
            </h3>
            <p className="text-sm text-muted-foreground">
              You'll be guided step by step — purpose, perspectives, sub-questions, and a conclusion.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Takes about 2 minutes →
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FieldStep({
  icon,
  title,
  description,
  placeholder,
  value,
  onChange,
  single = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  single?: boolean;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      {single ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-base"
        />
      ) : (
        <Textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="text-base"
        />
      )}
    </div>
  );
}

function PovStep({ demo, update }: { demo: DemoSession; update: (p: Partial<DemoSession>) => void }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<DemoPovCategory>("individual");

  const add = () => {
    if (!label.trim()) return;
    update({
      povs: [
        ...demo.povs,
        { id: cryptoId(), label: label.trim(), parent_category: category },
      ],
    });
    setLabel("");
  };

  const remove = (id: string) => {
    update({ povs: demo.povs.filter((p) => p.id !== id) });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Users className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-display font-bold text-foreground">
            Whose perspectives matter?
          </h2>
          <p className="text-muted-foreground">
            Add a few points of view that will shape your reasoning. Group them by Individual, Group, or Ideas.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DemoPovCategory)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {POV_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Potential members"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <Button onClick={add} disabled={!label.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {demo.povs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            No perspectives yet — add a couple above.
          </p>
        ) : (
          demo.povs.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] uppercase font-mono text-muted-foreground shrink-0 w-16">
                  {p.parent_category}
                </span>
                <span className="text-sm text-foreground truncate">{p.label}</span>
              </div>
              <button
                onClick={() => remove(p.id)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SubQStep({ demo, update }: { demo: DemoSession; update: (p: Partial<DemoSession>) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<DemoPovCategory>("individual");

  const add = () => {
    if (!q.trim()) return;
    update({
      subQuestions: [
        ...demo.subQuestions,
        {
          id: cryptoId(),
          question: q.trim(),
          pov_category: cat,
          pov_label_id: null,
          information: "",
          sub_conclusion: "",
        },
      ],
    });
    setQ("");
  };

  const remove = (id: string) => {
    update({ subQuestions: demo.subQuestions.filter((s) => s.id !== id) });
  };

  const updateOne = (id: string, patch: Partial<DemoSession["subQuestions"][number]>) => {
    update({
      subQuestions: demo.subQuestions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ListTree className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-display font-bold text-foreground">
            Break it into sub-questions
          </h2>
          <p className="text-muted-foreground">
            Smaller, answerable questions that, taken together, will help you answer your overarching question.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as DemoPovCategory)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {POV_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Is there genuine interest from other students?"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <Button onClick={add} disabled={!q.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-3">
        {demo.subQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Add at least one sub-question above.
          </p>
        ) : (
          demo.subQuestions.map((s, i) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">
                      #{i + 1} · {s.pov_category}
                    </span>
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  value={s.question}
                  onChange={(e) => updateOne(s.id, { question: e.target.value })}
                  className="font-medium"
                />
                <Textarea
                  value={s.sub_conclusion}
                  onChange={(e) => updateOne(s.id, { sub_conclusion: e.target.value })}
                  placeholder="Your tentative answer to this sub-question (optional)"
                  rows={2}
                  className="text-sm"
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function DoneScreen({
  demo,
  onSave,
  onRestart,
}: {
  demo: DemoSession;
  onSave: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-6 animate-fade-in py-8">
      <div className="h-16 w-16 mx-auto rounded-full bg-primary/15 text-primary flex items-center justify-center">
        <Check className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-display font-bold text-foreground">
          Nice work — your House is taking shape.
        </h2>
        <p className="text-muted-foreground">
          To save it, unlock AI features (sub-question generation, assumption testing, research mode), and continue refining your reasoning, create a free account.
        </p>
      </div>

      <Card className="text-left">
        <CardContent className="p-5 space-y-2">
          <p className="text-xs uppercase font-mono text-muted-foreground">Question</p>
          <p className="font-medium text-foreground">
            {demo.overarching_question || <em className="text-muted-foreground">Not set</em>}
          </p>
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div>
              <div className="text-2xl font-display font-bold text-foreground">
                {demo.povs.length}
              </div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground">
                Perspectives
              </div>
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-foreground">
                {demo.subQuestions.length}
              </div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground">
                Sub-questions
              </div>
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-foreground">
                {demo.overarching_conclusion ? <Check className="h-6 w-6 mx-auto text-primary" /> : "—"}
              </div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground">
                Conclusion
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={onSave}>
          <Save className="h-4 w-4 mr-2" /> Create account & save
        </Button>
        <Button size="lg" variant="outline" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  );
}
