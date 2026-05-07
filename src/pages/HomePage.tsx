import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AppNavbar from "@/components/layout/AppNavbar";
import SiteFooter from "@/components/layout/SiteFooter";
import {
  ArrowRight,
  Sparkles,
  Layers,
  Network,
  Compass,
  Brain,
  Boxes,
  MessageSquareOff,
  FileQuestion,
  Workflow,
  Microscope,
  GraduationCap,
  Target,
  BookOpen,
  Rocket,
  Library,
  Check,
  X,
  AlertTriangle,
  Wand2,
  ShieldAlert,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  HERO VISUAL — animated spatial graph of connected "rooms"                 */
/* -------------------------------------------------------------------------- */

function SpatialGraph() {
  // Simple deterministic node graph — feels like rooms/concepts wired together
  const nodes = [
    { id: "purpose",    x: 50,  y: 18, label: "Purpose",     size: 14 },
    { id: "question",   x: 50,  y: 42, label: "Question",    size: 18 },
    { id: "pov-self",   x: 18,  y: 62, label: "Self",        size: 11 },
    { id: "pov-group",  x: 50,  y: 70, label: "Group",       size: 11 },
    { id: "pov-ideas",  x: 82,  y: 62, label: "Ideas",       size: 11 },
    { id: "evidence",   x: 30,  y: 86, label: "Evidence",    size: 9  },
    { id: "assumption", x: 70,  y: 86, label: "Assumption",  size: 9  },
    { id: "conclusion", x: 50,  y: 96, label: "Conclusion",  size: 13 },
  ];
  const edges: [string, string][] = [
    ["purpose", "question"],
    ["question", "pov-self"],
    ["question", "pov-group"],
    ["question", "pov-ideas"],
    ["pov-self", "evidence"],
    ["pov-group", "evidence"],
    ["pov-group", "assumption"],
    ["pov-ideas", "assumption"],
    ["evidence", "conclusion"],
    ["assumption", "conclusion"],
  ];
  const find = (id: string) => nodes.find((n) => n.id === id)!;

  return (
    <div className="relative aspect-square w-full max-w-md mx-auto">
      {/* blueprint grid */}
      <div
        className="absolute inset-0 rounded-2xl opacity-[0.18]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--blueprint-line)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--blueprint-line)) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
      {/* glow */}
      <div className="absolute -inset-8 bg-primary/10 blur-3xl rounded-full pointer-events-none" />

      <svg viewBox="0 0 100 110" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {edges.map(([a, b], i) => {
          const A = find(a);
          const B = find(b);
          return (
            <line
              key={`${a}-${b}`}
              x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke="url(#edgeGrad)"
              strokeWidth="0.35"
              strokeDasharray="1.5 1.5"
              style={{
                animation: `dashflow 6s linear infinite`,
                animationDelay: `${i * 0.25}s`,
              }}
            />
          );
        })}
        {nodes.map((n, i) => (
          <g key={n.id} style={{ animation: `nodepulse 4s ease-in-out infinite`, animationDelay: `${i * 0.3}s`, transformOrigin: `${n.x}px ${n.y}px` }}>
            <circle cx={n.x} cy={n.y} r={n.size / 6 + 1.5} fill="hsl(var(--primary))" opacity="0.12" />
            <circle cx={n.x} cy={n.y} r={n.size / 8} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="0.4" />
          </g>
        ))}
      </svg>

      {/* labels */}
      {nodes.map((n) => (
        <div
          key={n.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-mono tracking-wide text-foreground/80 bg-card/70 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border/60 whitespace-nowrap"
          style={{ left: `${n.x}%`, top: `${(n.y / 110) * 100}%` }}
        >
          {n.label}
        </div>
      ))}

      <style>{`
        @keyframes dashflow {
          to { stroke-dashoffset: -30; }
        }
        @keyframes nodepulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reveal-on-scroll wrapper                                                  */
/* -------------------------------------------------------------------------- */

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out`}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

const problems = [
  { icon: ShieldAlert,     title: "Confident, often wrong",     body: "AI delivers fluent answers whether or not they're true. Hallucinations, fabricated sources, and unverifiable claims arrive in the same authoritative tone as facts." },
  { icon: FileQuestion,    title: "Shallow by default",         body: "Single perspective. No weighing of evidence. No assumptions surfaced. You get a verdict — not the reasoning that should justify it." },
  { icon: AlertTriangle,   title: "No accountability for claims", body: "Citations are optional, sources go unchecked, and counter-arguments are skipped unless you remember to ask. Reliability is on you." },
  { icon: MessageSquareOff,title: "Context that won't compound", body: "Every chat starts from zero. Yesterday's reasoning is gone — so understanding never builds, it only restarts." },
];

const useCases = [
  { icon: Rocket,     title: "Startup planning",      body: "Pressure-test strategy across stakeholders, assumptions, and second-order effects." },
  { icon: Microscope, title: "Research organization", body: "Map sources, claims, and counter-claims into one coherent reasoning surface." },
  { icon: Library,    title: "Philosophy & worldview",body: "Build, revise, and stress-test the ideas you actually live by." },
  { icon: GraduationCap, title: "Studying & learning", body: "Move from highlights to genuine understanding through structured questioning." },
  { icon: Target,     title: "Long-term goals",        body: "Reason about decisions over months — not in a chat thread that disappears." },
  { icon: BookOpen,   title: "Personal knowledge",     body: "A persistent place where your best thinking compounds instead of dissolving." },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <main>
        {/* ============================== HERO ============================== */}
        <section className="relative overflow-hidden">
          {/* ambient blueprint grid */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--blueprint-line)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--blueprint-line)) 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
          />
          {/* radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/[0.07] rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
              <div className="space-y-7 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs font-mono text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  A workspace for <span className="text-foreground">slow thinking</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-foreground leading-[1.05] tracking-tight">
                  AI generates thoughts.{" "}
                  <span className="text-primary">Build reasoning instead.</span>
                </h1>

                <p className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
                  Houses of Thought is a spatial, persistent environment for structured thinking — where ideas connect, context survives, and decisions get measurably better over time.
                </p>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Button size="lg" onClick={() => navigate("/demo")} className="group">
                    Try it instantly
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=signup")}>
                    Create Account
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => navigate("/auth")}>
                    Log In
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  No sign-up required to try — your work is saved locally until you create an account.
                </p>
                <p className="text-xs text-muted-foreground/80 pt-1">
                  Created by <span className="font-semibold text-foreground/90">Samir Sogani</span> · Based on <span className="font-semibold text-foreground/90">John Trapasso's</span> <em>House of Thought</em> model
                </p>
              </div>

              <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
                <SpatialGraph />
              </div>
            </div>
          </div>
        </section>

        {/* ============================== PROBLEM ============================ */}
        <section className="relative border-t border-border bg-card/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <Reveal>
              <div className="max-w-3xl">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">The problem</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-foreground leading-tight">
                  AI sounds certain.{" "}
                  <span className="text-muted-foreground">That doesn't mean it's right.</span>
                </h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                  Modern chatbots optimize for fluency, not truth. They produce confident, polished answers without showing the reasoning, weighing the evidence, or surfacing what they assumed — leaving you to trust an output you can't actually verify.
                </p>
              </div>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
              {problems.map((p, i) => (
                <Reveal key={p.title} delay={i * 90}>
                  <Card className="h-full bg-background/60 backdrop-blur border-border/60 hover:border-primary/40 transition-colors">
                    <CardContent className="p-6 space-y-3">
                      <div className="h-10 w-10 rounded-md bg-destructive/10 flex items-center justify-center">
                        <p.icon className="h-5 w-5 text-destructive/80" />
                      </div>
                      <h3 className="font-display font-semibold text-foreground">{p.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== DIFFERENCE ========================= */}
        <section className="relative border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto mb-14">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">The difference</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-foreground leading-tight">
                  A new shape for thinking.
                </h2>
                <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
                  Chat is a line. Thought is a structure. Houses of Thought gives reasoning the space, persistence, and architecture it deserves.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <Reveal>
                <Card className="h-full border-border/60 bg-card/30">
                  <CardContent className="p-8 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                        <MessageSquareOff className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <h3 className="font-display font-semibold text-foreground">Traditional AI Chat</h3>
                    </div>
                    <ul className="space-y-3">
                      {[
                        "Linear conversations",
                        "Disposable context",
                        "Instant, shallow answers",
                        "Fragmented reasoning",
                        "No long-term structure",
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <X className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={120}>
                <Card className="h-full border-primary/40 bg-primary/[0.04] shadow-lg shadow-primary/[0.06]">
                  <CardContent className="p-8 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
                        <Network className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold text-foreground">Houses of Thought</h3>
                    </div>
                    <ul className="space-y-3">
                      {[
                        "Spatial cognition",
                        "Persistent structures",
                        "Interconnected concepts",
                        "Reflective, deliberate thinking",
                        "Long-term reasoning that compounds",
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-3 text-sm text-foreground/90">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="font-medium">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Reveal>
            </div>

            <Reveal delay={200}>
              <p className="text-center text-sm text-muted-foreground italic mt-10 max-w-2xl mx-auto">
                Slowness, here, is a feature. Deliberation is the product.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ============================== USE CASES ========================== */}
        <section className="relative border-t border-border bg-card/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <Reveal>
              <div className="max-w-3xl mb-14">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">Built for</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-foreground leading-tight">
                  The questions worth thinking slowly about.
                </h2>
              </div>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {useCases.map((u, i) => (
                <Reveal key={u.title} delay={i * 70}>
                  <Card className="group h-full border-border/60 bg-background/60 backdrop-blur hover:border-primary/40 hover:-translate-y-0.5 transition-all">
                    <CardContent className="p-6 space-y-3">
                      <div className="h-11 w-11 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <u.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold text-foreground">{u.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{u.body}</p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== EXPERIENCE ========================= */}
        <section className="relative border-t border-border overflow-hidden">
          {/* atmospheric glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/[0.06] rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center">
            <Reveal>
              <Compass className="h-10 w-10 text-primary mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-foreground leading-tight">
                Step inside. Build something you can return to.
              </h2>
              <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Explore a live house in seconds — no signup, no friction. When you're ready, your work moves with you.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-10">
                <Button size="lg" onClick={() => navigate("/demo")} className="group">
                  Try it instantly
                  <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=signup")}>
                  Create Account
                </Button>
                <Button size="lg" variant="ghost" onClick={() => navigate("/framework")}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Learn the framework
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
