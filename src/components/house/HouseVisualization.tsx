import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import InlinePill from "@/components/comments/InlinePill";
import type { CommentContextValue } from "@/hooks/useCommentContext";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface Props {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  onUpdateField: (field: keyof Analysis, value: string) => void;
  onNavigate: (path: string) => void;
  onAcceptDraft?: () => void;
  onDeclineDraft?: () => void;
  /** Comment context — when present and active, renders inline pills on each zone. */
  commentCtx?: CommentContextValue;
  /** When true, all editable fields render as read-only text. */
  readonly?: boolean;
  /** Suffix appended to navigation paths (e.g. "?readonly=1"). */
  navSuffix?: string;
}

export default function HouseVisualization({
  analysis,
  subQuestions,
  onUpdateField,
  onNavigate,
  onAcceptDraft,
  onDeclineDraft,
  commentCtx,
  readonly = false,
  navSuffix = "",
}: Props) {
  const analysisId = analysis.id;
  const isDraft = (analysis as any).is_draft;
  const showPills = !!commentCtx?.hasContext;

  const povGroups = subQuestions.reduce<Record<string, SubQuestion[]>>((acc, sq) => {
    const key = sq.pov_category || "individual";
    if (!acc[key]) acc[key] = [];
    acc[key].push(sq);
    return acc;
  }, {});

  const draftClass = isDraft ? "ring-2 ring-assumption bg-assumption-bg" : "";

  return (
    <div className="space-y-4 animate-fade-in">
      {isDraft && onAcceptDraft && onDeclineDraft && !readonly && (
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

      {/* THE ATMOSPHERE — Concepts */}
      <Card
        className={`house-zone house-zone-atmosphere cursor-pointer ${draftClass}`}
        data-comment-kind="zone_atmosphere"
        onClick={() => onNavigate(`/analysis/${analysisId}/concepts${navSuffix}`)}
      >
        <CardContent className="py-4 text-center relative">
          {showPills && commentCtx && (
            <div className="absolute top-2 right-2">
              <InlinePill ctx={commentCtx} targetKind="zone_atmosphere" targetId={null} targetLabel="Concepts zone" />
            </div>
          )}
          <p className="text-xs font-mono text-muted-foreground mb-1">ELEMENT 1 — THE ATMOSPHERE</p>
          <h3 className="text-lg font-display font-bold">Concepts, Theories & Definitions</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {readonly ? "Click to view concepts →" : "Click to define your core ideas →"}
          </p>
        </CardContent>
      </Card>

      {/* THE ROOF */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card
          className={`house-zone house-zone-roof cursor-pointer ${draftClass}`}
          data-comment-kind="consequences"
          onClick={() => onNavigate(`/analysis/${analysisId}/consequences${navSuffix}`)}
        >
          <CardContent className="py-4 text-center relative">
            {showPills && commentCtx && (
              <div className="absolute top-1 right-1">
                <InlinePill ctx={commentCtx} targetKind="consequences" targetId={null} targetLabel="Consequences (8b)" />
              </div>
            )}
            <p className="text-xs font-mono text-muted-foreground mb-1">8b</p>
            <h4 className="text-sm font-display font-semibold">Consequences</h4>
          </CardContent>
        </Card>

        <Card
          className={`house-zone house-zone-roof relative ${draftClass}`}
          data-comment-kind="purpose"
        >
          <CardContent className="py-3">
            {showPills && commentCtx && (
              <div className="absolute top-1 right-1 flex flex-col gap-1 items-end">
                <InlinePill ctx={commentCtx} targetKind="purpose" targetId={null} targetLabel="Overarching Purpose" />
                <InlinePill ctx={commentCtx} targetKind="sub_purposes" targetId={null} targetLabel="Sub-purposes" />
              </div>
            )}
            <p className="text-xs font-mono text-muted-foreground mb-1 text-center">ELEMENT 2 — PURPOSE</p>
            {readonly ? (
              <div className="min-h-[60px] text-sm bg-card mb-2 p-2 rounded border whitespace-pre-wrap">
                {analysis.purpose || <span className="text-muted-foreground italic">No purpose set</span>}
              </div>
            ) : (
              <Textarea
                placeholder="Overarching Purpose..."
                value={analysis.purpose}
                onChange={(e) => onUpdateField("purpose", e.target.value)}
                className="min-h-[60px] text-sm bg-card mb-2"
              />
            )}
            <p className="text-xs font-mono text-muted-foreground mb-1 text-center">2.1 — SUB-PURPOSES</p>
            {readonly ? (
              <div className="min-h-[40px] text-sm bg-card p-2 rounded border whitespace-pre-wrap">
                {analysis.sub_purposes || <span className="text-muted-foreground italic">No sub-purposes set</span>}
              </div>
            ) : (
              <Textarea
                placeholder="Sub-purposes..."
                value={analysis.sub_purposes}
                onChange={(e) => onUpdateField("sub_purposes", e.target.value)}
                className="min-h-[40px] text-sm bg-card"
              />
            )}
          </CardContent>
        </Card>

        <Card
          className={`house-zone house-zone-roof cursor-pointer ${draftClass}`}
          data-comment-kind="implications"
          onClick={() => onNavigate(`/analysis/${analysisId}/implications${navSuffix}`)}
        >
          <CardContent className="py-4 text-center relative">
            {showPills && commentCtx && (
              <div className="absolute top-1 right-1">
                <InlinePill ctx={commentCtx} targetKind="implications" targetId={null} targetLabel="Implications (8a)" />
              </div>
            )}
            <p className="text-xs font-mono text-muted-foreground mb-1">8a</p>
            <h4 className="text-sm font-display font-semibold">Implications</h4>
          </CardContent>
        </Card>
      </div>

      {/* THE CEILING */}
      <Card className={`house-zone house-zone-ceiling ${draftClass}`}>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div data-comment-kind="overarching_question" className="relative">
              {showPills && commentCtx && (
                <div className="absolute top-0 right-0">
                  <InlinePill ctx={commentCtx} targetKind="overarching_question" targetId={null} targetLabel="Overarching Question" />
                </div>
              )}
              <p className="text-xs font-mono mb-1 text-muted-foreground">3.1 — OVERARCHING QUESTION</p>
              {readonly ? (
                <div className="min-h-[60px] text-sm bg-card p-3 rounded border whitespace-pre-wrap text-foreground">
                  {analysis.overarching_question || <span className="text-muted-foreground italic">No question set</span>}
                </div>
              ) : (
                <Textarea
                  placeholder="What is your overarching question?"
                  value={analysis.overarching_question}
                  onChange={(e) => onUpdateField("overarching_question", e.target.value)}
                  className="min-h-[60px] text-sm bg-card text-foreground"
                />
              )}
            </div>
            <div
              data-comment-kind="overarching_conclusion"
              className="cursor-pointer relative"
              onClick={() => onNavigate(`/analysis/${analysisId}/synthesis${navSuffix}`)}
            >
              {showPills && commentCtx && (
                <div className="absolute top-0 right-0" onClick={(e) => e.stopPropagation()}>
                  <InlinePill ctx={commentCtx} targetKind="overarching_conclusion" targetId={null} targetLabel="Overarching Conclusion" />
                </div>
              )}
              <p className="text-xs font-mono mb-1 text-muted-foreground">7.2 — OVERARCHING CONCLUSION</p>
              <div className="min-h-[60px] p-3 rounded-md bg-card text-foreground text-sm border hover:shadow-md transition-shadow whitespace-pre-wrap">
                {analysis.overarching_conclusion || <span className="text-muted-foreground italic">Click to {readonly ? "view" : "synthesize"} →</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* THE COLUMNS */}
      <Card
        className={`house-zone cursor-pointer ${draftClass}`}
        data-comment-kind="zone_columns"
        onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions${navSuffix}`)}
      >
        <CardContent className="py-4 relative">
          {showPills && commentCtx && (
            <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
              <InlinePill ctx={commentCtx} targetKind="zone_columns" targetId={null} targetLabel="Sub-questions zone" />
            </div>
          )}
          <p className="text-xs font-mono text-muted-foreground mb-2 text-center">ELEMENT 3.2 — SUB-QUESTIONS (THE COLUMNS)</p>
          {subQuestions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">{readonly ? "No sub-questions yet." : "Click to add sub-questions →"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["individual", "group", "ideas_disciplines"].map((pov) => (
                <div key={pov} className="space-y-2">
                  <p className="text-xs font-semibold text-center capitalize">
                    {pov === "ideas_disciplines" ? "Ideas & Disciplines" : pov}
                  </p>
                  {(povGroups[pov] || []).map((sq) => (
                    <div
                      key={sq.id}
                      data-comment-kind="sub_question"
                      data-comment-target-id={sq.id}
                      className={`p-2 text-xs rounded border cursor-pointer hover:shadow-md transition-shadow relative ${
                        pov === "individual" ? "pov-individual" :
                        pov === "group" ? "pov-group" : "pov-ideas"
                      } ${(sq as any).is_draft ? "ring-1 ring-assumption" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(`/analysis/${analysisId}/sub-question/${sq.id}${navSuffix}`);
                      }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="flex-1">{sq.question || "Untitled"}</span>
                        {showPills && commentCtx && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <InlinePill
                              ctx={commentCtx}
                              targetKind="sub_question"
                              targetId={sq.id}
                              targetLabel={sq.question || "Untitled sub-question"}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* THE FOUNDATION */}
      <Card className="house-zone house-zone-foundation">
        <CardContent className="py-4">
          <p className="text-xs font-mono text-muted-foreground mb-2 text-center">ELEMENT 4.2 — PERSONAL FOUNDATIONAL POINT OF VIEW</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
