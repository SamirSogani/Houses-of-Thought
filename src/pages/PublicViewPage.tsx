import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Home } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

export default function PublicViewPage() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadPublicAnalysis();
  }, [id]);

  const loadPublicAnalysis = async () => {
    const aRes = await supabase.from("analyses").select("*").eq("id", id!).maybeSingle();
    if (!aRes.data || !(aRes.data as any).is_public) { setNotFound(true); setLoading(false); return; }
    const sqRes = await supabase.from("sub_questions").select("*").eq("analysis_id", id!).order("sort_order");
    setAnalysis(aRes.data);
    setSubQuestions((sqRes.data || []).filter((sq) => !(sq as any).is_draft));
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;

  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Not Found</h1>
        <p className="text-muted-foreground">This analysis is private or doesn't exist.</p>
      </div>
    </div>
  );

  if (!analysis) return null;

  const povGroups = subQuestions.reduce<Record<string, SubQuestion[]>>((acc, sq) => {
    const key = sq.pov_category || "individual";
    if (!acc[key]) acc[key] = [];
    acc[key].push(sq);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Home className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-display font-bold text-foreground">House of Reason</h1>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-auto">Public View</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">{analysis.title}</h1>

        {/* Purpose */}
        {analysis.purpose && (
          <Card className="house-zone house-zone-roof">
            <CardContent className="py-4">
              <p className="text-xs font-mono text-muted-foreground mb-1">PURPOSE</p>
              <p className="text-sm text-foreground">{analysis.purpose}</p>
              {analysis.sub_purposes && (
                <>
                  <p className="text-xs font-mono text-muted-foreground mt-3 mb-1">SUB-PURPOSES</p>
                  <p className="text-sm text-foreground">{analysis.sub_purposes}</p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Question & Conclusion */}
        <Card className="house-zone house-zone-ceiling">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-mono mb-1 text-muted-foreground">OVERARCHING QUESTION</p>
                <p className="text-sm text-foreground">{analysis.overarching_question || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-mono mb-1 text-muted-foreground">OVERARCHING CONCLUSION</p>
                <p className="text-sm text-foreground">{analysis.overarching_conclusion || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Questions */}
        {subQuestions.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-mono text-muted-foreground mb-3 text-center">SUB-QUESTIONS</p>
              <div className="grid grid-cols-3 gap-3">
                {["individual", "group", "ideas_disciplines"].map((pov) => (
                  <div key={pov} className="space-y-2">
                    <p className="text-xs font-semibold text-center capitalize">
                      {pov === "ideas_disciplines" ? "Ideas & Disciplines" : pov}
                    </p>
                    {(povGroups[pov] || []).map((sq) => (
                      <div key={sq.id} className={`p-2 text-xs rounded border ${
                        pov === "individual" ? "pov-individual" : pov === "group" ? "pov-group" : "pov-ideas"
                      }`}>
                        <p className="font-medium">{sq.question}</p>
                        {sq.information && <p className="text-muted-foreground mt-1">{sq.information}</p>}
                        {sq.sub_conclusion && <p className="mt-1 italic">{sq.sub_conclusion}</p>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Consequences */}
        {analysis.consequences && (
          <Card className="house-zone house-zone-roof">
            <CardContent className="py-4">
              <p className="text-xs font-mono text-muted-foreground mb-1">CONSEQUENCES</p>
              <p className="text-sm text-foreground">{analysis.consequences}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
