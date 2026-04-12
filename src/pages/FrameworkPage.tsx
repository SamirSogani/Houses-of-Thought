import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowDown, ArrowLeft, ChevronRight, BookOpen, Lightbulb, Target, Eye,
  HelpCircle, Layers, Brain, CheckCircle2, AlertTriangle,
  ArrowRight, RefreshCw, HelpingHand, Zap, BarChart3, Shield,
  Users, GraduationCap, Beaker, Scale, Shapes,
} from "lucide-react";

/* ─── Section wrapper ─── */
function Section({ id, number, title, subtitle, alt, children }: {
  id?: string; number: string; title: string; subtitle?: string; alt?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={id} className={`py-20 px-6 border-b border-border ${alt ? "bg-muted/30" : ""}`}>
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground text-center mb-2">Section {number}</p>
        <h2 className="text-3xl font-display font-bold text-center mb-3">{title}</h2>
        {subtitle && <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
        {!subtitle && <div className="mb-12" />}
        {children}
      </div>
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground leading-relaxed space-y-4 max-w-2xl mx-auto">{children}</div>;
}

function ExampleBox({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg bg-card p-5 my-6 max-w-2xl mx-auto">
      {title && <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">{title}</p>}
      <div className="text-sm text-foreground leading-relaxed">{children}</div>
    </div>
  );
}

/* ─── House diagram layers ─── */
const HOUSE_LAYERS = [
  { id: "implications", label: "Implications & Consequences", element: "8", description: "Predicted outcomes (implications) and actual real-world results (consequences) that follow from the conclusion.", color: "bg-roof/10 border-roof text-roof", link: "s-implications" },
  { id: "conclusion", label: "Overarching Conclusion", element: "7.2", description: "The final, well-supported answer to the overarching question — synthesized from all sub-conclusions.", color: "bg-roof/10 border-roof text-roof", link: "s-conclusion" },
  { id: "sub-conclusions", label: "Sub-Conclusions", element: "7.1", description: "Intermediate conclusions that directly answer each sub-question.", color: "bg-primary/10 border-primary text-primary", link: "s-sub-conclusions" },
  { id: "assumptions", label: "Assumptions", element: "6", description: "Beliefs, premises, and frameworks that shape how information is interpreted.", color: "bg-assumption/10 border-assumption text-assumption", link: "s-assumptions" },
  { id: "information", label: "Information / Facts", element: "5", description: "Verified facts, data, and evidence that form the foundation of reasoning.", color: "bg-foundation/10 border-foundation text-foundation", link: "s-information" },
  { id: "pov", label: "Points of View", element: "4", description: "Multiple perspectives through which the question is examined.", color: "bg-atmosphere/10 border-atmosphere text-atmosphere", link: "s-pov" },
  { id: "question", label: "Overarching Question", element: "3.2", description: "The central question your analysis seeks to answer.", color: "bg-primary/10 border-primary text-primary", link: "s-question" },
  { id: "sub-questions", label: "Sub-Questions", element: "3.1", description: "Focused questions derived from specific points of view.", color: "bg-primary/10 border-primary text-primary", link: "s-sub-questions" },
  { id: "purpose-main", label: "Overarching Purpose", element: "2.2", description: "The goal or objective that frames and directs the entire inquiry.", color: "bg-foundation/10 border-foundation text-foundation", link: "s-purpose" },
  { id: "sub-purposes", label: "Sub-Purposes", element: "2.1", description: "Specific goals that support and refine the overarching purpose.", color: "bg-foundation/10 border-foundation text-foundation", link: "s-purpose" },
  { id: "concepts", label: "Concepts", element: "1", description: "Key terms and definitions that establish shared understanding for your analysis.", color: "bg-atmosphere/10 border-atmosphere text-atmosphere", link: "s-concepts" },
];

/* ─── Component ─── */
export default function FrameworkPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* ── HERO ── */}
      <section className="relative py-24 px-6 text-center border-b border-border">
        <div className="max-w-3xl mx-auto space-y-6">
          <button onClick={() => navigate(user ? "/dashboard" : "/")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto mb-4">
            <ArrowLeft className="h-4 w-4" /> {user ? "Back to Dashboard" : "Back to Home"}
          </button>
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground">Critical Thinking Framework</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight">
            The Houses of Thought Framework
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            A structured method for reasoning clearly and building stronger conclusions.
          </p>
          <p className="text-sm text-muted-foreground">
            Based on John Trapasso's model, derived from the Paul-Elder Framework for Critical Thinking.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button onClick={() => document.getElementById("s1")?.scrollIntoView({ behavior: "smooth" })} variant="outline" size="lg" className="gap-2">
              <ArrowDown className="h-4 w-4" /> Start Learning
            </Button>
            <Button onClick={() => navigate("/dashboard")} size="lg" className="gap-2">
              Try the Platform <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── SECTION 1: WHY STRUCTURED THINKING MATTERS ── */}
      <Section id="s1" number="1" title="Why Structured Thinking Matters" subtitle="Most arguments fail not because people are unintelligent, but because their reasoning is unstructured.">
        <Prose>
          <p>Every day, people make decisions, form opinions, and draw conclusions. But how many of those conclusions are actually well-supported? Many arguments fail because people:</p>
        </Prose>
        <ul className="list-none space-y-3 max-w-2xl mx-auto my-6">
          {[
            { icon: Zap, text: "Jump to conclusions without examining evidence" },
            { icon: Eye, text: "Ignore perspectives that challenge their beliefs" },
            { icon: AlertTriangle, text: "Rely on weak or unexamined assumptions" },
            { icon: HelpCircle, text: "Fail to ask the right questions" },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-3 text-sm text-muted-foreground">
              <item.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        <Prose>
          <p>The Houses of Thought framework solves this by providing a clear, step-by-step structure for reasoning. Think of it like building a house: <strong className="text-foreground">a strong house requires a strong foundation</strong>.</p>
          <p>If your foundation — your facts and evidence — is weak, everything built on top of it will be unstable. If you skip steps, your conclusions will have gaps. The Houses of Thought ensures that every conclusion is traceable back through logical steps to verified information.</p>
        </Prose>
      </Section>

      {/* ── SECTION 2: FULL REASONING FLOW ── */}
      <Section id="house-diagram" number="2" title="The Full Reasoning Flow" subtitle="The complete structure of the Houses of Thought, from purpose to consequences. Click any layer to learn more." alt>
        <Prose>
          <p>Just as an architect designs a building from the ground up, critical thinkers must build their reasoning from the bottom up:</p>
        </Prose>
        <div className="space-y-2.5 max-w-xl mx-auto mt-8">
          {HOUSE_LAYERS.map((layer) => (
            <Tooltip key={layer.id}>
              <TooltipTrigger asChild>
                <div
                  className={`relative border-2 rounded-md px-5 py-3.5 cursor-pointer transition-all duration-200 ${layer.color} ${activeLayer === layer.id ? "scale-[1.02] shadow-lg" : "hover:scale-[1.01] hover:shadow-md"}`}
                  onMouseEnter={() => setActiveLayer(layer.id)}
                  onMouseLeave={() => setActiveLayer(null)}
                  onClick={() => document.getElementById(layer.link)?.scrollIntoView({ behavior: "smooth" })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono opacity-60 mr-2">{layer.element}</span>
                      <span className="font-semibold text-sm">{layer.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-40" />
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
        </div>

        <Prose>
          <p className="mt-8">Reasoning flows in two directions: <strong className="text-foreground">top-down</strong> when formulating questions and perspectives, and <strong className="text-foreground">bottom-up</strong> when building from evidence toward conclusions. The process is cyclical — new evidence may require revisiting earlier steps.</p>
        </Prose>
      </Section>

      {/* ── SECTION 3: CONCEPTS ── */}
      <Section id="s-concepts" number="3" title="Concepts" subtitle="The key terms and definitions that establish shared understanding." alt>
        <Prose>
          <p>Before defining your purpose or asking any questions, it's important to identify the <strong className="text-foreground">key concepts</strong> that will underpin your analysis. Concepts are the foundational terms and definitions that everyone involved must agree on to reason effectively.</p>
          <p>Without clearly defined concepts, two people can use the same word to mean entirely different things — leading to confusion and flawed conclusions.</p>
        </Prose>
        <ExampleBox title="Example">
          <p className="text-muted-foreground mb-2"><strong className="text-foreground">Topic:</strong> "Should salary caps exist in professional sports?"</p>
          <p className="text-muted-foreground mb-1"><strong className="text-foreground">Key Definition:</strong> "Salary cap" — a league-imposed limit on the total amount a team can spend on player salaries.</p>
          <p className="text-muted-foreground"><strong className="text-foreground">Key Definition:</strong> "Competitive balance" — a state where teams have roughly equal chances of winning, often measured by win distribution across a league.</p>
        </ExampleBox>
        <Prose>
          <p>Clearly defining your concepts early prevents misunderstandings and ensures that your reasoning is built on a solid intellectual foundation. If two people define "competitive balance" differently, they may reach entirely different conclusions from the same evidence.</p>
        </Prose>
      </Section>

      {/* ── SECTION 5: PURPOSE ── */}
      <Section id="s-purpose" number="4" title="Purpose" subtitle="Every reasoning project begins with a clear purpose.">
        <Prose>
          <p>Before asking any questions, you must understand <em>why</em> you are reasoning in the first place. Purpose answers the question: <strong className="text-foreground">"Why are we analyzing this?"</strong></p>
          <p>A clear purpose keeps your reasoning focused and prevents you from drifting into unrelated areas. Without purpose, analysis becomes aimless.</p>
        </Prose>
        <ExampleBox title="Example Purposes">
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Understanding a complex social problem</li>
            <li>Making an informed decision about a career change</li>
            <li>Evaluating whether a public policy is effective</li>
            <li>Exploring the ethical implications of a new technology</li>
          </ul>
        </ExampleBox>
        <Prose>
          <p>Your purpose doesn't need to be complicated. It simply needs to be clear enough that anyone reading your analysis understands what you're trying to accomplish.</p>
        </Prose>
      </Section>

      {/* ── SECTION 6: OVERARCHING QUESTION ── */}
      <Section id="s-question" number="5" title="Overarching Question" subtitle="Reasoning begins with a clear, central question." alt>
        <Prose>
          <p>The overarching question is the single most important element of your analysis. It defines what you are trying to answer. Everything in the Houses of Thought — every sub-question, every piece of evidence, every conclusion — must connect back to this question.</p>
          <p>A good overarching question is specific enough to be answerable but broad enough to require structured analysis.</p>
        </Prose>
        <ExampleBox title="Examples">
          <ul className="space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">"Should salary caps exist in professional sports?"</strong> — Requires examining economics, fairness, competitive balance, and player rights.</li>
            <li><strong className="text-foreground">"Has artificial intelligence done more good than harm?"</strong> — Requires examining technology, ethics, economics, and society.</li>
          </ul>
        </ExampleBox>
        <Prose>
          <p>A vague or poorly defined question leads to vague reasoning. Spend time crafting your overarching question carefully — it is the compass for your entire analysis.</p>
        </Prose>
      </Section>

      {/* ── SECTION 7: POINTS OF VIEW ── */}
      <Section id="s-pov" number="6" title="Points of View (POVs)" subtitle="Good reasoning requires examining multiple perspectives.">
        <Prose>
          <p>One of the most common reasoning failures is seeing an issue from only one perspective. The Houses of Thought addresses this by requiring analysis from multiple points of view. The framework uses three categories of POVs:</p>
        </Prose>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8 max-w-2xl mx-auto">
          {[
            { icon: Users, title: "Personal / Foundational", desc: "Your own biological, social, familial, and individual perspectives. These are the lenses you naturally see the world through.", examples: "Risk-tolerant vs. risk-averse thinkers, optimists vs. pessimists" },
            { icon: GraduationCap, title: "Group POVs", desc: "Perspectives from communities, organizations, demographics, or societal groups.", examples: "Students, teachers, governments, businesses, patients, athletes" },
            { icon: Beaker, title: "Ideas / Disciplines", desc: "Academic disciplines, theoretical frameworks, or schools of thought.", examples: "Science, economics, ethics, technology, psychology, law" },
          ].map((pov) => (
            <div key={pov.title} className="border border-border rounded-lg p-4 bg-card">
              <pov.icon className="h-5 w-5 text-primary mb-2" />
              <h4 className="font-display font-semibold text-sm mb-1">{pov.title}</h4>
              <p className="text-xs text-muted-foreground mb-2">{pov.desc}</p>
              <p className="text-xs text-muted-foreground/70 italic">e.g. {pov.examples}</p>
            </div>
          ))}
        </div>

        <Prose>
          <p>Each point of view produces different questions, highlights different evidence, and may lead to different conclusions. By systematically examining multiple POVs, you build a more complete and balanced understanding of the issue.</p>
        </Prose>
      </Section>

      {/* ── SECTION 8: SUB-QUESTIONS ── */}
      <Section id="s-sub-questions" number="7" title="Sub-Questions" subtitle="Large questions must be broken into smaller, manageable pieces." alt>
        <Prose>
          <p>No complex question can be answered in a single step. Sub-questions break the overarching question into focused, answerable parts. Each sub-question is examined from a specific point of view, ensuring comprehensive coverage of the issue.</p>
          <p>In complex situations, there can be hundreds or even thousands of sub-questions. The more thorough your sub-questions, the stronger your final conclusion will be.</p>
        </Prose>
        <ExampleBox title="Example">
          <p className="font-semibold mb-2">Main Question: "Should salary caps exist in professional sports?"</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>How do salary caps affect competitive balance between teams?</li>
            <li>How do salary caps affect player income and career freedom?</li>
            <li>How do salary caps affect fan engagement and viewership?</li>
            <li>What are the economic effects on team owners and leagues?</li>
            <li>How do salary caps compare to free-market alternatives?</li>
          </ul>
        </ExampleBox>
        <Prose>
          <p>Each sub-question will go through its own process of gathering information, examining assumptions, and reaching a sub-conclusion before contributing to the final answer.</p>
        </Prose>
      </Section>

      {/* ── SECTION 9: INFORMATION / FACTS ── */}
      <Section id="s-information" number="8" title="Information / Facts (The Foundation)" subtitle="The foundation of all reasoning is verified, reliable information.">
        <Prose>
          <p>Information is the bedrock of the Houses of Thought. Without solid facts, everything built on top — assumptions, inferences, conclusions — is unstable. Information should be:</p>
        </Prose>
        <ul className="list-none space-y-2 max-w-2xl mx-auto my-6">
          {[
            "Observable — Can be seen, measured, or documented",
            "Measurable — Can be quantified or compared",
            "Supported by evidence — Backed by research, data, or credible sources",
            "Verifiable — Can be confirmed by others through independent sources or instruments",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Prose>
          <p>Critical thinkers constantly ask: <em>"Is this actually true? What evidence supports it? Are there facts I'm missing?"</em></p>
          <p>Strong reasoning requires strong evidence. If your facts are wrong, your conclusions will be wrong — no matter how logical your reasoning is.</p>
        </Prose>
      </Section>

      {/* ── SECTION 10: ASSUMPTIONS ── */}
      <Section id="s-assumptions" number="9" title="Assumptions" subtitle="The beliefs that connect facts to conclusions." alt>
        <Prose>
          <p>Assumptions are beliefs, premises, or frameworks that help us interpret information and draw conclusions. They are the bridge between "what we know" and "what we conclude." Every argument relies on assumptions — the question is whether those assumptions are justified.</p>
        </Prose>
        <ExampleBox title="Example">
          <p className="text-muted-foreground mb-2"><strong className="text-foreground">Fact:</strong> Salary caps limit how much teams can spend on players.</p>
          <p className="text-muted-foreground"><strong className="text-foreground">Assumption:</strong> Limiting spending creates competitive balance by preventing wealthy teams from buying all the best players.</p>
        </ExampleBox>
        <Prose>
          <p>This assumption may seem reasonable, but it should be examined: <em>Do salary caps actually create competitive balance? Or do wealthy teams find ways around them?</em></p>
          <p>The Houses of Thought framework categorizes assumptions into three types:</p>
        </Prose>
        <ul className="list-none space-y-2 max-w-2xl mx-auto my-4">
          {[
            { label: "Unknown Unknowns", desc: "Things you don't know that you don't know — blind spots in your reasoning" },
            { label: "Foundational Assumptions", desc: "Underlying beliefs or premises taken for granted that shape your reasoning" },
            { label: "Concepts that Shape Inferences", desc: "Specific pieces of evidence paired with the inference or logical leap drawn from them — these bridge observable facts to broader conclusions" },
          ].map((a) => (
            <li key={a.label} className="flex items-start gap-3 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-assumption mt-0.5 shrink-0" />
              <span><strong className="text-foreground">{a.label}:</strong> {a.desc}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── SECTION 11: UNKNOWN UNKNOWNS ── */}
      <Section number="10" title="Unknown Unknowns" subtitle="The factors you couldn't predict.">
        <Prose>
          <p>Sometimes, factors appear that could not have been anticipated. These are called "unknown unknowns" — things you didn't know that you didn't know. They can fundamentally change the landscape of an issue.</p>
        </Prose>
        <ExampleBox title="Examples of Unknown Unknowns">
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>A sudden technological breakthrough that changes an entire industry</li>
            <li>New government regulations that shift the rules of the game</li>
            <li>Unexpected scientific discoveries that overturn established knowledge</li>
            <li>Unforeseen events (pandemics, natural disasters, economic crises)</li>
          </ul>
        </ExampleBox>
        <Prose>
          <p>Critical thinkers must remain flexible and humble. No reasoning framework can predict everything. The Houses of Thought helps by making your reasoning transparent — so when unknown unknowns appear, you can quickly identify which parts of your analysis are affected and need revision.</p>
        </Prose>
      </Section>

      {/* ── SECTION 12: LOGICAL INFERENCE ── */}
      <Section number="11" title="Logical Inference" subtitle="The logical step between information and conclusions." alt>
        <Prose>
          <p>Inference is the reasoning engine of the Houses of Thought. It is the process of drawing conclusions from available information and assumptions. Think of it as the logical leap from "what I know" to "what I conclude."</p>
        </Prose>
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 max-w-2xl mx-auto my-8">
          {[
            { label: "Facts", desc: "Provide the foundation" },
            { label: "Assumptions", desc: "Shape interpretation" },
            { label: "Inference", desc: "Connects them logically" },
            { label: "Conclusion", desc: "The result" },
          ].map((item, i) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="border border-border rounded-lg p-3 bg-card text-center min-w-[120px]">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 rotate-90 md:rotate-0" />}
            </div>
          ))}
        </div>
        <Prose>
          <p>Every inference must be justified. A logical leap that cannot be explained or defended is a weakness in your reasoning. Critical thinkers ask: <em>"Does this conclusion actually follow from the evidence? Or am I making an unjustified jump?"</em></p>
        </Prose>
      </Section>

      {/* ── SECTION 13: SUB-CONCLUSIONS ── */}
      <Section id="s-sub-conclusions" number="12" title="Sub-Conclusions" subtitle="Intermediate conclusions that build toward the final answer.">
        <Prose>
          <p>Complex reasoning rarely produces a single conclusion in one step. Instead, each sub-question produces its own sub-conclusion — an intermediate answer based on the information, assumptions, and reasoning specific to that question.</p>
        </Prose>
        <ExampleBox title="Example Sub-Conclusion">
          <p className="text-muted-foreground"><strong className="text-foreground">Sub-Question:</strong> "How do salary caps affect competitive balance?"</p>
          <p className="text-muted-foreground mt-2"><strong className="text-foreground">Sub-Conclusion:</strong> "Salary caps reduce payroll inequality between teams, but wealthy teams often circumvent them through creative contract structures, limiting their effectiveness."</p>
        </ExampleBox>
        <Prose>
          <p>Sub-conclusions are the building blocks of your final conclusion. Each one should be clearly traceable back to specific evidence and reasoning. Together, they provide the support structure for the overarching conclusion.</p>
        </Prose>
      </Section>

      {/* ── SECTION 14: OVERARCHING CONCLUSION ── */}
      <Section id="s-conclusion" number="13" title="Overarching Conclusion" subtitle="The final answer to the original question." alt>
        <Prose>
          <p>The overarching conclusion is the roof of the Houses of Thought. It is the single, synthesized answer to your overarching question, built from all of your sub-conclusions.</p>
          <p>A strong overarching conclusion should be supported by:</p>
        </Prose>
        <ul className="list-none space-y-2 max-w-2xl mx-auto my-6">
          {[
            "Verified facts and reliable evidence",
            "Carefully examined assumptions",
            "Sound logical reasoning",
            "Multiple sub-conclusions from different perspectives",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Prose>
          <p><strong className="text-foreground">Strong conclusions require strong foundations.</strong> If you've built each layer of the house carefully — gathered solid evidence, examined your assumptions, reasoned logically, and considered multiple perspectives — your conclusion will be defensible and well-supported.</p>
        </Prose>
      </Section>

      {/* ── SECTION 15: IMPLICATIONS VS CONSEQUENCES ── */}
      <Section id="s-implications" number="14" title="Implications vs. Consequences" subtitle="Understanding the difference between predicted and actual outcomes.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
          <div className="border-2 border-atmosphere rounded-lg p-5 bg-atmosphere/5">
            <h4 className="font-display font-bold text-foreground mb-2">Implications</h4>
            <p className="text-sm text-muted-foreground mb-3">Predicted outcomes that <em>might</em> happen if the conclusion is correct. These are forward-looking projections.</p>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-mono text-muted-foreground mb-1">EXAMPLE</p>
              <p className="text-sm text-foreground">Throwing a ball near a window <strong>could</strong> break it.</p>
            </div>
          </div>
          <div className="border-2 border-assumption rounded-lg p-5 bg-assumption/5">
            <h4 className="font-display font-bold text-foreground mb-2">Consequences</h4>
            <p className="text-sm text-muted-foreground mb-3">Real-world results that <em>actually</em> happen. These are observed, documented outcomes.</p>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-mono text-muted-foreground mb-1">EXAMPLE</p>
              <p className="text-sm text-foreground">Throwing a ball <strong>broke</strong> the window.</p>
            </div>
          </div>
        </div>
        <Prose>
          <p>Analyzing implications helps people plan for possible outcomes before they happen. Recording consequences as they unfold allows you to compare predictions against reality and refine your reasoning.</p>
          <p>In the Houses of Thought platform, implications can be generated by AI based on your conclusion, while consequences are entered by you as real-world events unfold.</p>
        </Prose>
      </Section>

      {/* ── SECTION 16: ITERATIVE THINKING ── */}
      <Section number="15" title="Iterative Thinking" subtitle="Reasoning is a process, not a one-time event." alt>
        <Prose>
          <p>One of the most important principles in the Houses of Thought is that reasoning should be revisited and revised when new information appears. A conclusion reached today may need to be updated tomorrow.</p>
          <p>If the implications are negative, unexpected, or don't match reality, thinkers should:</p>
        </Prose>
        <ul className="list-none space-y-2 max-w-2xl mx-auto my-6">
          {[
            { icon: AlertTriangle, text: "Revisit and re-examine assumptions" },
            { icon: BookOpen, text: "Gather more information and evidence" },
            { icon: Brain, text: "Adjust conclusions based on new data" },
            { icon: HelpCircle, text: "Build more or stronger sub-questions" },
            { icon: Eye, text: "Consider additional points of view" },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-3 text-sm text-muted-foreground">
              <item.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-center my-8">
          <div className="flex items-center gap-3 border border-border rounded-full px-6 py-3 bg-card">
            <RefreshCw className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Reasoning is cyclical, not linear</span>
          </div>
        </div>
        <Prose>
          <p>The best thinkers are willing to change their minds when the evidence demands it. The Houses of Thought supports this by making it easy to revisit any layer of your reasoning at any time.</p>
        </Prose>
      </Section>

      {/* ── SECTION 17: HOW THE PLATFORM HELPS ── */}
      <Section id="s17" number="16" title="How the Houses of Thought Platform Helps" subtitle="The platform brings this framework to life with powerful tools." alt>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
          {[
            { icon: Lightbulb, title: "Draft Full House", desc: "AI generates a complete reasoning structure — purpose, sub-questions, assumptions, and information — in one step." },
            { icon: BarChart3, title: "Visual House Diagrams", desc: "See your reasoning as an interactive house structure. Click into any layer to explore or edit." },
            { icon: Brain, title: "AI Reasoning Assistant", desc: "Generate sub-questions, test assumptions, and explore perspectives with AI guidance." },
            { icon: BookOpen, title: "Research Mode", desc: "AI synthesizes reliable information to ground your reasoning in verified evidence." },
            { icon: Shield, title: "Logic Strength Evaluation", desc: "Evaluate how well-supported your reasoning is across evidence, assumptions, and logical consistency." },
            { icon: Scale, title: "Reasoning Stress Tests", desc: "Test your conclusions against counter-arguments and opposing perspectives." },
          ].map((feature) => (
            <div key={feature.title} className="border border-border rounded-lg p-4 bg-card flex gap-3">
              <feature.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="font-display font-semibold text-sm text-foreground mb-1">{feature.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Prose>
          <p>The goal of the Houses of Thought platform is simple: <strong className="text-foreground">help you think more clearly, reason more rigorously, and build stronger conclusions</strong>. Whether you're a student learning critical thinking, a teacher guiding reasoning projects, or a professional analyzing complex problems, the platform provides the structure and tools to do it well.</p>
        </Prose>

        <div className="text-center mt-10">
          <Button onClick={() => navigate("/dashboard")} size="lg" className="gap-2">
            Start Building Your Houses of Thought <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Section>

      {/* ── ATTRIBUTION ── */}
      <footer className="py-10 px-6 border-t border-border bg-muted/20">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            Based on John Trapasso's <em>House of Reason</em> model for critical thinking,
            derived from the <strong>Paul-Elder Framework</strong> for Critical Thinking.
          </p>
          <p className="text-xs text-muted-foreground mt-2 opacity-60">
            Critical Thinking Humanities by John Trapasso © 2021
          </p>
        </div>
      </footer>
      <SiteFooter />
    </div>
  );
}
