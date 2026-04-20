import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ChevronRight, GripVertical, Plus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface Props {
  analysis: Analysis;
  subQuestions: SubQuestion[];
  profile: Tables<"profiles"> | null;
  onNavigate: (path: string) => void;
  onUpdateField?: (field: keyof Analysis, value: string) => void;
}

/* ─── Staging item types ─── */

type StagingType =
  | "sub-question"
  | "information"
  | "assumption"
  | "sub-conclusion"
  | "implication"
  | "consequence"
  | "concept";

interface StagingItem {
  id: string;
  type: StagingType;
  content: string;
}

const STAGING_TYPES: StagingType[] = [
  "sub-question",
  "information",
  "assumption",
  "sub-conclusion",
  "implication",
  "consequence",
  "concept",
];

const TYPE_LABEL: Record<StagingType, string> = {
  "sub-question": "Sub-question",
  information: "Information",
  assumption: "Assumption",
  "sub-conclusion": "Sub-conclusion",
  implication: "Implication",
  consequence: "Consequence",
  concept: "Concept",
};

const TYPE_BADGE: Record<StagingType, string> = {
  "sub-question": "bg-[hsl(245_85%_94%)] text-[hsl(245_55%_38%)] border-[hsl(245_60%_82%)]",
  information: "bg-[hsl(165_55%_90%)] text-[hsl(165_55%_28%)] border-[hsl(165_45%_75%)]",
  assumption: "bg-[hsl(15_85%_92%)] text-[hsl(15_70%_35%)] border-[hsl(15_70%_80%)]",
  "sub-conclusion": "bg-[hsl(40_90%_88%)] text-[hsl(35_75%_30%)] border-[hsl(40_80%_75%)]",
  implication: "bg-[hsl(205_75%_90%)] text-[hsl(210_60%_32%)] border-[hsl(205_60%_78%)]",
  consequence: "bg-[hsl(220_10%_90%)] text-[hsl(220_15%_30%)] border-[hsl(220_10%_75%)]",
  concept: "bg-[hsl(330_70%_92%)] text-[hsl(330_55%_35%)] border-[hsl(330_55%_80%)]",
};

/* ─── Helpers ─── */

function countInfo(raw: string): { items: number; sources: number } {
  if (!raw) return { items: 0, sources: 0 };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      let sources = 0;
      const items = parsed.length;
      parsed.forEach((p: any) => {
        if (Array.isArray(p?.sources)) sources += p.sources.length;
      });
      return { items, sources };
    }
  } catch {
    /* ignore */
  }
  return { items: raw ? 1 : 0, sources: 0 };
}

function getPovBadgeClass(category: string) {
  if (category === "individual") return "bg-pov-individual-bg text-foreground border-pov-individual";
  if (category === "group") return "bg-pov-group-bg text-foreground border-pov-group";
  return "bg-pov-ideas-bg text-foreground border-pov-ideas";
}

/* ─── Sub-Question Row Card ─── */

const SQ_REJECT_TYPES: StagingType[] = ["implication", "consequence", "concept"];

