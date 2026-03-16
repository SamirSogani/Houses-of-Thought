import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SiteNavbar from "@/components/layout/SiteNavbar";
import SiteFooter from "@/components/layout/SiteFooter";
import {
  Lightbulb,
  Search,
  Bot,
  LayoutDashboard,
  Users,
  ArrowRight,
  GraduationCap,
  Briefcase,
  BookOpen,
  Target,
  MessageSquare,
  Eye,
  Layers,
  ChevronRight,
} from "lucide-react";

const frameworkSteps = [
  { label: "Purpose", icon: Target, color: "text-roof" },
  { label: "Question", icon: MessageSquare, color: "text-primary" },
  { label: "Points of View", icon: Eye, color: "text-pov-individual" },
  { label: "Sub-Questions", icon: Layers, color: "text-pov-group" },
  { label: "Information", icon: Search, color: "text-atmosphere" },
  { label: "Assumptions", icon: Lightbulb, color: "text-assumption" },
  { label: "Sub-Conclusions", icon: ChevronRight, color: "text-pov-ideas" },
  { label: "Conclusion", icon: Target, color: "text-ceiling" },
  { label: "Implications & Consequences", icon: ArrowRight, color: "text-foundation" },
];

const features = [
  {
    icon: LayoutDashboard,
    title: "Draft Full House",
    description: "Auto-generate a full reasoning structure from your question and background context.",
  },
  {
    icon: Search,
    title: "Research Mode",
    description: "Verify evidence and sources to strengthen your reasoning with credible information.",
  },
  {
    icon: Bot,
    title: "AI Reasoning Assistant",
    description: "Generate sub-questions, test assumptions, and get intelligent feedback on your reasoning.",
  },
  {
    icon: Layers,
    title: "Interactive House Diagram",
    description: "Build your reasoning visually using the House of Thought framework diagram.",
  },
  {
    icon: Users,
    title: "Student & Teacher Collaboration",
    description: "Teachers can monitor and guide student reasoning projects in real-time.",
  },
];

const audiences = [
  {
    icon: GraduationCap,
    title: "Students",
    description: "Develop critical thinking skills through structured reasoning exercises and AI guidance.",
  },
  {
    icon: BookOpen,
    title: "Teachers",
    description: "Monitor and guide reasoning projects. Provide structured feedback on student thinking.",
  },
  {
    icon: Briefcase,
    title: "Researchers & Professionals",
    description: "Analyze complex problems systematically. Build defensible arguments and decisions.",
  },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SiteNavbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Blueprint grid background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(hsl(var(--blueprint-line)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--blueprint-line)) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Copy */}
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight">
                Think Clearly.{" "}
                <span className="text-primary">Reason Better.</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed">
                House of Thought is an AI-powered reasoning system that helps you break down complex questions, examine different perspectives, and build stronger conclusions.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" onClick={() => navigate("/auth")}>
                  Create Account
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                  Log In
                </Button>
                <Button size="lg" variant="secondary" onClick={() => navigate("/auth")}>
                  Start Free Trial
                </Button>
              </div>
            </div>

            {/* House Diagram Visual */}
            <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
              <div className="relative mx-auto max-w-sm">
                {/* Atmosphere */}
                <div className="bg-atmosphere-bg border-2 border-atmosphere rounded-t-lg px-4 py-3 text-center">
                  <p className="text-xs font-mono text-muted-foreground">ATMOSPHERE</p>
                  <p className="text-sm font-display font-semibold text-foreground">Concepts & Definitions</p>
                </div>

                {/* Roof */}
                <div className="bg-card border-2 border-roof px-4 py-3 text-center">
                  <p className="text-xs font-mono text-muted-foreground">PURPOSE</p>
                  <p className="text-sm font-display font-semibold text-foreground">Overarching Question</p>
                </div>

                {/* Columns */}
                <div className="grid grid-cols-3 gap-1 my-1">
                  <div className="pov-individual border rounded p-2 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground">Individual</p>
                  </div>
                  <div className="pov-group border rounded p-2 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground">Group</p>
                  </div>
                  <div className="pov-ideas border rounded p-2 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground">Ideas</p>
                  </div>
                </div>

                {/* Assumptions */}
                <div className="bg-assumption-bg border-2 border-assumption px-4 py-2 text-center">
                  <p className="text-xs font-mono text-muted-foreground">ASSUMPTIONS</p>
                </div>

                {/* Foundation */}
                <div className="bg-foundation-bg border-2 border-foundation rounded-b-lg px-4 py-3 text-center">
                  <p className="text-xs font-mono text-muted-foreground">FOUNDATION</p>
                  <p className="text-sm font-display font-semibold text-foreground">Conclusion & Implications</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IS HOUSE OF THOUGHT */}
      <section id="about" className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              What is the House of Thought?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A structured reasoning framework that guides you through every element of critical thinking — from defining your purpose to evaluating your conclusions.
            </p>
          </div>

          {/* Step flow */}
          <div className="flex flex-wrap justify-center gap-2 md:gap-0 items-center">
            {frameworkSteps.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5 px-3 py-2">
                  <step.icon className={`h-6 w-6 ${step.color}`} />
                  <span className="text-xs font-medium text-foreground text-center leading-tight max-w-[80px]">
                    {step.label}
                  </span>
                </div>
                {i < frameworkSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" onClick={() => navigate("/framework")}>
              <BookOpen className="h-4 w-4 mr-2" /> Learn the Full Framework
            </Button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to think critically, reason systematically, and build stronger arguments.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card
              key={f.title}
              className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* WHO IT IS FOR */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              Who Is It For?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {audiences.map((a, i) => (
              <div
                key={a.title}
                className="text-center space-y-4 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <a.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground">{a.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            Start Building Better Thinking Today
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Join students, teachers, and professionals who use the House of Thought to reason more clearly.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Create Account
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Start Free Trial
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
