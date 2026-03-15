import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ChevronRight, BookOpen, Lightbulb, Target, Eye, HelpCircle, Layers, Brain, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

/* ─── Data ─── */

const HOUSE_LAYERS = [
  {
    id: "conclusion",
    label: "Overarching Conclusion",
    element: "7.2",
    description: "The final, well-supported answer to the overarching question — synthesized from all sub-conclusions.",
    color: "bg-roof/10 border-roof text-roof",
    position: "roof",
  },
  {
    id: "sub-conclusions",
    label: "Sub-Conclusions",
    element: "7.1",
    description: "Intermediate conclusions that directly answer each sub-question, logically derived from assumptions and information.",
    color: "bg-primary/10 border-primary text-primary",
    position: "upper",
  },
  {
    id: "inference",
    label: "Inference / Logical Reasoning",
    element: "6",
    description: "The logical process of drawing conclusions from information and assumptions — the engine of the house.",
    color: "bg-atmosphere/10 border-atmosphere text-atmosphere",
    position: "middle",
  },
  {
    id: "assumptions",
    label: "Assumptions",
    element: "5",
    description: "Explicit premises, hidden premises, conceptual frameworks, and background beliefs that shape reasoning.",
    color: "bg-assumption/10 border-assumption text-assumption",
    position: "lower",
  },
  {
    id: "information",
    label: "Information / Evidence",
    element: "4",
    description: "Verified facts, data, and evidence that form the foundation of reasoning.",
    color: "bg-foundation/10 border-foundation text-foundation",
    position: "foundation",
  },
];

const INPUT_ELEMENTS = [
  {
    icon: Target,
    label: "Purpose",
    element: "2",
    description: "The overarching goal or objective that frames your inquiry and directs the analysis.",
  },
  {
    icon: HelpCircle,
    label: "Overarching Question",
    element: "3.1",
    description: "The central question your analysis seeks to answer. All sub-questions flow from this.",
  },
  {
    icon: Eye,
    label: "Points of View",
    element: "4.1",
    description: "The perspectives from which sub-questions are formulated, ensuring comprehensive coverage.",
    subcategories: [
      { label: "Personal / Foundational", description: "Biological, social, familial, and individual perspectives that shape your worldview." },
      { label: "Group POVs", description: "Perspectives from communities, organizations, cultures, or societal groups." },
      { label: "Ideas / Disciplines", description: "Academic disciplines, theoretical frameworks, or schools of thought." },
    ],
  },
  {
    icon: Layers,
    label: "Sub-Questions",
    element: "3.2",
    description: "Focused questions derived from specific points of view that collectively address the overarching question.",
  },
];

const REASONING_LAYERS = [
  {
    label: "Information",
    element: "Facts, Data & Evidence",
    detail: "The foundation layer. All reasoning must begin with verified, reliable information — facts, data, research findings, and documented evidence. Without solid information, the house has no stable base.",
    icon: BookOpen,
  },
  {
    label: "Assumptions",
    element: "Premises & Frameworks",
    detail: "The first structural layer. Assumptions include explicit premises (stated beliefs), hidden premises (unstated beliefs), conceptual frameworks (mental models), and background definitions that shape how information is interpreted.",
    icon: AlertTriangle,
  },
  {
    label: "Inference",
    element: "Logical Reasoning",
    detail: "The active process of reasoning — applying logic to move from information and assumptions toward conclusions. This is where deductive, inductive, and abductive reasoning occur.",
    icon: Brain,
  },
  {
    label: "Sub-Conclusions",
    element: "Intermediate Answers",
    detail: "Each sub-question receives its own conclusion, logically derived from the information, assumptions, and reasoning specific to that question. These are precise intermediate answers, not summaries.",
    icon: CheckCircle2,
  },
  {
    label: "Overarching Conclusion",
    element: "Final Synthesis",
    detail: "The roof of the house. A single, well-supported conclusion that synthesizes all sub-conclusions into a coherent answer to the overarching question.",
    icon: Target,
  },
];