function SubQuestionRowCard({
  sq,
  povLabel,
  assumptionCount,
  isDragActive,
  onClick,
  onDrop,
  onDropGroup,
}: {
  sq: SubQuestion;
  povLabel: string;
  assumptionCount: number;
  isDragActive: boolean;
  onClick: () => void;
  onDrop: (itemId: string, itemType: StagingType) => void;
  onDropGroup: (groupId: string) => void;
}) {
  const info = countInfo(sq.information || "");
  const hasSubConc = !!sq.sub_conclusion;
  const isEmpty =
    info.items === 0 && info.sources === 0 && assumptionCount === 0 && !hasSubConc;
  const meta = isEmpty
    ? "empty"
    : `${assumptionCount} assumption${assumptionCount === 1 ? "" : "s"} · ${info.sources} source${info.sources === 1 ? "" : "s"} · ${hasSubConc ? "sub-conc. added" : "no sub-conc. yet"}`;

  const [over, setOver] = useState(false);
  const [reject, setReject] = useState(false);
  const [rejectMsg, setRejectMsg] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    const t = e.dataTransfer.types.includes("application/x-staging-type")
      ? e.dataTransfer.getData("application/x-staging-type") as StagingType
      : null;
    // Note: in many browsers getData is empty during dragenter/over; we still highlight optimistically
    setOver(true);
    if (t && SQ_REJECT_TYPES.includes(t)) {
      setReject(true);
      e.dataTransfer.dropEffect = "none";
    } else {
      setReject(false);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = reject ? "none" : "move";
    // Defensive: if dragenter was missed, still flag this card as the active hover target.
    if (!over && !reject) setOver(true);
  };

  const handleDragLeave = () => {
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setOver(false);
      setReject(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setOver(false);
    setReject(false);
    const itemKind = e.dataTransfer.getData("application/x-item-kind");
    if (itemKind === "group") {
      const groupId = e.dataTransfer.getData("application/x-group-id");
      if (groupId) onDropGroup(groupId);
      return;
    }
    const id = e.dataTransfer.getData("text/plain");
    const type = (e.dataTransfer.getData("application/x-staging-type") || "") as StagingType;
    if (!id) return;
    if (type && SQ_REJECT_TYPES.includes(type)) {
      setRejectMsg(true);
      setTimeout(() => setRejectMsg(false), 2200);
      return;
    }
    onDrop(id, type);
  };

  const ringClass = reject
    ? "ring-2 ring-destructive border-destructive bg-destructive/5"
    : over
      ? "ring-2 ring-[hsl(245_70%_45%)] border-[hsl(245_70%_45%)] bg-[hsl(245_85%_88%)] scale-[1.02] shadow-md"
      : isDragActive
        ? "ring-2 ring-[hsl(245_60%_60%)]/70 ring-dashed border-[hsl(245_60%_70%)] animate-pulse"
        : "";

  // Reset highlight if the drag is canceled or ends elsewhere
  useEffect(() => {
    const reset = () => {
      dragCounter.current = 0;
      setOver(false);
      setReject(false);
    };
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={reject ? { cursor: "not-allowed" } : undefined}
      className={`group relative text-left rounded-md border bg-[hsl(245_85%_97%)] border-[hsl(245_60%_82%)] hover:bg-[hsl(245_85%_94%)] hover:border-[hsl(245_60%_70%)] transition-all p-3 min-w-[220px] max-w-[260px] flex-shrink-0 ${ringClass}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2 pointer-events-none">
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border pointer-events-none ${getPovBadgeClass(sq.pov_category)}`}
        >
          {povLabel}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[hsl(245_55%_55%)] opacity-70 group-hover:opacity-100 pointer-events-none" />
      </div>
      <p className="text-xs text-foreground leading-snug line-clamp-3 min-h-[2.5rem] pointer-events-none">
        {sq.question || "Untitled sub-question"}
      </p>
      <p className="text-[10px] text-muted-foreground mt-2 leading-tight pointer-events-none">{meta}</p>

      {rejectMsg && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full z-20 w-[240px] rounded-md border border-destructive/40 bg-card px-2 py-1.5 text-[10px] text-destructive shadow-md">
          Implications, consequences, and concepts go in their own sections above.
        </div>
      )}
    </button>
  );
}

/* ─── Staging Item Card ─── */

function StagingCard({
  item,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  item: StagingItem;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.setData("application/x-staging-type", item.type);
        e.dataTransfer.setData("application/x-staging-content", item.content);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative rounded-md border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${TYPE_BADGE[item.type]}`}
        >
          {TYPE_LABEL[item.type]}
        </span>
        <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onRemove}
            className="p-0.5 hover:text-destructive"
            aria-label="Remove from staging"
          >
            <X className="h-3 w-3" />
          </button>
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-xs text-foreground leading-snug">{item.content}</p>
    </div>
  );
}

/* ─── Add Panel ─── */

function AddPanel({
  onAdd,
  onCancel,
  lockedType,
}: {
  onAdd: (type: StagingType, content: string) => void;
  onCancel: () => void;
  lockedType?: StagingType;
}) {
  const [type, setType] = useState<StagingType>(lockedType ?? "information");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (lockedType) setType(lockedType);
  }, [lockedType]);

  return (
    <div className="rounded-md border border-border bg-card p-3 mb-3 space-y-2">
      {lockedType ? (
        <p className="text-[11px] text-muted-foreground">
          Adding as <span className="font-semibold text-foreground">{TYPE_LABEL[lockedType]}</span>
          <span className="ml-1 opacity-70">(locked by active section)</span>
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {STAGING_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                type === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type or paste material here…"
        className="text-sm min-h-[70px]"
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (content.trim()) {
              onAdd(type, content.trim());
              setContent("");
            }
          }}
          disabled={!content.trim()}
        >
          Add to staging
        </Button>
      </div>
    </div>
  );
}

/* ─── New Group Panel ─── */

type AssumptionModeKey = "shaping_inferences" | "foundational_concepts" | "unknown_unknowns";

function NewGroupPanel({
  onCreate,
  onCancel,
  assumptionModes,
}: {
  onCreate: (name: string, baseType: StagingType, assumptionMode?: AssumptionModeKey) => void;
  onCancel: () => void;
  assumptionModes: Array<{ key: AssumptionModeKey; el: string; label: string; desc: string }>;
}) {
  const [name, setName] = useState("");
  const [baseType, setBaseType] = useState<StagingType>("information");
  const [mode, setMode] = useState<AssumptionModeKey>("foundational_concepts");

  return (
    <div className="rounded-md border border-primary/40 bg-card p-3 mb-3 space-y-2 animate-fade-in">
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
        New section — groups multiple items so you can drag them all at once
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Section name (e.g. Evidence for claim X)"
        className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background"
      />
      <div className="flex flex-wrap gap-1.5">
        {STAGING_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setBaseType(t)}
            className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
              baseType === t
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      {baseType === "assumption" && (
        <div className="rounded-md border border-border bg-background p-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider pb-1">
            Assumption sub-type
          </p>
          <ul className="space-y-1">
            {assumptionModes.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={() => setMode(a.key)}
                  className={`w-full text-left rounded-md border px-2 py-1 transition-colors ${
                    mode === a.key
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="text-[11px] font-semibold">
                    <span className="font-mono text-muted-foreground mr-2">{a.el}</span>
                    {a.label}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onCreate(name.trim(), baseType, baseType === "assumption" ? mode : undefined)}
          disabled={!name.trim()}
        >
          Create section
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function InteractiveHouseBuilder({
  analysis,
  subQuestions,
  profile: _profile,
  onNavigate,
  onUpdateField,
}: Props) {
  const analysisId = analysis.id;

  /* Assumption counts per sub-question */
  const [assumptionCounts, setAssumptionCounts] = useState<Record<string, number>>({});
  /* POV labels (for badge) */
  const [povLabels, setPovLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const sqIds = subQuestions.map((s) => s.id);
    const labelIds = subQuestions
      .map((s) => s.pov_label_id)
      .filter((v): v is string => !!v);

    (async () => {
      const counts: Record<string, number> = {};
      if (sqIds.length > 0) {
        const { data } = await supabase
          .from("assumptions")
          .select("sub_question_id")
          .in("sub_question_id", sqIds);
        (data || []).forEach((a: any) => {
          counts[a.sub_question_id] = (counts[a.sub_question_id] || 0) + 1;
        });
      }
      const labels: Record<string, string> = {};
      if (labelIds.length > 0) {
        const { data } = await supabase
          .from("pov_labels")
          .select("id,label")
          .in("id", labelIds);
        (data || []).forEach((l: any) => {
          labels[l.id] = l.label;
        });
      }
      if (!cancelled) {
        setAssumptionCounts(counts);
        setPovLabels(labels);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subQuestions]);

  /* Staging items — local-only state */
  const [staging, setStaging] = useState<StagingItem[]>([]);
  const [filter, setFilter] = useState<"all" | StagingType | `group:${string}`>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /* Assumption mode — applies to assumptions dragged from staging */
  type AssumptionMode = "shaping_inferences" | "foundational_concepts" | "unknown_unknowns";
  const [assumptionMode, setAssumptionMode] = useState<AssumptionMode>("foundational_concepts");
  const ASSUMPTION_MODES: Array<{ key: AssumptionMode; el: string; label: string; desc: string }> = [
    { key: "unknown_unknowns", el: "5.1", label: "Unknown Unknowns", desc: "Things you don't know that you don't know." },
    { key: "foundational_concepts", el: "5.2", label: "Foundational Concepts", desc: "Underlying assumptions taken for granted (not definitions)." },
    { key: "shaping_inferences", el: "5.3", label: "Concepts that Shape Inferences", desc: "Evidence that leads to an inference or logical leap." },
  ];

  /* Staging groups (Layer-1 draggable sections) */
  interface StagingGroup {
    id: string;
    name: string;
    baseType: StagingType;
    assumptionMode?: AssumptionMode;
    itemIds: string[];
  }
  const [groups, setGroups] = useState<StagingGroup[]>([]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const activeGroup = useMemo(() => {
    if (typeof filter === "string" && filter.startsWith("group:")) {
      const gid = filter.slice(6);
      return groups.find((g) => g.id === gid) || null;
    }
    return null;
  }, [filter, groups]);

  const visibleStaging = useMemo(() => {
    if (activeGroup) {
      const setIds = new Set(activeGroup.itemIds);
      return staging.filter((s) => setIds.has(s.id));
    }
    if (filter === "all") return staging;
    return staging.filter((s) => s.type === filter);
  }, [staging, filter, activeGroup]);

  const addStagingItem = useCallback(
    (type: StagingType, content: string, targetGroupId?: string) => {
      const newId = `stg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setStaging((prev) => [{ id: newId, type, content }, ...prev]);
      if (targetGroupId) {
        setGroups((prev) =>
          prev.map((g) => (g.id === targetGroupId ? { ...g, itemIds: [newId, ...g.itemIds] } : g)),
        );
      }
      setAddOpen(false);
    },
    [],
  );

  const removeStagingItem = useCallback((id: string) => {
    setStaging((prev) => prev.filter((s) => s.id !== id));
    setGroups((prev) => prev.map((g) => ({ ...g, itemIds: g.itemIds.filter((x) => x !== id) })));
  }, []);

  const addGroup = useCallback(
    (name: string, baseType: StagingType, assumptionModeChoice?: AssumptionMode) => {
      const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setGroups((prev) => [
        ...prev,
        {
          id,
          name: name.trim() || TYPE_LABEL[baseType],
          baseType,
          assumptionMode: baseType === "assumption" ? assumptionModeChoice : undefined,
          itemIds: [],
        },
      ]);
      setFilter(`group:${id}`);
      setNewGroupOpen(false);
    },
    [],
  );

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setFilter((f) => (f === `group:${groupId}` ? "all" : f));
  }, []);

  /* ─── Auto-scroll the window during drag ─── */
  const scrollRaf = useRef<number | null>(null);
  const scrollVel = useRef(0);

  useEffect(() => {
    const EDGE = 80;
    const MAX_SPEED = 22;

    const tick = () => {
      if (scrollVel.current !== 0) {
        window.scrollBy(0, scrollVel.current);
        scrollRaf.current = requestAnimationFrame(tick);
      } else {
        scrollRaf.current = null;
      }
    };

    const onDragOver = (e: DragEvent) => {
      // Universally mark the document as a valid drop surface so dragenter
      // fires reliably on nested drop targets across browsers.
      e.preventDefault();
      const y = e.clientY;
      const h = window.innerHeight;
      let v = 0;
      if (y < EDGE) {
        v = -Math.ceil(((EDGE - y) / EDGE) * MAX_SPEED);
      } else if (y > h - EDGE) {
        v = Math.ceil(((y - (h - EDGE)) / EDGE) * MAX_SPEED);
      }
      scrollVel.current = v;
      if (v !== 0 && scrollRaf.current === null) {
        scrollRaf.current = requestAnimationFrame(tick);
      }
    };

    const stop = () => {
      scrollVel.current = 0;
      if (scrollRaf.current !== null) {
        cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = null;
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
      stop();
    };
  }, []);

  /* ─── Persist a dropped staging item to the right place ─── */

  // Append a fact entry to a sub-question's information field
  const appendFactToSubQuestion = useCallback(
    async (sqId: string, content: string) => {
      const sq = subQuestions.find((s) => s.id === sqId);
      if (!sq) return;
      let arr: any[] = [];
      try {
        const parsed = JSON.parse(sq.information || "[]");
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        if (sq.information) arr = [{ fact: sq.information, evidenceStrength: "medium", sources: [] }];
      }
      arr.push({ fact: content, evidenceStrength: "medium", sources: [] });
      const serialized = JSON.stringify(arr);
      await supabase
        .from("sub_questions")
        .update({ information: serialized, updated_at: new Date().toISOString() })
        .eq("id", sqId);
    },
    [subQuestions],
  );

  const routeItemToSubQuestion = useCallback(
    async (sqId: string, item: StagingItem, assumpMode: AssumptionMode) => {
      if (item.type === "information") {
        await appendFactToSubQuestion(sqId, item.content);
      } else if (item.type === "assumption") {
        await supabase.from("assumptions").insert({
          sub_question_id: sqId,
          assumption_type: assumpMode,
          content: item.content,
        });
      } else if (item.type === "sub-conclusion") {
        await supabase
          .from("sub_questions")
          .update({ sub_conclusion: item.content, updated_at: new Date().toISOString() })
          .eq("id", sqId);
      } else {
        await appendFactToSubQuestion(sqId, item.content);
      }
    },
    [appendFactToSubQuestion],
  );

  const handleDropOnSubQuestion = useCallback(
    async (sqId: string, itemId: string) => {
      const item = staging.find((s) => s.id === itemId);
      if (!item) return;
      try {
        await routeItemToSubQuestion(sqId, item, assumptionMode);
        toast.success(`Added to sub-question (${TYPE_LABEL[item.type]})`);
        setStaging((prev) => prev.filter((s) => s.id !== itemId));
        setGroups((prev) => prev.map((g) => ({ ...g, itemIds: g.itemIds.filter((x) => x !== itemId) })));
      } catch (err: any) {
        toast.error(err?.message || "Could not save dropped item");
      }
    },
    [staging, routeItemToSubQuestion, assumptionMode],
  );

  const handleDropGroupOnSubQuestion = useCallback(
    async (sqId: string, groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const items = staging.filter((s) => group.itemIds.includes(s.id));
      const accepted = items.filter((i) => !SQ_REJECT_TYPES.includes(i.type));
      if (accepted.length === 0) {
        toast.error("No items in this section can be dropped on a sub-question.");
        return;
      }
      const mode = group.assumptionMode || assumptionMode;
      try {
        for (const item of accepted) {
          // eslint-disable-next-line no-await-in-loop
          await routeItemToSubQuestion(sqId, item, mode);
        }
        const acceptedIds = new Set(accepted.map((i) => i.id));
        setStaging((prev) => prev.filter((s) => !acceptedIds.has(s.id)));
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        toast.success(`Added ${accepted.length} item${accepted.length === 1 ? "" : "s"} from "${group.name}"`);
      } catch (err: any) {
        toast.error(err?.message || "Could not save section");
      }
    },
    [groups, staging, routeItemToSubQuestion, assumptionMode],
  );

  /* Drop onto an analysis-level zone (concepts / implications / consequences / conclusion / purpose) */
  const handleDropOnAnalysisZone = useCallback(
    async (
      zone: "concepts" | "implications" | "consequences" | "conclusion" | "purpose" | "sub_purposes" | "overarching_question",
      itemId: string,
    ) => {
      const item = staging.find((s) => s.id === itemId);
      if (!item) return;
      try {
        if (zone === "concepts") {
          await supabase.from("concepts").insert({
            analysis_id: analysisId,
            term: item.type === "concept" ? item.content.slice(0, 60) : "Untitled",
            definition: item.content,
          });
          toast.success("Added to Concepts");
        } else {
          // Append to a text field on analyses
          const current = (analysis as any)[zone] || "";
          const next = current ? `${current}\n• ${item.content}` : `• ${item.content}`;
          await supabase
            .from("analyses")
            .update({ [zone]: next, updated_at: new Date().toISOString() })
            .eq("id", analysisId);
          onUpdateField?.(zone as keyof Analysis, next);
          toast.success(`Added to ${zone.replace("_", " ")}`);
        }
        setStaging((prev) => prev.filter((s) => s.id !== itemId));
      } catch (err: any) {
        toast.error(err?.message || "Could not save dropped item");
      }
    },
    [staging, analysis, analysisId, onUpdateField],
  );

  const routeItemToZone = useCallback(
    async (
      zone: "concepts" | "implications" | "consequences" | "conclusion" | "purpose" | "sub_purposes" | "overarching_question",
      item: StagingItem,
      analysisSnapshot: Analysis,
    ) => {
      if (zone === "concepts") {
        await supabase.from("concepts").insert({
          analysis_id: analysisId,
          term: item.type === "concept" ? item.content.slice(0, 60) : "Untitled",
          definition: item.content,
        });
      } else {
        const current = (analysisSnapshot as any)[zone] || "";
        const next = current ? `${current}\n• ${item.content}` : `• ${item.content}`;
        await supabase
          .from("analyses")
          .update({ [zone]: next, updated_at: new Date().toISOString() })
          .eq("id", analysisId);
        onUpdateField?.(zone as keyof Analysis, next);
        (analysisSnapshot as any)[zone] = next;
      }
    },
    [analysisId, onUpdateField],
  );

  const zoneAcceptsType = (
    zone: "concepts" | "implications" | "consequences" | "conclusion" | "purpose" | "sub_purposes" | "overarching_question",
    type: StagingType,
  ): boolean => {
    if (zone === "concepts") return type === "concept";
    if (zone === "implications") return type === "implication";
    if (zone === "consequences") return type === "consequence";
    return true;
  };

  const handleDropGroupOnAnalysisZone = useCallback(
    async (
      zone: "concepts" | "implications" | "consequences" | "conclusion" | "purpose" | "sub_purposes" | "overarching_question",
      groupId: string,
    ) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const items = staging.filter((s) => group.itemIds.includes(s.id));
      const accepted = items.filter((i) => zoneAcceptsType(zone, i.type));
      if (accepted.length === 0) {
        toast.error(`Section "${group.name}" has no items that fit ${zone.replace("_", " ")}.`);
        return;
      }
      try {
        const snap = { ...analysis };
        for (const item of accepted) {
          // eslint-disable-next-line no-await-in-loop
          await routeItemToZone(zone, item, snap as Analysis);
        }
        const acceptedIds = new Set(accepted.map((i) => i.id));
        setStaging((prev) => prev.filter((s) => !acceptedIds.has(s.id)));
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        toast.success(`Added ${accepted.length} item${accepted.length === 1 ? "" : "s"} from "${group.name}"`);
      } catch (err: any) {
        toast.error(err?.message || "Could not save section");
      }
    },
    [groups, staging, analysis, routeItemToZone],
  );

  const getPovLabel = (sq: SubQuestion) => {
    if (sq.pov_label_id && povLabels[sq.pov_label_id]) return povLabels[sq.pov_label_id];
    if (sq.pov_category === "ideas_disciplines") return "Ideas";
    return sq.pov_category.charAt(0).toUpperCase() + sq.pov_category.slice(1);
  };

  /* ─── Render ─── */

  const filterChips: Array<{ key: "all" | StagingType; label: string }> = [
    { key: "all", label: "All" },
    ...STAGING_TYPES.map((t) => ({ key: t, label: TYPE_LABEL[t] })),
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── TOP STAGING CONTAINER (above the house) ── */}
      <div className="rounded-md border-2 border-blueprint bg-card overflow-hidden">
        {/* Sub-questions row */}
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Sub-questions — click to open
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions?view=builder`)}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Sub-question
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {subQuestions.map((sq) => (
              <SubQuestionRowCard
                key={sq.id}
                sq={sq}
                povLabel={getPovLabel(sq)}
                assumptionCount={assumptionCounts[sq.id] || 0}
                isDragActive={!!draggingId}
                onClick={() =>
                  onNavigate(`/analysis/${analysisId}/sub-question/${sq.id}?view=builder`)
                }
                onDrop={(itemId) => { void handleDropOnSubQuestion(sq.id, itemId); }}
                onDropGroup={(groupId) => { void handleDropGroupOnSubQuestion(sq.id, groupId); }}
              />
            ))}
            <button
              type="button"
              onClick={() => onNavigate(`/analysis/${analysisId}/sub-questions?view=builder`)}
              className="rounded-md border border-dashed border-[hsl(245_50%_75%)] text-[hsl(245_55%_55%)] hover:bg-[hsl(245_85%_97%)] flex items-center justify-center min-w-[80px] flex-shrink-0 transition-colors"
              aria-label="Add sub-question"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted-foreground italic px-2">
              staging area — add material, then drag into a sub-question or section above or below
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>

        {/* Staging area */}
        <div className="p-3 sm:p-4 bg-muted/40">
          {/* Filter chips + add button */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {filterChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  filter === c.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
            {groups.map((g) => {
              const active = filter === `group:${g.id}`;
              const count = g.itemIds.length;
              return (
                <div
                  key={g.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-item-kind", "group");
                    e.dataTransfer.setData("application/x-group-id", g.id);
                    e.dataTransfer.setData("application/x-staging-type", g.baseType);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(g.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className={`group/chip flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full border-2 border-dashed cursor-grab active:cursor-grabbing transition-colors ${
                    active
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-background border-border text-foreground hover:border-primary/50"
                  }`}
                  title={`Section: ${g.name} — drag onto a target to apply all items`}
                >
                  <GripVertical className="h-3 w-3 opacity-60" />
                  <button type="button" onClick={() => setFilter(`group:${g.id}`)} className="px-1">
                    {g.name} <span className="opacity-60">({count})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGroup(g.id)}
                    className="p-0.5 opacity-50 hover:opacity-100 hover:text-destructive"
                    aria-label="Remove section"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setNewGroupOpen((v) => !v)}
              >
                <Plus className="h-3 w-3 mr-1" /> New Section
              </Button>
            </div>
          </div>

          {newGroupOpen && (
            <NewGroupPanel
              onCreate={addGroup}
              onCancel={() => setNewGroupOpen(false)}
              assumptionModes={ASSUMPTION_MODES}
            />
          )}

          {activeGroup && (
            <div className="mb-2 text-[11px] text-muted-foreground">
              Adding to section: <span className="font-semibold text-foreground">{activeGroup.name}</span>
              {" "}· base type <span className="font-mono">{TYPE_LABEL[activeGroup.baseType]}</span>
              {" "}· drag this section's chip onto a sub-question or house section to apply all items.
            </div>
          )}

          {/* Assumption-mode list — shown when the Assumption filter chip is active */}
          {filter === "assumption" && (
            <div className="mb-3 rounded-md border border-border bg-card p-2 animate-fade-in">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1 pb-1">
                Assumption type — applied when dropped onto a sub-question
              </p>
              <ul className="space-y-1">
                {ASSUMPTION_MODES.map((a) => {
                  const active = assumptionMode === a.key;
                  return (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() => setAssumptionMode(a.key)}
                        className={`w-full text-left rounded-md border px-2.5 py-1.5 transition-colors ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/40"
                        }`}
                      >
                        <p className="text-xs font-semibold text-foreground">
                          <span className="font-mono text-muted-foreground mr-2">{a.el}</span>
                          {a.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.desc}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {addOpen && (
            <AddPanel
              onAdd={(type, content) =>
                addStagingItem(
                  activeGroup ? activeGroup.baseType : type,
                  content,
                  activeGroup?.id,
                )
              }
              onCancel={() => setAddOpen(false)}
              lockedType={activeGroup ? activeGroup.baseType : undefined}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {visibleStaging.map((item) => (
              <StagingCard
                key={item.id}
                item={item}
                isDragging={draggingId === item.id}
                onDragStart={() => setDraggingId(item.id)}
                onDragEnd={() => setDraggingId(null)}
                onRemove={() => removeStagingItem(item.id)}
              />
            ))}
            {/* Empty placeholder affordances */}
            {Array.from({ length: Math.max(0, 3 - (visibleStaging.length % 4)) }).map(
              (_, i) => (
                <button
                  key={`placeholder-${i}`}
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 text-xs py-6 transition-colors"
                >
                  + Add material
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {/* ── COMPACT SECTION SHORTCUTS (replaces full standard house layout) ── */}
      <div className="rounded-md border-2 border-blueprint bg-card p-3 sm:p-4 space-y-3">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
          House sections — click to open · drop staging items here
        </p>

        {(() => {
          const SectionTile = ({
            code,
            title,
            value,
            zone,
            onClickPath,
            accept = true,
          }: {
            code: string;
            title: string;
            value?: string;
            zone?: Parameters<typeof handleDropOnAnalysisZone>[0];
            onClickPath: string;
            accept?: boolean;
          }) => {
            const [over, setOver] = useState(false);
            const isActive = !!draggingId && accept;
            return (
              <button
                type="button"
                onClick={() => onNavigate(onClickPath)}
                onDragOver={(e) => {
                  if (!accept) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (!over) setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  if (!accept || !zone) return;
                  e.preventDefault();
                  setOver(false);
                  const kind = e.dataTransfer.getData("application/x-item-kind");
                  if (kind === "group") {
                    const groupId = e.dataTransfer.getData("application/x-group-id");
                    if (groupId) void handleDropGroupOnAnalysisZone(zone, groupId);
                    return;
                  }
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) void handleDropOnAnalysisZone(zone, id);
                }}
                className={`text-left rounded-md border bg-background hover:bg-muted/50 transition-all p-3 ${
                  over
                    ? "ring-2 ring-[hsl(245_70%_45%)] border-[hsl(245_70%_45%)] bg-[hsl(245_85%_92%)] scale-[1.02] shadow-md"
                    : isActive
                      ? "ring-2 ring-[hsl(245_60%_60%)]/70 ring-dashed border-[hsl(245_60%_70%)] animate-pulse"
                      : "border-border"
                }`}
              >
                <p className="text-[10px] font-mono text-muted-foreground pointer-events-none">{code}</p>
                <p className="text-sm font-display font-semibold text-foreground mt-0.5 pointer-events-none">{title}</p>
                {value !== undefined && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 pointer-events-none">
                    {value || <span className="italic">empty — click to edit</span>}
                  </p>
                )}
              </button>
            );
          };

          return (
            <>
              {/* Atmosphere */}
              <div className="grid grid-cols-1">
                <SectionTile
                  code="ELEMENT 1 — ATMOSPHERE"
                  title="Concepts, Theories & Definitions"
                  zone="concepts"
                  onClickPath={`/analysis/${analysisId}/concepts`}
                />
              </div>

              {/* Roof: Consequences / Purpose / Implications */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <SectionTile
                  code="8b — CONSEQUENCES"
                  title="Consequences"
                  value={analysis.consequences}
                  zone="consequences"
                  onClickPath={`/analysis/${analysisId}/consequences?view=builder`}
                />
                <SectionTile
                  code="ELEMENT 2 — PURPOSE"
                  title="Overarching Purpose"
                  value={analysis.purpose}
                  zone="purpose"
                  onClickPath={`/analysis/${analysisId}/?view=builder`}
                />
                <SectionTile
                  code="8a — IMPLICATIONS"
                  title="Implications"
                  zone="implications"
                  onClickPath={`/analysis/${analysisId}/implications?view=builder`}
                />
              </div>

              {/* Ceiling: Question + Conclusion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SectionTile
                  code="3.1 — OVERARCHING QUESTION"
                  title="Overarching Question"
                  value={analysis.overarching_question}
                  zone="overarching_question"
                  onClickPath={`/analysis/${analysisId}/?view=builder`}
                />
                <SectionTile
                  code="7.2 — OVERARCHING CONCLUSION"
                  title="Overarching Conclusion"
                  value={analysis.overarching_conclusion}
                  onClickPath={`/analysis/${analysisId}/synthesis?view=builder`}
                  accept={false}
                />
              </div>

              {/* Foundation */}
              <div className="grid grid-cols-1">
                <SectionTile
                  code="ELEMENT 4.2 — PERSONAL FOUNDATIONAL POV"
                  title="Personal Foundational Point of View"
                  value="Biological · Social · Familial · Individual — set in Profile"
                  onClickPath="/profile"
                  accept={false}
                />
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
