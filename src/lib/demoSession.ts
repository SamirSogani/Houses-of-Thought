// Anonymous demo session — stored entirely in localStorage.
// Lets visitors try Houses of Thought without an account.

import { supabase } from "@/integrations/supabase/client";

export const DEMO_KEY = "hot:demo-session-v1";
export const DEMO_PENDING_IMPORT_KEY = "hot:demo-pending-import-v1";

export type DemoPovCategory = "individual" | "group" | "ideas";

export interface DemoSubQuestion {
  id: string;
  question: string;
  pov_category: DemoPovCategory;
  pov_label_id: string | null;
  information: string;
  sub_conclusion: string;
}

export interface DemoPov {
  id: string;
  label: string;
  parent_category: DemoPovCategory;
}

export interface DemoSession {
  title: string;
  purpose: string;
  overarching_question: string;
  overarching_conclusion: string;
  povs: DemoPov[];
  subQuestions: DemoSubQuestion[];
  createdAt: string;
}

export const SAMPLE_DEMO: Omit<DemoSession, "createdAt"> = {
  title: "Should I start a club at school?",
  purpose:
    "Decide whether starting a new club is worth my time and will benefit other students.",
  overarching_question: "Should I start a club at school?",
  overarching_conclusion: "",
  povs: [
    { id: cryptoId(), label: "Me (the founder)", parent_category: "individual" },
    { id: cryptoId(), label: "Potential members", parent_category: "group" },
    { id: cryptoId(), label: "Long-term impact", parent_category: "ideas" },
  ],
  subQuestions: [
    {
      id: cryptoId(),
      question: "How much time will running this club realistically take?",
      pov_category: "individual",
      pov_label_id: null,
      information: "",
      sub_conclusion: "",
    },
    {
      id: cryptoId(),
      question: "Is there genuine interest from other students?",
      pov_category: "group",
      pov_label_id: null,
      information: "",
      sub_conclusion: "",
    },
    {
      id: cryptoId(),
      question: "What value will this club add that doesn't already exist?",
      pov_category: "ideas",
      pov_label_id: null,
      information: "",
      sub_conclusion: "",
    },
  ],
};

export function emptyDemo(title = "My House"): DemoSession {
  return {
    title,
    purpose: "",
    overarching_question: "",
    overarching_conclusion: "",
    povs: [],
    subQuestions: [],
    createdAt: new Date().toISOString(),
  };
}

export function sampleDemo(): DemoSession {
  return { ...SAMPLE_DEMO, createdAt: new Date().toISOString() };
}

export function loadDemo(): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

export function saveDemo(d: DemoSession) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(d));
}

export function clearDemo() {
  localStorage.removeItem(DEMO_KEY);
}

export function stagePendingImport(d: DemoSession) {
  localStorage.setItem(DEMO_PENDING_IMPORT_KEY, JSON.stringify(d));
}

export function consumePendingImport(): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_PENDING_IMPORT_KEY);
    if (!raw) return null;
    localStorage.removeItem(DEMO_PENDING_IMPORT_KEY);
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export { cryptoId };

/**
 * Import a demo session into the authenticated user's account.
 * Creates an analysis row, pov_labels, and sub_questions.
 * Returns the new analysis id, or null on failure.
 */
export async function importDemoToAccount(d: DemoSession): Promise<string | null> {
  const { data: analysis, error: aErr } = await supabase
    .from("analyses")
    .insert({
      title: d.title || "My House",
      purpose: d.purpose || "",
      overarching_question: d.overarching_question || "",
      overarching_conclusion: d.overarching_conclusion || "",
    })
    .select()
    .single();
  if (aErr || !analysis) return null;

  // POV labels
  const idMap = new Map<string, string>();
  if (d.povs.length > 0) {
    const { data: povRows, error: pErr } = await supabase
      .from("pov_labels")
      .insert(
        d.povs.map((p, i) => ({
          analysis_id: analysis.id,
          label: p.label,
          parent_category: p.parent_category,
          sort_order: i,
        }))
      )
      .select();
    if (!pErr && povRows) {
      povRows.forEach((row, i) => {
        const local = d.povs[i];
        if (local) idMap.set(local.id, row.id);
      });
    }
  }

  // Sub-questions
  if (d.subQuestions.length > 0) {
    await supabase.from("sub_questions").insert(
      d.subQuestions.map((sq, i) => ({
        analysis_id: analysis.id,
        question: sq.question,
        pov_category: sq.pov_category,
        pov_label_id: sq.pov_label_id ? idMap.get(sq.pov_label_id) ?? null : null,
        information: sq.information,
        sub_conclusion: sq.sub_conclusion,
        sort_order: i,
      }))
    );
  }

  return analysis.id;
}
