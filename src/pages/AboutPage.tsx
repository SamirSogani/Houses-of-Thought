import { useNavigate } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import SiteFooter from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Compass, Heart, Lightbulb, Users } from "lucide-react";

export default function AboutPage() {
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

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">
              About
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight">
              A workspace for{" "}
              <span className="text-primary">slow thinking.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              We're building the tool we wished existed — one that treats reasoning like architecture, not conversation.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                <Compass className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-4 text-foreground/90 leading-relaxed">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                  Our mission
                </h2>
                <p>
                  Modern AI tools optimize for speed and instant answers. Houses of Thought optimizes for{" "}
                  <strong className="text-foreground">clarity, depth, and durability of thought.</strong>
                </p>
                <p className="text-muted-foreground">
                  We believe the most important questions in your life — what to build, what to believe, how to act — deserve more than a chat thread that disappears tomorrow. They deserve a structure you can stand on, return to, revise, and grow.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The framework origin */}
        <section className="border-b border-border bg-card/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-4 text-foreground/90 leading-relaxed">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                  The framework
                </h2>
                <p>
                  Houses of Thought is built on the{" "}
                  <strong className="text-foreground">House of Thought model</strong> developed by{" "}
                  <strong className="text-foreground">John Trapasso</strong>, derived from the Paul-Elder Framework for Critical Thinking.
                </p>
                <p className="text-muted-foreground">
                  The model frames reasoning like a building: concepts and purpose form the foundation, questions and perspectives form the walls, evidence and assumptions form the structure, and conclusions and consequences form the roof. Skip a layer, and the house collapses.
                </p>
                <Button variant="outline" onClick={() => navigate("/framework")} className="mt-2">
                  Read the full framework <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground text-center mb-12">
              What we believe
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: Lightbulb,
                  title: "Slowness is a feature",
                  body: "Deliberation produces better decisions than speed. We design for reflection, not reaction.",
                },
                {
                  icon: Heart,
                  title: "Structure over output",
                  body: "A well-built reasoning structure outlasts any single answer. We invest in the scaffolding.",
                },
                {
                  icon: Users,
                  title: "Thinking is portable",
                  body: "Your reasoning belongs to you. Export it, share it, or keep it private — your choice.",
                },
              ].map((v) => (
                <Card key={v.title} className="bg-background/60 border-border/60">
                  <CardContent className="p-6 space-y-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <v.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-foreground">{v.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{v.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Creator */}
        <section className="border-b border-border bg-card/40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Creator
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Built by Samir Sogani
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Houses of Thought is created by Samir Sogani, based on John Trapasso's{" "}
              <em>House of Thought</em> model. It's an ongoing experiment in what software for thinking — rather than software for output — can look like.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Button size="lg" onClick={() => navigate("/demo")} className="group">
                Try it instantly
                <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
                Get in touch
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
