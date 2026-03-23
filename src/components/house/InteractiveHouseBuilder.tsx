import { useState, useMemo, useCallback } from "react";
import { AlertTriangle, ArrowDown, GripVertical, Pencil } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface Props {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  profile: Tables<"profiles"> | null;
  onNavigate: (path: string) => void;
}

/* ─── Helpers ─── */

interface Block {
  id: string;
  label: string;
  layer: string;
  onClick?: () => void;
  color: string;
}

function parseJsonArray(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "object") {
      if (Array.isArray(parsed.consequences)) return parsed.consequences;
    }
    return raw ? [raw] : [];
  } catch {
    return raw ? [raw] : [];
  }
}

function parseImplications(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object") {
      const list = parsed.implications_list || [];
      const ai = parsed.ai_implications || parsed.implications || "";
      const items = [...list];
      if (ai) items.push("(AI) " + ai.substring(0, 80) + "...");
      return items;
    }
    return [];
  } catch {
    return [];
  }
}

/* ─── Layer Component ─── */

function HouseLayer({
  label,
  element,
  blocks,
  colorClass,
  onClick,
  isWeak,
  weakLabel,
}: {
  label: string;
  element: string;
  blocks: Block[];
  colorClass: string;
  onClick?: () => void;
  isWeak?: boolean;
  weakLabel?: string;
}) {
  return (
    <div className="relative group">
      {/* Connection arrow from above */}
      <div className="flex justify-center -mt-1 mb-1">
        <ArrowDown className="h-3.5 w-3.5 text-blueprint opacity-40" />
      </div>

      <div
        className={`relative border-2 rounded-sm p-3 transition-all duration-200 hover:shadow-md cursor-pointer ${colorClass} ${isWeak ? "ring-2 ring-destructive/40" : ""}`}
        onClick={onClick}
      >
        {/* Weak warning */}
        {isWeak && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className="bg-destructive text-destructive-foreground rounded-full p-1" title={weakLabel}>
              <AlertTriangle className="h-3 w-3" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono opacity-50">{element}</span>
            <span className="text-xs font-display font-semibold">{label}</span>
          </div>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        </div>

        {blocks.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {blocks.map((block) => (
              <div
                key={block.id}
                className={`flex items-center gap-1 text-[10px] leading-tight px-2 py-1.5 rounded border ${block.color} cursor-pointer hover:shadow-sm transition-shadow max-w-full sm:max-w-[200px] min-h-[2.75rem] sm:min-h-0`}
                onClick={(e) => {
                  e.stopPropagation();
                  block.onClick?.();
                }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", block.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                title={block.label}
              >
                <GripVertical className="h-2.5 w-2.5 opacity-30 shrink-0" />
                <span className="truncate">{block.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">No items yet — click to add</p>
        )}
      </div>
    </div>
  );
}

/* ─── Roof Peak ─── */
function RoofPeak() {
  return (
    <div className="flex justify-center">
      <div
        className="w-0 h-0 border-l-[120px] border-r-[120px] border-b-[36px] border-l-transparent border-r-transparent"
        style={{ borderBottomColor: "hsl(var(--roof-slate))" }}
      />
    </div>
  );
}

/* ─── Foundation Cracks ─── */
function FoundationCracks() {
  return (
    <div className="relative h-2 mx-4 overflow-hidden">
      <svg viewBox="0 0 400 8" className="w-full h-full" preserveAspectRatio="none">
        <path d="M0,4 L30,2 L60,6 L90,3 L120,5 L150,2 L180,6 L210,1 L240,5 L270,3 L300,6 L330,2 L360,5 L400,4" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.5" opacity="0.4" />
        <path d="M50,0 L55,4 L48,8" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1" opacity="0.3" />
        <path d="M200,0 L195,3 L202,6 L198,8" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1" opacity="0.3" />
        <path d="M320,0 L325,5 L318,8" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1" opacity="0.3" />
      </svg>
    </div>
  );
}

/* ─── Main Component ─── */
export default function InteractiveHouseBuilder({ analysis, subQuestions, profile, onNavigate }: Props) {
  const analysisId = analysis.id;

  // Build blocks from data
  const layers = useMemo(() => {
    const povGroups = subQuestions.reduce<Record<string, SubQuestion[]>>((acc, sq) => {
      const key = sq.pov_category || "individual";
      if (!acc[key]) acc[key] = [];
      acc[key].push(sq);
      return acc;
    }, {});

    // Parse consequences data
    const consequencesRaw = analysis.consequences || "";
    const consequenceItems = parseJsonArray(consequencesRaw);
    const implicationItems = parseImplications(consequencesRaw);

    // Count info items across sub-questions
    let totalInfoItems = 0;
    const infoBlocks: Block[] = [];
    const assumptionBlocks: Block[] = [];
    const subConclusionBlocks: Block[] = [];

    subQuestions.forEach((sq) => {
      // Info
      let items: string[] = [];
      try {
        const p = JSON.parse(sq.information);
        if (Array.isArray(p)) {
          items = p.map((entry: any) => typeof entry === "string" ? entry : entry?.text || "");
        } else if (sq.information) items = [sq.information];
      } catch {
        if (sq.information) items = [sq.information];
      }
      totalInfoItems += items.length;
      items.forEach((item, i) => {
        infoBlocks.push({
          id: `info-${sq.id}-${i}`,
          label: item,
          layer: "information",
          onClick: () => onNavigate(`/analysis/${analysisId}/sub-question/${sq.id}?view=builder`),
          color: "bg-foundation-bg border-foundation text-foreground",
        });
      });

      // Sub-conclusions
      if (sq.sub_conclusion) {
        subConclusionBlocks.push({
          id: `sc-${sq.id}`,
          label: sq.sub_conclusion,
          layer: "sub-conclusion",
          onClick: () => onNavigate(`/analysis/${analysisId}/sub-question/${sq.id}?view=builder`),
          color: "bg-primary/10 border-primary text-foreground",
        });
      }
    });

    // Sub-question blocks
    const subQuestionBlocks: Block[] = subQuestions.map((sq) => ({
      id: `sq-${sq.id}`,
      label: sq.question || "Untitled",
      layer: "sub-questions",
      onClick: () => onNavigate(`/analysis/${analysisId}/sub-question/${sq.id}?view=builder`),
      color: sq.pov_category === "individual" ? "bg-pov-individual-bg border-pov-individual text-foreground" :
             sq.pov_category === "group" ? "bg-pov-group-bg border-pov-group text-foreground" :
             "bg-pov-ideas-bg border-pov-ideas text-foreground",
    }));

    // Implication blocks
    const implicationBlocks: Block[] = implicationItems.map((item, i) => ({
      id: `impl-${i}`,
      label: item,
      layer: "implications",
      onClick: () => onNavigate(`/analysis/${analysisId}/implications?view=builder`),
      color: "bg-atmosphere-bg border-atmosphere text-foreground",
    }));

    // Consequence blocks
    const consequenceBlocks: Block[] = consequenceItems.map((item, i) => ({
      id: `cons-${i}`,
      label: item,
      layer: "consequences",
      onClick: () => onNavigate(`/analysis/${analysisId}/consequences?view=builder`),
      color: "bg-assumption-bg border-assumption text-foreground",
    }));

    // Purpose/question blocks
    const purposeBlocks: Block[] = [];
    if (analysis.purpose) {
      purposeBlocks.push({
        id: "purpose",
        label: analysis.purpose,
        layer: "purpose",
        onClick: () => onNavigate(`/analysis/${analysisId}`),
        color: "bg-foundation-bg border-foundation text-foreground",
      });
    }

    const questionBlocks: Block[] = [];
    if (analysis.overarching_question) {
      questionBlocks.push({
        id: "oq",
        label: analysis.overarching_question,
        layer: "question",
        onClick: () => onNavigate(`/analysis/${analysisId}`),
        color: "bg-primary/10 border-primary text-foreground",
      });
    }

    const conclusionBlocks: Block[] = [];
    if (analysis.overarching_conclusion) {
      conclusionBlocks.push({
        id: "oc",
        label: analysis.overarching_conclusion,
        layer: "conclusion",
        onClick: () => onNavigate(`/analysis/${analysisId}/synthesis?view=builder`),
        color: "bg-roof/10 border-roof text-foreground",
      });
    }

    // Profile / Foundation POV
    const foundationBlocks: Block[] = [];
    if (profile) {
      if (profile.biological) foundationBlocks.push({ id: "bio", label: `Bio: ${profile.biological}`, layer: "foundation", color: "bg-foundation-bg border-foundation text-foreground" });
      if (profile.social) foundationBlocks.push({ id: "soc", label: `Social: ${profile.social}`, layer: "foundation", color: "bg-foundation-bg border-foundation text-foreground" });
      if (profile.familial) foundationBlocks.push({ id: "fam", label: `Familial: ${profile.familial}`, layer: "foundation", color: "bg-foundation-bg border-foundation text-foreground" });
      if (profile.individual) foundationBlocks.push({ id: "ind", label: `Individual: ${profile.individual}`, layer: "foundation", color: "bg-foundation-bg border-foundation text-foreground" });
    }

    const isWeakFoundation = totalInfoItems < 3;

    return {
      implicationBlocks,
      consequenceBlocks,
      conclusionBlocks,
      subConclusionBlocks,
      infoBlocks,
      subQuestionBlocks,
      purposeBlocks,
      questionBlocks,
      foundationBlocks,
      isWeakFoundation,
      totalInfoItems,
    };
  }, [analysis, subQuestions, profile, analysisId, onNavigate]);

  return (
    <div className="relative">
      {/* Blueprint grid background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "linear-gradient(hsl(var(--blueprint-line)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--blueprint-line)) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />

      <div className="relative space-y-0 max-w-2xl mx-auto py-4">
        {/* Title */}
        <div className="text-center mb-4">
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Interactive House Builder</p>
          <p className="text-xs text-muted-foreground mt-1">Click any layer to edit • Drag blocks to rearrange</p>
        </div>

        {/* Roof */}
        <RoofPeak />

        {/* Implications & Consequences */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 -mt-0.5">
          <HouseLayer
            label="Implications"
            element="8a"
            blocks={layers.implicationBlocks}
            colorClass="bg-atmosphere-bg/50 border-atmosphere"
            onClick={() => onNavigate(`/analysis/${analysisId}/implications?view=builder`)}
          />
          <HouseLayer
            label="Consequences"
            element="8b"
            blocks={layers.consequenceBlocks}
            colorClass="bg-assumption-bg/50 border-assumption"
            onClick={() => onNavigate(`/analysis/${analysisId}/consequences?view=builder`)}
          />
        </div>

        {/* Overarching Conclusion */}
        <HouseLayer
          label="Overarching Conclusion"
          element="7.2"
          blocks={layers.conclusionBlocks}
          colorClass="bg-card border-roof"
          onClick={() => onNavigate(`/analysis/${analysisId}/synthesis?view=builder`)}
        />

        {/* Sub-Conclusions */}
        <HouseLayer
          label="Sub-Conclusions"
          element="7.1"
          blocks={layers.subConclusionBlocks}
          colorClass="bg-primary/5 border-primary"
          onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions?view=builder`)}
        />

        {/* Logical Inference (conceptual layer) */}
        <div className="relative">
          <div className="flex justify-center -mt-1 mb-1">
            <ArrowDown className="h-3.5 w-3.5 text-blueprint opacity-40" />
          </div>
          <div className="border-2 border-dashed border-atmosphere/40 rounded-sm p-2 text-center bg-atmosphere-bg/20">
            <span className="text-[10px] font-mono text-muted-foreground">6.1 — Logical Inference</span>
            <p className="text-[10px] text-muted-foreground italic mt-0.5">The logical process connecting information and assumptions to conclusions</p>
          </div>
        </div>

        {/* Assumptions */}
        <HouseLayer
          label="Assumptions"
          element="5"
          blocks={[]} // Assumptions are per-sub-question, shown as aggregate
          colorClass="bg-assumption-bg/50 border-assumption"
          onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions?view=builder`)}
        />

        {/* Information / Facts */}
        <HouseLayer
          label="Information / Facts"
          element="4"
          blocks={layers.infoBlocks}
          colorClass="bg-foundation-bg/50 border-foundation"
          isWeak={layers.isWeakFoundation && layers.totalInfoItems > 0}
          weakLabel={`Weak foundation — only ${layers.totalInfoItems} fact(s). Add more evidence.`}
          onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions?view=builder`)}
        />

        {/* Sub-Questions */}
        <HouseLayer
          label="Sub-Questions"
          element="3.2"
          blocks={layers.subQuestionBlocks}
          colorClass="bg-card border-primary/40"
          onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions?view=builder`)}
        />

        {/* Overarching Question */}
        <HouseLayer
          label="Overarching Question"
          element="3.1"
          blocks={layers.questionBlocks}
          colorClass="bg-card border-primary/60"
          onClick={() => onNavigate(`/analysis/${analysisId}`)}
        />

        {/* Purpose */}
        <HouseLayer
          label="Purpose"
          element="2"
          blocks={layers.purposeBlocks}
          colorClass="bg-foundation-bg/30 border-foundation/60"
          onClick={() => onNavigate(`/analysis/${analysisId}`)}
        />

        {/* Foundation — Personal POV */}
        <div className="relative">
          <div className="flex justify-center -mt-1 mb-1">
            <ArrowDown className="h-3.5 w-3.5 text-blueprint opacity-40" />
          </div>
          <div className={`border-2 rounded-sm p-3 bg-foundation-bg border-foundation ${layers.isWeakFoundation && layers.totalInfoItems === 0 ? "ring-2 ring-destructive/40" : ""}`}>
            {layers.isWeakFoundation && layers.totalInfoItems === 0 && (
              <div className="absolute -top-2 -right-2 z-10">
                <div className="bg-destructive text-destructive-foreground rounded-full p-1" title="No facts added yet — your foundation is empty">
                  <AlertTriangle className="h-3 w-3" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono opacity-50">4.2</span>
              <span className="text-xs font-display font-semibold">Personal Foundational POV</span>
            </div>
            {layers.foundationBlocks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {layers.foundationBlocks.map((block) => (
                  <div key={block.id} className={`text-[10px] px-2 py-1 rounded border ${block.color} truncate`}>
                    {block.label}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">Set in Profile</p>
            )}
          </div>
          {/* Foundation base */}
          {layers.isWeakFoundation ? <FoundationCracks /> : (
            <div className="h-2 rounded-b-lg mx-1" style={{ background: "hsl(var(--foundation-stone) / 0.25)" }} />
          )}
        </div>
      </div>
    </div>
  );
}
