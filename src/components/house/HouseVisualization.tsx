import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface Props {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  onUpdateField: (field: keyof Analysis, value: string) => void;
  onNavigate: (path: string) => void;
  onAcceptDraft?: () => void;
  onDeclineDraft?: () => void;
}

function DraftOverlay({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="absolute top-2 right-2 flex gap-1 z-10">
    <Button size="icon" variant="ghost" className="h-7 w-7 bg-accent hover:bg-accent/80 text-foreground" onClick={(e) => { e.stopPropagation(); onAccept(); }}>
        <Check className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 bg-destructive/20 hover:bg-destructive/40 text-destructive" onClick={(e) => { e.stopPropagation(); onDecline(); }}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function HouseVisualization({ analysis, subQuestions, onUpdateField, onNavigate, onAcceptDraft, onDeclineDraft }: Props) {
  const analysisId = analysis.id;
  const isDraft = (analysis as any).is_draft;

  const povGroups = subQuestions.reduce<Record<string, SubQuestion[]>>((acc, sq) => {
    const key = sq.pov_category || "individual";
    if (!acc[key]) acc[key] = [];
    acc[key].push(sq);
    return acc;
  }, {});

  const draftClass = isDraft ? "ring-2 ring-assumption bg-assumption-bg" : "";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Accept All / Decline All for drafts */}
      {isDraft && onAcceptDraft && onDeclineDraft && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-assumption-bg border border-assumption">
          <span className="text-sm font-medium text-foreground flex-1">✨ AI Draft — Review and accept or decline</span>
          <Button size="sm" variant="outline" onClick={onAcceptDraft}>
            <Check className="h-4 w-4 mr-1" /> Accept All
          </Button>
          <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={onDeclineDraft}>
            <X className="h-4 w-4 mr-1" /> Decline All
          </Button>
        </div>
      )}

      {/* THE ATMOSPHERE — Concepts (Element 1) */}
      <Card
        className={`house-zone house-zone-atmosphere cursor-pointer ${draftClass}`}
        onClick={() => onNavigate(`/analysis/${analysisId}/concepts`)}
      >
        <CardContent className="py-4 text-center">
          <p className="text-xs font-mono text-muted-foreground mb-1">ELEMENT 1 — THE ATMOSPHERE</p>
          <h3 className="text-lg font-display font-bold">Concepts, Theories & Definitions</h3>
          <p className="text-sm text-muted-foreground mt-1">Click to define your core ideas →</p>
        </CardContent>
      </Card>

      {/* THE ROOF — Purpose, Sub-purposes, Consequences (Elements 2, 2.1, 8) */}
      <div className="grid grid-cols-3 gap-3">
        <Card
          className={`house-zone house-zone-roof cursor-pointer ${draftClass}`}
          onClick={() => onNavigate(`/analysis/${analysisId}/consequences`)}
        >
          <CardContent className="py-4 text-center">
            <p className="text-xs font-mono text-muted-foreground mb-1">8</p>
            <h4 className="text-sm font-display font-semibold">Consequences</h4>
          </CardContent>
        </Card>

        <Card className={`house-zone house-zone-roof relative ${draftClass}`}>
          <CardContent className="py-3">
            <p className="text-xs font-mono text-muted-foreground mb-1 text-center">ELEMENT 2 — PURPOSE</p>
            <Textarea
              placeholder="Overarching Purpose..."
              value={analysis.purpose}
              onChange={(e) => onUpdateField("purpose", e.target.value)}
              className="min-h-[60px] text-sm bg-card mb-2"
            />
            <p className="text-xs font-mono text-muted-foreground mb-1 text-center">2.1 — SUB-PURPOSES</p>
            <Textarea
              placeholder="Sub-purposes..."
              value={analysis.sub_purposes}
              onChange={(e) => onUpdateField("sub_purposes", e.target.value)}
              className="min-h-[40px] text-sm bg-card"
            />
          </CardContent>
        </Card>

        <Card
          className={`house-zone house-zone-roof cursor-pointer ${draftClass}`}
          onClick={() => onNavigate(`/analysis/${analysisId}/consequences`)}
        >
          <CardContent className="py-4 text-center">
            <p className="text-xs font-mono text-muted-foreground mb-1">8</p>
            <h4 className="text-sm font-display font-semibold">Implications</h4>
          </CardContent>
        </Card>
      </div>

      {/* THE CEILING — Overarching Question & Conclusion (Elements 3.1, 7.2) */}
      <Card className={`house-zone house-zone-ceiling ${draftClass}`}>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-mono mb-1 text-muted-foreground">3.1 — OVERARCHING QUESTION</p>
              <Textarea
                placeholder="What is your overarching question?"
                value={analysis.overarching_question}
                onChange={(e) => onUpdateField("overarching_question", e.target.value)}
                className="min-h-[60px] text-sm bg-card text-foreground"
              />
            </div>
            <div
              className="cursor-pointer"
              onClick={() => onNavigate(`/analysis/${analysisId}/synthesis`)}
            >
              <p className="text-xs font-mono mb-1 text-muted-foreground">7.2 — OVERARCHING CONCLUSION</p>
              <div className="min-h-[60px] p-3 rounded-md bg-card text-foreground text-sm border hover:shadow-md transition-shadow">
                {analysis.overarching_conclusion || <span className="text-muted-foreground italic">Click to synthesize →</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* THE COLUMNS — Sub-Questions (Element 3.2) */}
      <Card
        className={`house-zone cursor-pointer ${draftClass}`}
        onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions`)}
      >
        <CardContent className="py-4">
          <p className="text-xs font-mono text-muted-foreground mb-2 text-center">ELEMENT 3.2 — SUB-QUESTIONS (THE COLUMNS)</p>
          {subQuestions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">Click to add sub-questions →</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {["individual", "group", "ideas_disciplines"].map((pov) => (
                <div key={pov} className="space-y-2">
                  <p className="text-xs font-semibold text-center capitalize">
                    {pov === "ideas_disciplines" ? "Ideas & Disciplines" : pov}
                  </p>
                  {(povGroups[pov] || []).map((sq) => (
                    <div
                      key={sq.id}
                      className={`p-2 text-xs rounded border cursor-pointer hover:shadow-md transition-shadow ${
                        pov === "individual" ? "pov-individual" :
                        pov === "group" ? "pov-group" : "pov-ideas"
                      } ${(sq as any).is_draft ? "ring-1 ring-assumption" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(`/analysis/${analysisId}/sub-question/${sq.id}`);
                      }}
                    >
                      {sq.question || "Untitled"}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* THE FIRST FLOOR — Assumptions (Elements 5.1, 5.2, 5.3) */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Unknown Unknowns", element: "5.1" },
          { label: "Foundational Concepts", element: "5.2" },
          { label: "Concepts that Shape Inferences", element: "5.3" },
        ].map((item) => (
          <Card key={item.element} className="house-zone house-zone-assumption">
            <CardContent className="py-4 text-center">
              <p className="text-xs font-mono text-muted-foreground mb-1">{item.element}</p>
              <h4 className="text-sm font-display font-semibold">{item.label}</h4>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* THE FOUNDATION — Personal POV (Element 4.2) */}
      <Card className="house-zone house-zone-foundation">
        <CardContent className="py-4">
          <p className="text-xs font-mono text-muted-foreground mb-2 text-center">ELEMENT 4.2 — PERSONAL FOUNDATIONAL POINT OF VIEW</p>
          <div className="grid grid-cols-4 gap-2">
            {["Biological", "Social", "Familial", "Individual"].map((label) => (
              <div key={label} className="text-center p-2 bg-card rounded border text-xs">
                <p className="font-semibold">{label}</p>
                <p className="text-muted-foreground mt-1">Set in Profile</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
