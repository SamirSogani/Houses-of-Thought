import { useNavigate } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import SiteFooter from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Network,
  Brain,
  BookOpen,
  Sparkles,
  Shield,
  Share2,
  Users,
  Target,
  GitBranch,
  Eye,
  Zap,
  ArrowRight,
} from "lucide-react";

const featureCategories = [
  {
    title: "Spatial Reasoning",
    icon: Network,
    features: [
      {
        icon: Layers,
        title: "Houses, not chats",
        body: "Build persistent reasoning structures — concepts, questions, perspectives, and conclusions arranged spatially instead of linearly.",
      },
      {
        icon: GitBranch,
        title: "Multiple points of view",
        body: "Examine every sub-question through individual, group, and disciplinary lenses to surface what one perspective always misses.",
      },
      {
        icon: Eye,
        title: "Assumptions made visible",
        body: "Surface and label the premises shaping your conclusions — so you can question them instead of inheriting them.",
      },
    ],
  },
  {
    title: "AI as Reasoning Partner",
    icon: Brain,
    features: [
      {
        icon: Sparkles,
        title: "Context-aware AI sidebar",
        body: "Suggestions grounded in the exact section you're working in — not generic answers detached from your reasoning.",
      },
      {
        icon: Zap,
        title: "Stress-test your logic",
        body: "AI Attack Mode generates counter-arguments, exposes weak evidence, and challenges your conclusions on demand.",
      },
      {
        icon: Target,
        title: "Logic strength scoring",
        body: "A 0–100 evaluation of your reasoning — measuring evidence, coverage of perspectives, and structural integrity.",
      },
    ],
  },
  {
    title: "Built for Real Work",
    icon: Shield,
    features: [
      {
        icon: BookOpen,
        title: "MLA 9 citations enforced",
        body: "Evidence must be sourced, rated, and properly cited. Reasoning that holds up to scrutiny by default.",
      },
      {
        icon: Share2,
        title: "Public sharing",
        body: "Publish any house as a read-only public link — perfect for collaboration, peer review, or public discourse.",
      },
      {
        icon: Users,
        title: "Classrooms for educators",
        body: "Teachers create assignments, students submit houses, and discussions happen inline with comments.",
      },
    ],
  },
];

export default function FeaturesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--blueprint-line)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--blueprint-line)) 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/[0.06] rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Features
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight">
              Everything you need to{" "}
              <span className="text-primary">think slowly, clearly, deeply.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Houses of Thought is built for the questions that deserve more than a chat reply — and the answers that should outlive a session.
            </p>
          </div>
        </section>

        {/* Feature categories */}
        {featureCategories.map((cat, ci) => (
          <section
            key={cat.title}
            className={`border-b border-border ${ci % 2 === 1 ? "bg-card/40" : ""}`}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
              <div className="flex items-center gap-3 mb-10">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <cat.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                  {cat.title}
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cat.features.map((f) => (
                  <Card
                    key={f.title}
                    className="h-full bg-background/60 backdrop-blur border-border/60 hover:border-primary/40 transition-colors"
                  >
                    <CardContent className="p-6 space-y-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <f.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold text-foreground">
                        {f.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {f.body}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="border-b border-border">
          <div className="max-w-4xl mx-auto px-4 py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              See it in action.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Open a live house in seconds — no signup required.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Button size="lg" onClick={() => navigate("/demo")} className="group">
                Try it instantly
                <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/framework")}>
                <BookOpen className="h-4 w-4 mr-2" /> Learn the framework
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
