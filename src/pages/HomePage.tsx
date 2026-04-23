import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SiteNavbar from "@/components/layout/SiteNavbar";
import SiteFooter from "@/components/layout/SiteFooter";
import elementsOfReason from "@/assets/elements-of-reason.png";
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
  Shield,
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
    description: "Generate a structured first draft of a house based on your question and context, so you can move faster and focus more time on refining and improving your reasoning.",
  },
  {
    icon: Search,
    title: "Research Mode",
    description: "Find and verify up-to-date sources to support and strengthen your reasoning with credible information.",
  },
  {
    icon: Bot,
    title: "AI Reasoning Assistant",
    description: "Generate sub-questions, test assumptions, and get intelligent feedback on your reasoning.",
  },
  {
    icon: Layers,
    title: "Interactive House Diagram",
    description: "Build your reasoning visually using the Houses of Thought framework diagram.",
  },
  {
    icon: Users,
    title: "Student & Teacher Collaboration",
    description: "Teachers can monitor and guide student reasoning projects in real-time.",
  },
  {
    icon: Shield,
    title: "Analysis & Testing Tools",
    description: "Evaluate your reasoning with a Logic Strength Meter, stress-test arguments with AI Attack Mode, and measure evidence quality with the Evidence Strength Meter.",
  },
];

const outcomeCards = [
  {
    icon: GraduationCap,
    title: "Students",
    outcome: "Learn faster and stay on track.",
  },
  {
    icon: BookOpen,
    title: "Teachers",
    outcome: "Guide reasoning with clarity.",
  },
  {
    icon: Briefcase,
    title: "Professionals",
    outcome: "Make defensible, well-structured decisions.",
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

      <main>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(hsl(var(--blueprint-line)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--blueprint-line)) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />

        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-20 md:py-32 sm:px-[20px]">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight">
                Think through anything—
                <span className="text-primary">fast, step by step.</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed">
                Break down complex questions, track every step of your reasoning, and reach clear, well-founded conclusions — all with AI-powered support.
              </p>
              <p className="text-sm text-muted-foreground">
                Created by <span className="font-semibold text-foreground">Samir Sogani</span> · Based on <span className="font-semibold text-foreground">John Trapasso's</span> <em>House of Thought</em> model, derived from the <span className="font-semibold text-foreground">Paul-Elder Critical Thinking Framework</span>
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
                  Create Account
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                  Log In
                </Button>
                <Button size="lg" variant="secondary" onClick={() => navigate("/auth?mode=signup")}>
                  Start Free Trial
                </Button>
              </div>
            </div>

            {/* House Diagram Visual */}
            <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
              <img
                src={elementsOfReason}
                alt="The Elements of Reason — House of Thought diagram by John Trapasso"
                className="mx-auto w-full max-w-md rounded-lg border border-border bg-card shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: WHAT IS HOUSES OF THOUGHT */}
      <section id="about" className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              A system for thinking clearly, quickly, and completely
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Houses of Thought helps you break down any question, track every step of your reasoning, and see the full picture of your thought process. Whether you're a student tackling tricky problems, a teacher guiding reasoning projects, or a professional analyzing complex decisions, the platform gives you a step-by-step roadmap from question to conclusion — fast, clear, and structured.
            </p>
          </div>

          {/* Framework step flow */}
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

      {/* SECTION 2: WHY IT MATTERS */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            Why It Matters
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Most reasoning fails not because people aren't capable of thinking critically, but because their thinking is unstructured. Without a clear process, you waste time chasing the wrong questions, get stuck in logical fallacies, and risk weak and unsupported conclusions. Houses of Thought fixes this by providing a visible, structured process that guides you from your initial question to a defensible answer — faster, smarter, and easy to track.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {audiences.map((a, i) => (
            <Card
              key={a.title}
              className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300 animate-fade-in text-center"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <CardContent className="p-8 flex flex-col items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <a.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground">{a.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
              </CardContent>
            </Card>
          ))}
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
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            Start Building Better Thinking Today
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Join students, teachers, and professionals who use the Houses of Thought to reason more clearly.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
              Create Account
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=signup")}>
              Start Free Trial
            </Button>
          </div>
        </div>
      </section>

      </main>

      <SiteFooter />
    </div>
  );
}
