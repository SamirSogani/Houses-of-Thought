import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import EvidenceFactInput, { type FactEntry } from "@/components/house/EvidenceFactInput";

type SubQuestion = Tables<"sub_questions">;

// Parse information field: supports both legacy string[] and new FactEntry[] format
function parseInfoItems(raw: string): FactEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return raw ? [{ text: raw, evidenceStrength: "moderate" as const, sources: [] }] : [];
    // Check if it's the new format (objects with text field) or legacy (plain strings)
    if (parsed.length === 0) return [];
    if (typeof parsed[0] === "string") {
      // Legacy format: convert strings to FactEntry
      return parsed.map((s: string) => ({ text: s, evidenceStrength: "moderate" as const, sources: [] }));
    }
    // New format
    return parsed.map((item: any) => ({
      text: item.text || "",
      evidenceStrength: item.evidenceStrength || "moderate",
      sources: item.sources || [],
    }));
  } catch {
    return raw ? [{ text: raw, evidenceStrength: "moderate" as const, sources: [] }] : [];
  }
}

export default function SubQuestionAnalysisPage() {
  const { analysisId, subQuestionId } = useParams<{ analysisId: string; subQuestionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view") === "builder" ? "?view=builder" : "";
  const [sq, setSq] = useState<SubQuestion | null>(null);
  const [analysisTitle, setAnalysisTitle] = useState("");
  const [infoItems, setInfoItems] = useState<FactEntry[]>([]);

  useEffect(() => { loadData(); }, [subQuestionId]);

  const loadData = async () => {
    const [sqRes, aRes] = await Promise.all([
      supabase.from("sub_questions").select("*").eq("id", subQuestionId!).maybeSingle(),
      supabase.from("analyses").select("title").eq("id", analysisId!).maybeSingle(),
    ]);
    setSq(sqRes.data);
    setAnalysisTitle(aRes.data?.title || "");
    if (sqRes.data?.information) {
      setInfoItems(parseInfoItems(sqRes.data.information));
    }
  };

  const updateField = async (field: "information" | "sub_conclusion", value: string) => {
    setSq(prev => (prev ? { ...prev, [field]: value } : prev));
    await supabase.from("sub_questions").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", subQuestionId!);
  };

  const handleInfoChange = useCallback((items: FactEntry[]) => {
    setInfoItems(items);
    const serialized = JSON.stringify(items);
    setSq(prev => prev ? { ...prev, information: serialized } : prev);
    supabase.from("sub_questions").update({ information: serialized, updated_at: new Date().toISOString() }).eq("id", subQuestionId!);
  }, [subQuestionId]);

  if (!sq) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate(`/analysis/${analysisId}${viewParam}`)} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {analysisTitle || "Analysis"}
          </button>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{sq.question || "Sub-Question"}</span>
        </div>

        <h1 className="text-2xl font-display font-bold mb-2">{sq.question || "Untitled Sub-Question"}</h1>
        <p className="text-muted-foreground mb-8">Detailed analysis for this sub-question (Elements 5–7.1)</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Assumptions */}
          <Card
            className="house-zone house-zone-assumption cursor-pointer"
            onClick={() => navigate(`/analysis/${analysisId}/sub-question/${subQuestionId}/assumptions`)}
          >
            <CardHeader>
              <CardTitle className="text-lg font-display">Assumptions</CardTitle>
              <p className="text-sm text-muted-foreground">Elements 5.1, 5.2, 5.3</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Click to examine Unknown Unknowns, Foundational Concepts, and Concepts that Shape Inferences</p>
            </CardContent>
          </Card>

          {/* Information - Evidence Fact Input */}
          <Card className="house-zone">
            <CardHeader>
              <CardTitle className="text-lg font-display">Information / Facts</CardTitle>
              <p className="text-sm text-muted-foreground">Element 6 — with Evidence Strength & Sources</p>
            </CardHeader>
            <CardContent>
              <EvidenceFactInput
                items={infoItems}
                onChange={handleInfoChange}
                placeholder="Add a fact or piece of evidence..."
                analysisContext={`Analysis: ${analysisTitle}\nSub-question: ${sq.question}`}
              />
            </CardContent>
          </Card>

          {/* Sub-Conclusion */}
          <Card className="house-zone">
            <CardHeader>
              <CardTitle className="text-lg font-display">Sub-Conclusion</CardTitle>
              <p className="text-sm text-muted-foreground">Element 7.1</p>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="What conclusion do you draw for this sub-question?"
                value={sq.sub_conclusion}
                onChange={(e) => updateField("sub_conclusion", e.target.value)}
                className="min-h-[150px] bg-card"
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate(`/analysis/${analysisId}/pov-grouping`)}>
            ← POV Grouping
          </Button>
          <Button onClick={() => navigate(`/analysis/${analysisId}${viewParam}`)}>
            Back to House →
          </Button>
        </div>
      </div>
    </div>
  );
}