const BENEFITS = [
  { title: "Stronger Reasoning", description: "Every conclusion is traced back through logical steps to verified information." },
  { title: "Clearer Thinking", description: "Breaking complex questions into structured components reveals hidden assumptions and gaps." },
  { title: "Better Decisions", description: "Decisions grounded in structured analysis are more defensible and less prone to bias." },
  { title: "Multiple Perspectives", description: "Systematic consideration of different points of view prevents tunnel vision." },
];

/* ─── Component ─── */

export default function FrameworkPage() {
  const navigate = useNavigate();
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  const scrollToDiagram = () => {
    document.getElementById("house-diagram")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* ── SECTION 1: HERO ── */}
      <section className="relative py-24 px-6 text-center border-b border-border">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground">Critical Thinking Framework</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight text-foreground">
            The House of Thought Framework
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            A structured method for rigorous reasoning and critical thinking — based on John Trapasso's model, derived from the Paul-Elder framework for critical thinking.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button onClick={scrollToDiagram} variant="outline" size="lg" className="gap-2">
              <ArrowDown className="h-4 w-4" /> View Diagram
            </Button>
            <Button onClick={() => navigate("/dashboard")} size="lg" className="gap-2">
              Start a House <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: INTERACTIVE HOUSE DIAGRAM ── */}
      <section id="house-diagram" className="py-20 px-6 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground text-center mb-2">Section 2</p>
          <h2 className="text-3xl font-display font-bold text-center mb-4">The House Structure</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
            Hover over each layer to understand its role in the reasoning process.
          </p>

          <div className="space-y-3 max-w-xl mx-auto">
            {/* Roof peak */}
            <div className="flex justify-center mb-1">
              <div
                className="w-0 h-0 border-l-[160px] border-r-[160px] border-b-[48px] border-l-transparent border-r-transparent"
                style={{ borderBottomColor: "hsl(var(--roof-slate))" }}
              />
            </div>

            {HOUSE_LAYERS.map((layer) => (
              <Tooltip key={layer.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`relative border-2 rounded-md px-6 py-4 cursor-pointer transition-all duration-200 ${layer.color} ${activeLayer === layer.id ? "scale-[1.02] shadow-lg" : "hover:scale-[1.01] hover:shadow-md"}`}
                    onMouseEnter={() => setActiveLayer(layer.id)}
                    onMouseLeave={() => setActiveLayer(null)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono opacity-60 mr-2">{layer.element}</span>
                        <span className="font-semibold text-sm">{layer.label}</span>
                      </div>
                    </div>
                    {activeLayer === layer.id && (
                      <p className="text-xs mt-2 opacity-80 leading-relaxed animate-fade-in">{layer.description}</p>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm">{layer.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Foundation base */}
            <div className="h-3 rounded-b-lg" style={{ background: "hsl(var(--foundation-stone) / 0.3)" }} />
          </div>
        </div>
      </section>

      {/* ── SECTION 3: INPUTS TO THE HOUSE ── */}
      <section className="py-20 px-6 border-b border-border bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground text-center mb-2">Section 3</p>
          <h2 className="text-3xl font-display font-bold text-center mb-4">Inputs to the House</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
            These elements guide and frame the reasoning process before the house is built.
          </p>

          <div className="space-y-6 max-w-lg mx-auto">
            {INPUT_ELEMENTS.map((item, i) => (
              <div key={item.label} className="relative">
                <div className="flex gap-4 items-start p-5 rounded-lg border border-border bg-card">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{item.element}</span>
                      <h3 className="font-display font-semibold text-foreground">{item.label}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>

                    {item.subcategories && (
                      <div className="mt-3 space-y-2">
                        {item.subcategories.map((sub) => (
                          <div key={sub.label} className="pl-3 border-l-2 border-primary/20">
                            <p className="text-sm font-medium text-foreground">{sub.label}</p>
                            <p className="text-xs text-muted-foreground">{sub.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {i < INPUT_ELEMENTS.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: THE REASONING PROCESS ── */}
      <section className="py-20 px-6 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground text-center mb-2">Section 4</p>
          <h2 className="text-3xl font-display font-bold text-center mb-4">The Reasoning Process</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
            Each layer of the house builds upon the one below, creating a chain of reasoning.
          </p>

          <div className="space-y-8 max-w-2xl mx-auto">
            {REASONING_LAYERS.map((layer, i) => (
              <div key={layer.label} className="relative">
                <div className="flex gap-5 items-start">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <layer.icon className="h-6 w-6 text-primary" />
                    </div>
                    {i < REASONING_LAYERS.length - 1 && (
                      <div className="w-px h-8 bg-border mt-2" />
                    )}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-display font-bold text-lg text-foreground">{layer.label}</h3>
                    <p className="text-xs font-mono text-muted-foreground mb-2">{layer.element}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{layer.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: AFTER THE HOUSE ── */}
      <section className="py-20 px-6 border-b border-border bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground text-center mb-2">Section 5</p>
          <h2 className="text-3xl font-display font-bold text-center mb-4">After the House</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
            Once a conclusion is reached, reasoning continues forward into prediction and observation.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
            {[
              {
                title: "Conclusion",
                description: "The synthesized answer derived from structured reasoning.",
                accent: "border-primary bg-primary/5",
              },
              null,
              {
                title: "Implications",
                description: "AI-predicted outcomes — what should logically follow if the conclusion is correct. Generated by the AI and refined as actual consequences emerge.",
                accent: "border-atmosphere bg-atmosphere/5",
              },
              null,
              {
                title: "Consequences",
                description: "Actual real-world outcomes entered by the user as they unfold. These feed back into the AI to refine predicted implications.",
                accent: "border-assumption bg-assumption/5",
              },
            ].map((item, i) =>
              item === null ? (
                <ArrowRight key={`arrow-${i}`} className="h-5 w-5 text-muted-foreground shrink-0 rotate-90 md:rotate-0" />
              ) : (
                <div key={item.title} className={`flex-1 border-2 rounded-lg p-5 ${item.accent}`}>
                  <h3 className="font-display font-bold text-base text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: WHY IT MATTERS ── */}
      <section className="py-20 px-6 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground text-center mb-2">Section 6</p>
          <h2 className="text-3xl font-display font-bold text-center mb-4">Why the House of Thought Matters</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
            Structured reasoning isn't just an academic exercise — it produces better outcomes.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {BENEFITS.map((b) => (
              <div key={b.title} className="p-5 rounded-lg border border-border bg-card">
                <h3 className="font-display font-semibold text-foreground mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: HOW THE AI USES THE HOUSE ── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground text-center mb-2">Section 7</p>
          <h2 className="text-3xl font-display font-bold text-center mb-4">How the AI Uses the House</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
            The AI assistant helps you construct rigorous analyses by generating each component of the House of Thought — from diverse points of view and precise sub-questions, through comprehensive assumptions and logical reasoning, to well-supported conclusions.
          </p>

          <div className="bg-card border border-border rounded-lg p-6 max-w-xl mx-auto space-y-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Draft Full House</strong> — The AI researches your topic, generates sub-questions from multiple points of view, populates comprehensive assumptions, applies logical reasoning, and produces sub-conclusions — all in one structured draft.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Research Mode</strong> — Before generating, the AI actively synthesizes reliable, high-quality information to ground every assumption and inference in evidence.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Review & Refine</strong> — Every AI-generated draft is presented for your review. Accept, decline, or refine each component to match your reasoning.
              </p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button onClick={() => navigate("/dashboard")} size="lg" className="gap-2">
              Start Building <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
