import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import BulletListInput from "@/components/ui/BulletListInput";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;

interface StoredData {
  consequences?: string[];
  implications_list?: string[];
  ai_implications?: string;
  implications?: string;
}

function parseStored(raw: string): StoredData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        consequences: Array.isArray(parsed.consequences) ? parsed.consequences : (parsed.consequences ? [parsed.consequences] : []),
        implications_list: parsed.implications_list || [],
        ai_implications: parsed.ai_implications || "",
        implications: parsed.implications || "",
      };
    }
    return {};
  } catch {
    // Legacy plain text
    return { consequences: raw ? [raw] : [] };
  }
}

export default function ConsequencesPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [consequences, setConsequences] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [analysisId]);

  const loadData = async () => {
    const { data } = await supabase.from("analyses").select("*").eq("id", analysisId!).maybeSingle();
    setAnalysis(data);
    if (data) {
      const stored = parseStored(data.consequences);
      setConsequences(stored.consequences || []);
    }
  };

  const handleChange = async (items: string[]) => {
    setConsequences(items);
    // Preserve existing implications data
    const current = parseStored(analysis?.consequences || "");
    const serialized = JSON.stringify({
      consequences: items,
      implications_list: current.implications_list || [],
      ai_implications: current.ai_implications || "",
      implications: current.implications || "",
    });
    setAnalysis(prev => prev ? { ...prev, consequences: serialized } : prev);
    await supabase.from("analyses").update({ consequences: serialized, updated_at: new Date().toISOString() }).eq("id", analysisId!);
  };

  if (!analysis) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container max-w-6xl">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate(`/analysis/${analysisId}`)} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {analysis.title}
          </button>
          <span>/</span>
          <span className="text-foreground">Consequences</span>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Consequences (Actual Outcomes)</h1>
        <p className="text-muted-foreground mb-8">
          Element 8b — Record real-world consequences as they unfold. These are actual outcomes, not predictions.
        </p>

        <Card className="house-zone house-zone-roof">
          <CardHeader>
            <CardTitle className="text-xl font-display">Observed Consequences</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Add actual outcomes that have occurred as a result of this conclusion. Updating these will help refine AI-predicted implications.
            </p>
            <BulletListInput
              items={consequences}
              onChange={handleChange}
              placeholder="Add an observed consequence..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={() => navigate(`/analysis/${analysisId}/implications`)}>
            View Implications →
          </Button>
          <Button onClick={() => navigate(`/analysis/${analysisId}`)}>
            Back to House
          </Button>
        </div>
      </div>
    </div>
  );
}
