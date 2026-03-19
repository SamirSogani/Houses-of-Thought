import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import BulletListInput from "@/components/ui/BulletListInput";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface StoredData {
  consequences?: string[];
  implications?: string[];
  ai_implications?: string;
}

function parseStored(raw: string): StoredData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Handle legacy format
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        consequences: Array.isArray(parsed.consequences) ? parsed.consequences : (parsed.consequences ? [parsed.consequences] : []),
        implications: Array.isArray(parsed.implications_list) ? parsed.implications_list : [],
        ai_implications: typeof parsed.implications === "string" ? parsed.implications : (parsed.ai_implications || ""),
      };
    }
    return {};
  } catch {
    return {};
  }
}

function serializeStored(data: StoredData): string {
  return JSON.stringify({
    consequences: data.consequences || [],
    implications_list: data.implications || [],
    ai_implications: data.ai_implications || "",
    // Keep legacy keys for backward compat
    implications: data.ai_implications || "",
  });
}

export default function ImplicationsPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view") === "builder" ? "?view=builder" : "";
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [userImplications, setUserImplications] = useState<string[]>([]);
  const [aiImplications, setAiImplications] = useState("");

  useEffect(() => { loadData(); }, [analysisId]);

  const loadData = async () => {
    const [aRes, sqRes] = await Promise.all([
      supabase.from("analyses").select("*").eq("id", analysisId!).maybeSingle(),
      supabase.from("sub_questions").select("*").eq("analysis_id", analysisId!).order("sort_order"),
    ]);
    setAnalysis(aRes.data);
    setSubQuestions(sqRes.data || []);
    if (aRes.data) {
      const stored = parseStored(aRes.data.consequences);
      setUserImplications(stored.implications || []);
      setAiImplications(stored.ai_implications || "");
    }
  };

  const persist = async (newUserImpl?: string[], newAiImpl?: string) => {
    const current = parseStored(analysis?.consequences || "");
    const updated: StoredData = {
      consequences: current.consequences || [],
      implications: newUserImpl !== undefined ? newUserImpl : userImplications,
      ai_implications: newAiImpl !== undefined ? newAiImpl : aiImplications,
    };
    const serialized = serializeStored(updated);
    setAnalysis(prev => prev ? { ...prev, consequences: serialized } : prev);
    await supabase.from("analyses").update({ consequences: serialized, updated_at: new Date().toISOString() }).eq("id", analysisId!);
  };

  const handleUserImplicationsChange = (items: string[]) => {
    setUserImplications(items);
    persist(items, undefined);
  };

  const generateImplications = async () => {
    if (!analysis || generating) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const stored = parseStored(analysis.consequences);
      const consequences = stored.consequences || [];

      const subConclusionsSummary = subQuestions
        .filter(sq => sq.sub_conclusion)
        .map((sq, i) => `${i + 1}. [${sq.pov_category}] "${sq.question}" → ${sq.sub_conclusion}`)
        .join("\n");

      const systemPrompt = `You are the House of Thought AI. Generate predicted implications.

Given the user's overarching conclusion, predict what SHOULD logically follow if the conclusion is correct. These are PREDICTED outcomes — forward-looking projections.

${consequences.length > 0 ? `The user has entered ACTUAL consequences that have unfolded. Use these to refine predictions:\n${consequences.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n` : ""}
${userImplications.length > 0 ? `The user has also entered their own implications:\n${userImplications.map((im, i) => `${i + 1}. ${im}`).join("\n")}\n` : ""}

Rules:
- Focus on predictive, forward-looking implications
- Cover short-term, medium-term, and long-term predictions
- Consider implications across individual, group, and systemic levels
- Be specific and substantive
- Format as clear numbered points grouped by timeframe or category

## Analysis: "${analysis.title}"
- Overarching Question: ${analysis.overarching_question || "Not set"}
- Overarching Conclusion: ${analysis.overarching_conclusion || "Not set"}
- Purpose: ${analysis.purpose || "Not set"}

## Sub-Conclusions:
${subConclusionsSummary || "None yet"}`;

      const res = await supabase.functions.invoke("groq-chat", {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate comprehensive predicted implications for the conclusion: "${analysis.overarching_conclusion || analysis.overarching_question}"` },
          ],
          mode: "chat",
        },
      });
      if (res.error) throw new Error(res.error.message);
      const reply = res.data?.choices?.[0]?.message?.content || "";
      if (reply) {
        setAiImplications(reply);
        await persist(undefined, reply);
        toast.success("AI implications generated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate implications");
    } finally {
      setGenerating(false);
    }
  };

  if (!analysis) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container max-w-6xl">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate(`/analysis/${analysisId}${viewParam}`)} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {analysis.title}
          </button>
          <span>/</span>
          <span className="text-foreground">Implications</span>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Implications (Predicted Outcomes)</h1>
        <p className="text-muted-foreground mb-8">
          Element 8a — What should logically follow if your conclusion is correct? Add your own or generate with AI.
        </p>

        {/* User Implications */}
        <Card className="house-zone house-zone-roof mb-6">
          <CardHeader>
            <CardTitle className="text-xl font-display">Your Implications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Add your own predicted implications — what do you think will follow from your conclusion?
            </p>
            <BulletListInput
              items={userImplications}
              onChange={handleUserImplicationsChange}
              placeholder="Add a predicted implication..."
            />
          </CardContent>
        </Card>

        {/* AI Implications */}
        <Card className="house-zone house-zone-roof">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-display">AI-Generated Implications</CardTitle>
              <Button onClick={generateImplications} disabled={generating || !analysis.overarching_conclusion} variant="outline" className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generating..." : "Generate Implications"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!analysis.overarching_conclusion && (
              <p className="text-destructive text-xs mb-3">Set an overarching conclusion first to enable AI generation.</p>
            )}
            {aiImplications ? (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap border rounded-md p-4 bg-card">
                {aiImplications}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-md bg-card">
                <p>No AI implications generated yet. Click "Generate Implications" to predict outcomes.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={() => navigate(`/analysis/${analysisId}/consequences`)}>
            View Consequences →
          </Button>
          <Button onClick={() => navigate(`/analysis/${analysisId}${viewParam}`)}>
            Back to House
          </Button>
        </div>
      </div>
    </div>
  );
}
