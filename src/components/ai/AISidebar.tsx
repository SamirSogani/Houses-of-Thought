import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Sparkles, Loader2, ArrowLeft, List, Search, Zap, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import ChatListView from "./ChatListView";
import ProposedChangeCard from "./ProposedChangeCard";
import TextSelectionToolbar from "./TextSelectionToolbar";
import DraftInfoPage, { type DraftInfo } from "./DraftInfoPage";
import PlacementSelector from "./PlacementSelector";
import DraftHistoryView, { DraftRunDetail } from "./DraftHistoryView";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  action?: any;
}

interface AISidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis?: Analysis | null;
  subQuestions?: SubQuestion[];
  profile?: Tables<"profiles"> | null;
  onDraftComplete?: () => void;
}

interface ChatRecord {
  id: string;
  chat_title: string;
  messages: Message[];
  updated_at: string;
  analysis_id: string;
  user_id: string;
  created_at: string;
}

// ─── Prompt Builders ────────────────────────────────────────

function buildSystemPrompt(
  analysis?: Analysis | null,
  subQuestions?: SubQuestion[],
  profile?: Tables<"profiles"> | null,
  researchMode?: boolean
): string {
  let ctx = `You are the House of Reason AI.

Your role is to apply structured reasoning tools to the user's topic or question.

Before answering, determine:
- The topic or question
- The requested reasoning task
- The required output format

Possible reasoning tasks include:
- Identify assumptions
- Generate sub-questions
- Analyze point of view
- Evaluate argument
- Brainstorm perspectives
- Research information
- Clarify concepts
- Map reasoning structure
- Identify implications
- Identify evidence needs

Always prioritize the requested reasoning task over general explanation.
If the user asks for a specific thinking operation, perform only that operation unless context is required.
If the user question is exploratory or analytical, automatically select the most relevant reasoning tool.

House of Reason Thinking Tools:
- SUB-QUESTIONS: Break the main question into smaller questions that must be answered first.
- ASSUMPTIONS: Identify unstated beliefs or premises required for the claim to hold.
- POINTS OF VIEW: List distinct stakeholders or perspectives from which the issue can be examined.
- IMPLICATIONS: Describe what follows if the claim is true or false.
- EVIDENCE NEEDS: Identify what information would be required to evaluate the claim.

OUTPUT STYLE: Use clear labeled sections and concise bullet points unless explanation is requested.

`;

  if (researchMode) {
    ctx += `## RESEARCH MODE ACTIVE
You are in enhanced research mode. Apply these rules:
- Provide thorough, well-reasoned analysis with deeper investigation.
- Evaluate the reliability and credibility of information sources.
- Avoid citing unreliable, unverified, or speculative sources.
- Only provide specific citations when the user explicitly requests them.
- Distinguish between established facts, expert consensus, and contested claims.
- Flag areas where evidence is weak or conflicting.

`;
  }

  if (profile) {
    const p = profile as any;
    ctx += `## User Profile\n- Role: ${p.role_title || "Not set"}\n- Location: ${p.location_context || "Not set"}\n- About: ${p.about_me || "Not set"}\n\n`;
    ctx += `## Personal Foundation (4.2)\n- Biological: ${profile.biological || "Not set"}\n- Social: ${profile.social || "Not set"}\n- Familial: ${profile.familial || "Not set"}\n- Individual: ${profile.individual || "Not set"}\n\n`;
  }
  if (analysis) {
    ctx += `## Current Analysis: "${analysis.title}"\n- Purpose (2): ${analysis.purpose || "Not set"}\n- Sub-purposes (2.1): ${analysis.sub_purposes || "Not set"}\n- Overarching Question (3.1): ${analysis.overarching_question || "Not set"}\n- Overarching Conclusion (7.2): ${analysis.overarching_conclusion || "Not set"}\n- Consequences (8): ${analysis.consequences || "Not set"}\n\n`;
  }
  if (subQuestions?.length) {
    ctx += `## Sub-Questions (3.2)\n`;
    subQuestions.forEach((sq, i) => {
      ctx += `${i + 1}. [${sq.pov_category}] (id: ${sq.id}) "${sq.question}" — Info: ${sq.information || "None"} — Sub-conclusion: ${sq.sub_conclusion || "None"}\n`;
    });
    ctx += "\n";
  }
  ctx += `IMPORTANT: Start by acknowledging what the user has already written. Never ask them to repeat existing content.\n`;
  return ctx;
}

function buildDraftPrompt(
  analysis?: Analysis | null,
  profile?: Tables<"profiles"> | null,
  draftInfo?: DraftInfo,
  batchMode?: { batch: number; batchCount: number; previousQuestions: string[] }
): string {
  const p = profile as any;
  const profileCtx = `User Profile: Role: ${p?.role_title || "Not set"}, Location: ${p?.location_context || "Not set"}
Personal Foundation: Bio: ${profile?.biological || "Not set"}, Social: ${profile?.social || "Not set"}, Familial: ${profile?.familial || "Not set"}, Individual: ${profile?.individual || "Not set"}
${analysis?.purpose ? `Current Purpose: ${analysis.purpose}` : ""}
${analysis?.overarching_question ? `Current Question: ${analysis.overarching_question}` : ""}`;

  let extraCtx = "";
  if (draftInfo) {
    if (draftInfo.background) extraCtx += `\nBackground Context: ${draftInfo.background}`;
    if (draftInfo.stakeholders) extraCtx += `\nKey Stakeholders: ${draftInfo.stakeholders}`;
    if (draftInfo.constraints) extraCtx += `\nConstraints: ${draftInfo.constraints}`;
  }

  const researchInstructions = `
## RESEARCH MODE (ACTIVE FOR DRAFTING)
Before generating content, you must mentally research and synthesize:
- Established facts and expert consensus relevant to the topic
- Key theoretical frameworks and academic perspectives
- Known debates, controversies, and unresolved questions
- Practical real-world considerations and evidence
Prioritize reliable, well-established sources. Avoid speculative or low-quality reasoning.
All "information" fields must contain substantive, research-backed content — not vague placeholders.
`;

  const assumptionInstructions = `
## ASSUMPTIONS (MUST BE COMPREHENSIVE — ZERO EXCEPTIONS)
Each sub-question MUST have ALL FOUR assumption categories fully populated. This is NON-NEGOTIABLE:
1. "explicit_premises": Stated premises the reasoning openly relies on (at least 2)
2. "hidden_premises": Unstated or implicit beliefs that silently shape the argument (at least 2)
3. "conceptual_frameworks": THE CONCEPTS THAT SHAPE INFERENCES — theoretical frameworks, mental models, paradigms, or conceptual lenses that determine HOW conclusions are drawn from evidence. THIS IS THE MOST CRITICAL CATEGORY. Provide at least 2. Examples: "Utilitarian cost-benefit analysis", "Social constructionism", "Supply and demand theory". These must be specific named frameworks, not vague descriptions.
4. "background_definitions": Key definitions, terms, or background beliefs that influence reasoning (at least 1)

CRITICAL: The "conceptual_frameworks" field corresponds to "Concepts That Shape Inferences" in the House of Reason. It MUST ALWAYS contain at least 2 specific, named conceptual frameworks. If you return fewer than 2, the entire draft will be rejected. NEVER leave this empty.
`;

  // Batch mode: only generate sub-questions (no analysis fields)
  if (batchMode && batchMode.batch > 0) {
    return `You are a critical thinking assistant with research capabilities. YOU MUST RETURN ONLY A SINGLE VALID JSON OBJECT. No markdown, no code fences, no explanation.
${researchInstructions}
${assumptionInstructions}

Generate exactly ${batchMode.batchCount} NEW sub-questions. Do NOT repeat any of these existing questions:
${batchMode.previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Each sub-question must be PRECISE, DISTINCT, and NON-REDUNDANT. No two questions should address the same concern from the same angle.

Return this JSON structure:
{"sub_questions":[{"question":"string","pov_category":"individual|group|ideas_disciplines","pov_label":"string - UNIQUE specific perspective label, NEVER repeat the same label across questions","information":[{"text":"string - one specific fact","evidenceStrength":"strong"},{"text":"string - another fact","evidenceStrength":"moderate"},{"text":"string - third fact","evidenceStrength":"strong"}],"assumptions":{"explicit_premises":["string","string"],"hidden_premises":["string","string"],"conceptual_frameworks":["string - SPECIFIC NAMED framework","string - SPECIFIC NAMED framework"],"background_definitions":["string"]}}]}

CRITICAL RULES:
- DO NOT include "sub_conclusion" — sub-conclusions are NOT generated during drafting.
- DO NOT include "consequences" or "implications" — these are handled separately.
- "information" must contain substantive, researched content — not generic filler.
- Each pov_label must be UNIQUE and DISTINCT. Never use the same label twice.
- Distribute evenly across individual, group, and ideas_disciplines categories.

${profileCtx}${extraCtx}

RETURN ONLY THE JSON OBJECT. Generate exactly ${batchMode.batchCount} sub-questions.`;
  }

  // First batch or small request: generate full house structure
  const count = batchMode ? batchMode.batchCount : (draftInfo?.subQuestionCount || 6);
  return `You are a critical thinking assistant with research capabilities. Generate a COMPLETE draft for the House of Reason.
${researchInstructions}
${assumptionInstructions}

YOU MUST RETURN ONLY A SINGLE VALID JSON OBJECT. No markdown, no code fences, no explanation text before or after.

{
  "purpose": "string - clear statement of the analysis purpose",
  "sub_purposes": "string - supporting purposes",
  "overarching_question": "string - the central question to be answered",
  "concepts": [{"term": "string", "definition": "string"}],
  "pov_labels": {
    "individual": ["string - each label must be UNIQUE and specific, e.g. 'Student', 'Parent', 'Teacher'. Provide 2-3 distinct labels"],
    "group": ["string - each label must be UNIQUE, e.g. 'Government', 'Community Organizations', 'Industry Leaders'. Provide 2-3 distinct labels"],
    "ideas_disciplines": ["string - each label must be UNIQUE, e.g. 'Economics', 'Psychology', 'Ethics'. Provide 2-3 distinct labels"]
  },
  "sub_questions": [
    {
      "question": "string - precise, distinct question",
      "pov_category": "individual" or "group" or "ideas_disciplines",
      "pov_label": "string - must match one of the labels from pov_labels above, each question should use a DIFFERENT label when possible",
      "information": [
        {"text": "string - one discrete, specific fact or piece of evidence", "evidenceStrength": "very_strong|strong|moderate|weak|unsupported"},
        {"text": "string - another distinct fact", "evidenceStrength": "strong"}
      ],
      "assumptions": {
        "explicit_premises": ["string - at least 2 stated premises"],
        "hidden_premises": ["string - at least 2 unstated/implicit beliefs"],
        "conceptual_frameworks": ["string - at least 2 SPECIFIC NAMED frameworks/models that shape how inferences are drawn, e.g. 'Maslow hierarchy of needs', 'Rational choice theory'"],
        "background_definitions": ["string - at least 1 key definition or background belief"]
      }
    }
  ]
}

CRITICAL RULES:
1. DO NOT include "sub_conclusion" for any sub-question — sub-conclusions are NOT generated during drafting. The user will derive these later.
2. "information" MUST be an ARRAY of discrete fact objects, each with "text" and "evidenceStrength". Provide at least 3 separate facts per sub-question. Each fact should be a single, specific claim or piece of evidence — NOT a paragraph combining multiple ideas.
3. All 4 assumption categories must be fully populated for EVERY sub-question.
4. Each pov_label must be UNIQUE. Never repeat labels across sub-questions.
5. DO NOT include "consequences" or "implications" — these are NEVER AI-generated. Consequences are entered by the user.

Generate 3-5 concepts, 2-3 pov_labels PER CATEGORY (individual, group, ideas_disciplines), and ${count === 0 ? "as many sub_questions as needed to thoroughly cover the topic from all relevant points of view" : `EXACTLY ${count} sub_questions`} (distributed across categories).

${profileCtx}${extraCtx}

RETURN ONLY THE JSON OBJECT.`;
}

/** Convert AI-generated information (string or array) to FactEntry[] JSON string */
function serializeInformation(info: any): string {
  if (!info) return "[]";
  // Already an array of fact objects
  if (Array.isArray(info)) {
    const facts = info.map((item: any) => {
      if (typeof item === "string") {
        return { text: item, evidenceStrength: "moderate", sources: [] };
      }
      return {
        text: item.text || String(item),
        evidenceStrength: item.evidenceStrength || "moderate",
        sources: item.sources || [],
      };
    });
    return JSON.stringify(facts);
  }
  // Single string — split by sentences or return as one fact
  if (typeof info === "string") {
    if (!info.trim()) return "[]";
    // Try to split into meaningful chunks by sentence boundaries
    const sentences = info.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 10);
    if (sentences.length > 1) {
      return JSON.stringify(sentences.map((s: string) => ({ text: s.trim(), evidenceStrength: "moderate", sources: [] })));
    }
    return JSON.stringify([{ text: info, evidenceStrength: "moderate", sources: [] }]);
  }
  return "[]";
}

function parseActionFromReply(reply: string): { action: any | null; textContent: string } {
  const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const action = JSON.parse(jsonMatch[1].trim());
      if (action.action === "update_analysis" || action.action === "update_sub_questions") {
        const textContent = reply.replace(/```json[\s\S]*?```/, "").trim();
        return { action, textContent };
      }
    } catch { /* not valid action JSON */ }
  }
  return { action: null, textContent: reply };
}

// ─── Main Component ─────────────────────────────────────────

export default function AISidebar({ open, onOpenChange, analysis, subQuestions, profile, onDraftComplete }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoImplement, setAutoImplement] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // View state: "chat" | "list" | "draft-info" | "draft-history" | "draft-detail"
  const [view, setView] = useState<"chat" | "list" | "draft-info" | "draft-history" | "draft-detail">("chat");
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatsLoaded, setChatsLoaded] = useState(false);

  // Draft history state
  const [draftRuns, setDraftRuns] = useState<any[]>([]);
  const [selectedDraftRunId, setSelectedDraftRunId] = useState<string | null>(null);
  const [activeDraftRunId, setActiveDraftRunId] = useState<string | null>(null);

  // ─── Chat management ────────────────────────────────────

  const loadChats = useCallback(async () => {
    if (!analysis) return;
    const [chatRes, draftRes] = await Promise.all([
      supabase.from("sidebar_chats").select("*").eq("analysis_id", analysis.id).order("updated_at", { ascending: false }),
      supabase.from("draft_runs").select("*").eq("analysis_id", analysis.id).order("created_at", { ascending: false }),
    ]);
    setChats((chatRes.data as any[]) || []);
    setDraftRuns((draftRes.data as any[]) || []);
    setChatsLoaded(true);
  }, [analysis]);

  useEffect(() => {
    if (open && analysis) loadChats();
  }, [open, analysis, loadChats]);

  useEffect(() => {
    if (chatsLoaded && chats.length === 0 && analysis && !activeChatId) {
      createNewChat();
    } else if (chatsLoaded && chats.length > 0 && !activeChatId) {
      selectChat(chats[0].id, chats[0].messages || []);
    }
  }, [chatsLoaded, chats.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const selectChat = (chatId: string, chatMessages?: Message[]) => {
    setActiveChatId(chatId);
    const chat = chats.find((c) => c.id === chatId);
    setMessages((chatMessages || (chat?.messages as Message[]) || []).filter((m) => m.role !== "system"));
    setView("chat");
  };

  const createNewChat = async () => {
    if (!analysis) return;
    const { data, error } = await supabase
      .from("sidebar_chats")
      .insert({ analysis_id: analysis.id, chat_title: "New Chat", messages: [] } as any)
      .select()
      .single();
    if (error || !data) { toast.error("Failed to create chat"); return; }
    setChats((prev) => [data as any, ...prev]);
    setActiveChatId((data as any).id);
    setMessages([]);
    setView("chat");
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    await supabase.from("sidebar_chats").update({ chat_title: newTitle } as any).eq("id", chatId);
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, chat_title: newTitle } : c)));
  };

  const deleteChat = async (chatId: string) => {
    await supabase.from("sidebar_chats").delete().eq("id", chatId);
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const persistMessages = async (newMessages: Message[]) => {
    if (!activeChatId) return;
    await supabase
      .from("sidebar_chats")
      .update({ messages: newMessages as any, updated_at: new Date().toISOString() } as any)
      .eq("id", activeChatId);
  };

  // ─── Draft history management ───────────────────────────
  const deleteDraftRun = async (runId: string) => {
    await supabase.from("draft_runs").delete().eq("id", runId);
    setDraftRuns((prev) => prev.filter((r) => r.id !== runId));
    if (selectedDraftRunId === runId) setSelectedDraftRunId(null);
  };

  const createDraftRun = async (draftInfo: DraftInfo): Promise<string | null> => {
    if (!analysis) return null;
    const { data, error } = await supabase
      .from("draft_runs")
      .insert({ analysis_id: analysis.id, draft_info: draftInfo as any, status: "running", log_messages: [] as any } as any)
      .select()
      .single();
    if (error || !data) return null;
    const run = data as any;
    setDraftRuns((prev) => [run, ...prev]);
    setActiveDraftRunId(run.id);
    return run.id;
  };

  const updateDraftRun = async (runId: string, updates: Record<string, any>) => {
    await supabase.from("draft_runs").update({ ...updates, updated_at: new Date().toISOString() } as any).eq("id", runId);
    setDraftRuns((prev) => prev.map((r) => r.id === runId ? { ...r, ...updates } : r));
  };

  const appendDraftLog = async (runId: string, message: string) => {
    const run = draftRuns.find((r) => r.id === runId);
    const currentLogs = Array.isArray(run?.log_messages) ? run.log_messages : [];
    const newLogs = [...currentLogs, `[${new Date().toLocaleTimeString()}] ${message}`];
    await updateDraftRun(runId, { log_messages: newLogs });
  };

  // ─── Brave Search helper ─────────────────────────────────
  const braveSearch = async (query: string, count = 5): Promise<string> => {
    try {
      const res = await supabase.functions.invoke("brave-search", {
        body: { query, count },
      });
      if (res.error || !res.data?.results) return "";
      const results = res.data.results as { title: string; url: string; description: string }[];
      if (results.length === 0) return "";
      return results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nSource: ${r.url}`)
        .join("\n\n");
    } catch (e) {
      console.warn("Brave search failed:", e);
      return "";
    }
  };

  // ─── Apply action to House ──────────────────────────────

  const applyAction = async (action: any) => {
    if (!analysis) throw new Error("No analysis loaded");
    setSyncing(true);
    try {
      if (action.action === "update_analysis") {
        const rawFields = action.fields || {};
        const validKeys = ["purpose", "sub_purposes", "overarching_question", "overarching_conclusion", "consequences", "title"];
        const fields: Record<string, any> = {};
        for (const key of Object.keys(rawFields)) {
          const normalized = key.replace(/-/g, "_");
          if (validKeys.includes(normalized)) {
            fields[normalized] = rawFields[key];
          }
        }
        if (Object.keys(fields).length === 0) throw new Error("No valid fields to update");
        const { error } = await supabase.from("analyses").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", analysis.id);
        if (error) throw new Error(error.message);
        toast.success("House updated!");
      } else if (action.action === "update_sub_questions") {
        for (const op of action.operations || []) {
          if (op.op === "add") {
            const { error } = await supabase.from("sub_questions").insert({
              analysis_id: analysis.id,
              question: op.question || "",
              pov_category: op.pov_category || "individual",
              information: op.information || "",
              sub_conclusion: op.sub_conclusion || "",
              sort_order: (subQuestions?.length || 0),
            } as any);
            if (error) throw new Error(error.message);
          } else if (op.op === "update" && op.id) {
            const updates: any = {};
            if (op.question !== undefined) updates.question = op.question;
            if (op.information !== undefined) updates.information = op.information;
            if (op.sub_conclusion !== undefined) updates.sub_conclusion = op.sub_conclusion;
            if (op.pov_category !== undefined) updates.pov_category = op.pov_category;
            const { error } = await supabase.from("sub_questions").update(updates).eq("id", op.id);
            if (error) throw new Error(error.message);
          } else if (op.op === "delete" && op.id) {
            const { error } = await supabase.from("sub_questions").delete().eq("id", op.id);
            if (error) throw new Error(error.message);
          }
        }
        toast.success("Sub-questions updated!");
      }
      onDraftComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply changes");
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  // ─── Send message ───────────────────────────────────────

  const sendMessage = async (overrideInput?: string) => {
    const text = overrideInput ?? input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!overrideInput) setInput("");
    setLoading(true);

    const shouldAutoImplement = autoImplement;
    if (autoImplement) setAutoImplement(false); // reset after use

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); setLoading(false); return; }

      let systemContent = buildSystemPrompt(analysis, subQuestions, profile, researchMode);
      if (shouldAutoImplement) {
        systemContent += `\nAUTO-IMPLEMENT MODE: The user wants your suggestions applied directly. Respond with a JSON action block to update the House. Always include an action block in your response.\n`;
      }

      // Research mode: run Brave Search on the user's query and inject results
      if (researchMode) {
        const searchResults = await braveSearch(text, 8);
        if (searchResults) {
          systemContent += `\n## Web Research Results\nThe following are real-time web search results relevant to the user's query. Use these to ground your response with verifiable facts and cite sources where appropriate:\n\n${searchResults}\n`;
        }
      }

      const apiMessages: Message[] = [
        { role: "system", content: systemContent },
        ...newMessages,
      ];

      const res = await supabase.functions.invoke("ai-router", {
        body: { messages: apiMessages, mode: "chat" },
      });

      if (res.error) throw new Error(res.error.message);
      const reply = res.data?.choices?.[0]?.message?.content || "No response.";

      const { action, textContent } = parseActionFromReply(reply);
      const assistantMsg: Message = { role: "assistant", content: textContent || reply, action };
      const updatedMessages = [...newMessages, assistantMsg];
      setMessages(updatedMessages);
      persistMessages(updatedMessages);

      // Auto-implement: if toggled and action exists, apply it immediately
      if (shouldAutoImplement && action) {
        try {
          await applyAction(action);
        } catch { /* toast already shown */ }
      }
    } catch (err: any) {
      toast.error(err.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  // ─── Text selection handlers ────────────────────────────

  const handleAskGroq = (text: string) => {
    setInput(`Regarding this: "${text}"\n\n`);
  };

  const handleImplementChange = (text: string) => {
    setPendingPlacement(text);
  };

  const handlePlacementSelect = (section: string) => {
    if (!pendingPlacement) return;
    const text = pendingPlacement;
    setPendingPlacement(null);

    if (section === "sub_question") {
      const implementMsg = `Implement this as a new sub-question in the House of Reason: "${text}". Respond with a JSON action block to add it.`;
      sendMessage(implementMsg);
    } else {
      const fieldMap: Record<string, string> = {
        overarching_question: "overarching_question",
        purpose: "purpose",
        sub_purposes: "sub_purposes",
        consequences: "consequences",
        overarching_conclusion: "overarching_conclusion",
      };
      const field = fieldMap[section];
      if (field) {
        const implementMsg = `Update the ${section.replace(/_/g, " ")} of the House of Reason to: "${text}". Respond with a JSON action block.`;
        sendMessage(implementMsg);
      }
    }
  };

  // ─── Draft Full House ───────────────────────────────────

  const draftFullHouse = async (draftInfo: DraftInfo) => {
    if (draftLoading || !analysis) return;
    setDraftLoading(true);

    const goalInput = draftInfo.goal;
    if (!goalInput) {
      toast.error("Enter a goal first");
      setDraftLoading(false);
      return;
    }

    let draftRunId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); setDraftLoading(false); return; }

      // Create draft run record
      draftRunId = await createDraftRun(draftInfo);

      const requestedCount = draftInfo.subQuestionCount; // 0 means "as many as needed"
      const batchSize = 5;
      const firstBatchSize = requestedCount === 0 ? batchSize : Math.min(batchSize, requestedCount);
      const maxRetryAttempts = 3; // Max extra retry rounds if we're still short

      const invokeDraftAI = async (body: Record<string, unknown>) => {
        let attempt = 0;

        while (true) {
          const res = await supabase.functions.invoke("ai-router", { body });

          if (!res.error) {
            return res;
          }

          const errorMessage = JSON.stringify(res.error);
          const errorStatus = typeof res.error === "object" && res.error !== null && "context" in res.error
            ? Number((res.error as { context?: { status?: number } }).context?.status)
            : undefined;
          const isRateLimited = errorStatus === 429 || errorMessage.includes("429") || errorMessage.includes("rate limit");
          const isPaymentRequired = errorStatus === 402 || errorMessage.includes("402");

          if (isPaymentRequired) {
            throw new Error("AI credits exhausted. Please add credits in Settings → Workspace → Usage.");
          }

          if (!isRateLimited) {
            throw new Error(
              typeof res.error === "object" && res.error !== null && "message" in res.error
                ? String((res.error as { message?: string }).message || "AI request failed")
                : "AI request failed"
            );
          }

          attempt += 1;
          const waitSecs = Math.min(60, 10 + attempt * 5);
          toast.info(`AI rate limited. Retrying in ${waitSecs}s...`);
          await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
        }
      };

      let allSubQuestions: any[] = [];
      let retryRound = 0;

      // Research: pre-search for topic and theoretical frameworks
      toast.info("🔍 Researching topic...");
      if (draftRunId) appendDraftLog(draftRunId, "Running web research for topic and frameworks...");
      const [topicSearchResults, frameworkSearchResults] = await Promise.all([
        braveSearch(`${goalInput} analysis evidence facts`, 8),
        braveSearch(`${goalInput} theoretical frameworks conceptual models academic perspectives`, 6),
      ]);
      let researchContext = "";
      if (topicSearchResults) {
        researchContext += `\n## WEB RESEARCH RESULTS (USE THESE AS EVIDENCE)\nThe following are real web search results. Use them to populate the "information" fields with REAL, verifiable facts:\n\n${topicSearchResults}\n`;
      }
      if (frameworkSearchResults) {
        researchContext += `\n## CONCEPTUAL FRAMEWORK RESEARCH\nUse these to populate "conceptual_frameworks" in assumptions with REAL, named theoretical frameworks:\n\n${frameworkSearchResults}\n`;
      }
      if (draftRunId && researchContext) appendDraftLog(draftRunId, `Research complete. Found results for both topic and frameworks.`);

      // Keep generating until we hit the exact requested count (with retry limit)
      // If requestedCount is 0 ("as many as needed"), only do one batch
      while ((requestedCount === 0 ? allSubQuestions.length === 0 : allSubQuestions.length < requestedCount) && retryRound <= maxRetryAttempts) {
        const remaining = requestedCount === 0 ? batchSize : requestedCount - allSubQuestions.length;
        const isFirstBatch = allSubQuestions.length === 0 && retryRound === 0;
        const batchCount = isFirstBatch
          ? Math.min(firstBatchSize, remaining)
          : Math.min(batchSize, remaining);
        const totalEstimated = requestedCount === 0 ? 1 : Math.ceil(requestedCount / batchSize);

        if (batchCount <= 0) break;

        const batchMsg = requestedCount === 0
          ? `Generating sub-questions (as many as needed)...`
          : `Generating sub-questions ${allSubQuestions.length + 1}-${allSubQuestions.length + batchCount} of ${requestedCount}...`;
        toast.info(batchMsg);
        if (draftRunId) appendDraftLog(draftRunId, batchMsg);

        let systemPrompt = buildDraftPrompt(
          analysis, profile, draftInfo,
          { batch: isFirstBatch ? 0 : 1, batchCount, previousQuestions: allSubQuestions.map(sq => sq.question) }
        );
        // Inject research results into the draft prompt
        systemPrompt += researchContext;

        const apiMessages: Message[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `My goal: ${goalInput}` },
        ];

        const res = await invokeDraftAI({
          messages: apiMessages,
          mode: "draft",
        });

        if (res.error) throw new Error(res.error.message);
        const reply = res.data?.choices?.[0]?.message?.content || "";

        let draft: any;
        try {
          let cleanReply = reply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const jsonMatch = cleanReply.match(/\{[\s\S]*\}/);
          draft = JSON.parse(jsonMatch ? jsonMatch[0] : cleanReply);
        } catch {
          try {
            const arrMatch = reply.match(/\[[\s\S]*\]/);
            draft = { sub_questions: JSON.parse(arrMatch ? arrMatch[0] : "[]") };
          } catch {
            console.error("Failed to parse draft response:", reply.substring(0, 500));
            toast.error("AI returned invalid format, retrying...");
            retryRound++;
            continue;
          }
        }

        // First batch: save analysis-level fields
        if (isFirstBatch) {
          const analysisUpdate: any = { is_draft: true, updated_at: new Date().toISOString() };
          if (draft.purpose) analysisUpdate.purpose = draft.purpose;
          if (draft.sub_purposes) analysisUpdate.sub_purposes = draft.sub_purposes;
          if (draft.overarching_question) analysisUpdate.overarching_question = draft.overarching_question;
          // DO NOT set consequences — those are generated separately
          await supabase.from("analyses").update(analysisUpdate).eq("id", analysis.id);

          // Insert concepts
          if (draft.concepts?.length) {
            const conceptInserts = draft.concepts.map((c: any) => ({
              analysis_id: analysis.id,
              term: c.term || "",
              definition: c.definition || "",
            }));
            await supabase.from("concepts").insert(conceptInserts);
          }

          // Insert POV labels (deduplicate)
          if (draft.pov_labels) {
            const povInserts: any[] = [];
            const seenLabels = new Set<string>();
            for (const category of ["individual", "group", "ideas_disciplines"]) {
              const labels = draft.pov_labels[category];
              if (Array.isArray(labels)) {
                labels.forEach((label: string, idx: number) => {
                  const key = `${category}:${label}`;
                  if (!seenLabels.has(key)) {
                    seenLabels.add(key);
                    povInserts.push({
                      analysis_id: analysis.id,
                      parent_category: category,
                      label: label,
                      sort_order: idx,
                    });
                  }
                });
              }
            }
            if (povInserts.length > 0) {
              await supabase.from("pov_labels").insert(povInserts);
            }
          }
        }

        // Process sub-questions from this batch
        const newSqs = draft.sub_questions || [];
        // Deduplicate against existing questions
        const existingQuestionSet = new Set(allSubQuestions.map((sq: any) => sq.question.toLowerCase().trim()));
        const uniqueNewSqs = newSqs.filter((sq: any) => {
          const key = sq.question?.toLowerCase().trim();
          if (!key || existingQuestionSet.has(key)) return false;
          existingQuestionSet.add(key);
          return true;
        });

        if (uniqueNewSqs.length > 0) {
          // Fetch POV labels to link sub-questions
          const { data: existingLabels } = await supabase
            .from("pov_labels")
            .select("id, label, parent_category")
            .eq("analysis_id", analysis.id);
          const labelMap = new Map((existingLabels || []).map((l: any) => [`${l.parent_category}:${l.label}`, l.id]));

          const sqInserts = uniqueNewSqs.map((sq: any, i: number) => {
            const povLabelId = sq.pov_label ? labelMap.get(`${sq.pov_category}:${sq.pov_label}`) || null : null;
            return {
              analysis_id: analysis.id,
              question: sq.question || "",
              pov_category: sq.pov_category || "individual",
              pov_label_id: povLabelId,
              information: serializeInformation(sq.information),
              sub_conclusion: "",
              sort_order: (subQuestions?.length || 0) + allSubQuestions.length + i,
              is_draft: true,
            };
          });
          const { data: insertedSqs } = await supabase.from("sub_questions").insert(sqInserts as any).select();

          // Insert assumptions for each sub-question
          if (insertedSqs) {
            const assumptionInserts: any[] = [];
            insertedSqs.forEach((insertedSq: any, idx: number) => {
              const originalSq = uniqueNewSqs[idx];
              const assumptions = originalSq?.assumptions;
              if (assumptions && typeof assumptions === 'object' && !Array.isArray(assumptions)) {
                // Map new 4-category format to DB assumption_type
                const typeMapping: Record<string, string> = {
                  explicit_premises: "foundational_concepts",
                  hidden_premises: "unknown_unknowns",
                  conceptual_frameworks: "concepts_shaping_inferences",
                  background_definitions: "foundational_concepts",
                  // Also support old format keys
                  foundational_concepts: "foundational_concepts",
                  unknown_unknowns: "unknown_unknowns",
                  concepts_shaping_inferences: "concepts_shaping_inferences",
                };
                for (const [key, items] of Object.entries(assumptions)) {
                  const dbType = typeMapping[key] || "unknown_unknowns";
                  if (Array.isArray(items)) {
                    (items as string[]).forEach((assumption: string) => {
                      assumptionInserts.push({
                        sub_question_id: insertedSq.id,
                        content: assumption,
                        assumption_type: dbType,
                      });
                    });
                  }
                }
              } else if (Array.isArray(assumptions)) {
                assumptions.forEach((assumption: string) => {
                  assumptionInserts.push({
                    sub_question_id: insertedSq.id,
                    content: assumption,
                    assumption_type: "unknown_unknowns",
                  });
                });
              }
            });
            if (assumptionInserts.length > 0) {
              await supabase.from("assumptions").insert(assumptionInserts);
            }
          }

          allSubQuestions = [...allSubQuestions, ...uniqueNewSqs];
        } else if (newSqs.length === 0) {
          // No sub-questions returned at all — count as a retry
          retryRound++;
        }
      }

      // ─── Auto-Test & Auto-Refine Loop ───────────────────
      toast.info("Draft complete. Running auto-evaluation...");
      if (draftRunId) appendDraftLog(draftRunId, `Draft generation done. ${allSubQuestions.length} sub-questions. Starting evaluation...`);
      if (draftRunId) updateDraftRun(draftRunId, { sub_questions_generated: allSubQuestions.length });
      onDraftComplete?.(); // reload data first

      const SCORE_TARGET = 60; // standard resilience target
      const ATTACK_SCORE_TARGET = 25; // AI attack mode resilience target
      const LOGIC_CATEGORY_TARGET = 23; // each logic category (out of 25) except completeness
      const DRAFT_TIMEOUT_MS = 3 * 60 * 1000; // 3-minute hard deadline
      const draftStartTime = Date.now();
      let iteration = 0;
      let finalLogicScore = 0;
      let finalResilienceScore = 0;
      let effectiveLogicScore = 0;
      let timedOut = false;

      while (true) {
        // Check 3-minute timeout before each iteration
        if (Date.now() - draftStartTime >= DRAFT_TIMEOUT_MS) {
          timedOut = true;
          const timeoutMsg = `⏱️ 3-minute limit reached. Returning best-effort results (Logic: ${finalLogicScore}/100, Resilience: ${finalResilienceScore}/100).`;
          toast.info(timeoutMsg);
          if (draftRunId) appendDraftLog(draftRunId, timeoutMsg);
          break;
        }
        iteration++;
        toast.info(`🔍 Auto-evaluation round ${iteration}...`);

        // Reload fresh data for evaluation
        const [freshAnalysis, freshSqs] = await Promise.all([
          supabase.from("analyses").select("*").eq("id", analysis.id).maybeSingle(),
          supabase.from("sub_questions").select("*").eq("analysis_id", analysis.id).order("sort_order"),
        ]);
        const currentAnalysis = freshAnalysis.data || analysis;
        const currentSqs = freshSqs.data || [];

        // Also fetch assumptions for full context
        const sqIds = currentSqs.map((sq: any) => sq.id);
        const { data: assumptions } = sqIds.length > 0
          ? await supabase.from("assumptions").select("*").in("sub_question_id", sqIds)
          : { data: [] };
        const assumptionsByQ = new Map<string, any[]>();
        (assumptions || []).forEach((a: any) => {
          if (!assumptionsByQ.has(a.sub_question_id)) assumptionsByQ.set(a.sub_question_id, []);
          assumptionsByQ.get(a.sub_question_id)!.push(a);
        });

        // Build rich context for evaluation
        let evalCtx = `Title: ${currentAnalysis.title}\nPurpose: ${currentAnalysis.purpose || "N/A"}\nSub-Purposes: ${currentAnalysis.sub_purposes || "N/A"}\nQuestion: ${currentAnalysis.overarching_question || "N/A"}\nConclusion: ${currentAnalysis.overarching_conclusion || "N/A"}\nConsequences: ${currentAnalysis.consequences || "N/A"}\n\n`;
        if (profile) {
          evalCtx += `POV: Bio=${profile.biological}, Social=${profile.social}, Familial=${profile.familial}, Individual=${profile.individual}\n\n`;
        }
        currentSqs.forEach((sq: any, i: number) => {
          evalCtx += `SQ${i + 1} [${sq.pov_category}] (id:${sq.id}): "${sq.question}"\n  Info: ${sq.information || "None"}\n  Conclusion: ${sq.sub_conclusion || "None"}\n`;
          const sqAssumptions = assumptionsByQ.get(sq.id) || [];
          if (sqAssumptions.length > 0) {
            evalCtx += `  Assumptions: ${sqAssumptions.map((a: any) => `[${a.assumption_type}] ${a.content}`).join("; ")}\n`;
          }
        });

        // Helper to invoke with client-side retry on 429
        const invokeWithRetry = async (fnName: string, body: any, retries = 3): Promise<any> => {
          for (let r = 0; r < retries; r++) {
            const res = await supabase.functions.invoke(fnName, { body });
            if (res.error && typeof res.error === 'object' && 'message' in res.error && String(res.error.message).includes('429')) {
              const wait = (r + 1) * 15;
              toast.info(`⏳ Rate limited, waiting ${wait}s...`);
              await new Promise(resolve => setTimeout(resolve, wait * 1000));
              continue;
            }
            return res;
          }
          return { data: null, error: 'Rate limit exhausted' };
        };

        // Run logic strength first, then stress test (sequential to avoid rate limits)
        const logicRes = await invokeWithRetry("analyze-logic", { mode: "analyze", analysisContext: evalCtx });
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3s gap
        const stressRes = await invokeWithRetry("analyze-logic", { mode: "stress_test", analysisContext: evalCtx });

        const logicData = logicRes.data;
        const stressData = stressRes.data;
        finalLogicScore = logicData?.score || 0;
        finalResilienceScore = stressData?.resilience_score || 0;

        // Extract individual logic category scores (each out of 25)
        const cats = logicData?.categories || {};
        const evidenceScore = cats.evidence_strength?.score || 0;
        const assumptionScore = cats.assumption_reliability?.score || 0;
        const consistencyScore = cats.logical_consistency?.score || 0;

        // Logic passes when all 3 key categories are >= 23 (completeness discounted)
        const logicPassed = evidenceScore >= LOGIC_CATEGORY_TARGET &&
          assumptionScore >= LOGIC_CATEGORY_TARGET &&
          consistencyScore >= LOGIC_CATEGORY_TARGET;

        effectiveLogicScore = finalLogicScore;

        const roundMsg = `Round ${iteration}: Evidence ${evidenceScore}/25, Assumptions ${assumptionScore}/25, Consistency ${consistencyScore}/25, Resilience ${finalResilienceScore}/100`;
        toast.info(roundMsg);
        if (draftRunId) appendDraftLog(draftRunId, roundMsg);

        // Done when all 3 logic categories >= 23 AND resilience >= 60 (standard)
        if (logicPassed && finalResilienceScore >= SCORE_TARGET) {
          const successMsg = `✅ Target reached! Evidence: ${evidenceScore}, Assumptions: ${assumptionScore}, Consistency: ${consistencyScore}, Resilience: ${finalResilienceScore}`;
          toast.success(successMsg);
          if (draftRunId) appendDraftLog(draftRunId, successMsg);
          break;
        }

        // Build comprehensive refinement feedback
        let refineFeedback = `SCORES ARE BELOW TARGET. YOU MUST FIX ALL ISSUES.\n\n`;
        refineFeedback += `Current: Evidence=${evidenceScore}/25 (need ${LOGIC_CATEGORY_TARGET}), Assumptions=${assumptionScore}/25 (need ${LOGIC_CATEGORY_TARGET}), Consistency=${consistencyScore}/25 (need ${LOGIC_CATEGORY_TARGET}), Resilience=${finalResilienceScore}/100 (need ${SCORE_TARGET}).\n\n`;
        
        if (!logicPassed && logicData?.categories) {
          refineFeedback += "=== LOGIC STRENGTH ISSUES ===\n";
          for (const [key, cat] of Object.entries(logicData.categories) as any) {
            if (key === "completeness") continue; // always discount completeness
            refineFeedback += `${key}: ${cat.score}/25 (${cat.status}) — ${cat.details}\n`;
          }
          if (logicData.suggestions) {
            refineFeedback += "\nSuggestions:\n" + logicData.suggestions.map((s: string) => `- ${s}`).join("\n") + "\n";
          }
          refineFeedback += `\nSummary: ${logicData.reasoning_summary || ""}\n\n`;
        }
        if (finalResilienceScore < SCORE_TARGET && stressData?.vulnerabilities) {
          refineFeedback += "=== STRESS TEST VULNERABILITIES ===\n";
          refineFeedback += `Resilience: ${finalResilienceScore}/100\nAssessment: ${stressData.overall_assessment || ""}\n\n`;
          stressData.vulnerabilities.forEach((v: any) => {
            refineFeedback += `[${v.severity}] Target: ${v.target}\n  Counter: ${v.counter_argument}\n  Fix: ${v.suggestion}\n\n`;
          });
        }

        toast.info(`🔧 Refining draft (round ${iteration})...`);
        if (draftRunId) appendDraftLog(draftRunId, `Refining draft (round ${iteration})...`);

        // Research weaknesses before refining
        const weakTopics = stressData?.vulnerabilities?.slice(0, 3)?.map((v: any) => v.target).join(", ") || goalInput;
        const refineSearchResults = await braveSearch(`${weakTopics} evidence research`, 5);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Rate limit buffer

        // Comprehensive refinement prompt
        let refinePrompt = `You are a critical thinking refinement assistant. Your ONLY job is to fix weaknesses identified by the Logic Strength Meter and Stress Test.

The current analysis scored Evidence=${evidenceScore}/25, Assumptions=${assumptionScore}/25, Consistency=${consistencyScore}/25 (each needs ${LOGIC_CATEGORY_TARGET}+) and Resilience=${finalResilienceScore}/100 (needs ${SCORE_TARGET}+). Completeness is discounted.

${refineFeedback}

Current analysis fields:
- Purpose: "${currentAnalysis.purpose}"
- Sub-purposes: "${currentAnalysis.sub_purposes}"  
- Overarching Question: "${currentAnalysis.overarching_question}"

Current sub-questions:
${currentSqs.map((sq: any, i: number) => {
  const sqA = assumptionsByQ.get(sq.id) || [];
  return `${i + 1}. [id:${sq.id}] [${sq.pov_category}] "${sq.question}"
   Info: "${sq.information}"
   Assumptions (${sqA.length}): ${sqA.map((a: any) => `[${a.assumption_type}] ${a.content}`).join("; ")}`;
}).join("\n\n")}

Return ONLY valid JSON with this structure:
{
  "analysis_updates": {
    "purpose": "improved purpose (or null to skip)",
    "sub_purposes": "improved sub-purposes (or null to skip)",
    "overarching_question": "improved question (or null to skip)"
  },
  "sub_question_updates": [
    {
      "id": "existing sub_question_id",
      "information": [{"text": "specific fact with concrete data", "evidenceStrength": "strong"}, {"text": "another distinct fact", "evidenceStrength": "very_strong"}]
    }
  ],
  "new_sub_questions": [
    {
      "question": "new sub-question to fill gaps",
      "pov_category": "individual|group|ideas_disciplines",
      "information": [{"text": "research-backed fact 1", "evidenceStrength": "strong"}, {"text": "fact 2", "evidenceStrength": "moderate"}, {"text": "fact 3", "evidenceStrength": "strong"}],
      "assumptions": {
        "explicit_premises": ["premise1", "premise2"],
        "hidden_premises": ["hidden1", "hidden2"],
        "conceptual_frameworks": ["framework1", "framework2"],
        "background_definitions": ["definition1"]
      }
    }
  ],
  "new_assumptions": [
    {
      "sub_question_id": "id of existing sub-question",
      "content": "new assumption text",
      "assumption_type": "foundational_concepts|unknown_unknowns|concepts_shaping_inferences"
    }
  ]
}

CRITICAL RULES:
- "information" MUST be an ARRAY of discrete fact objects with "text" and "evidenceStrength" fields. Each fact should be ONE specific claim. Provide at least 3 facts per sub-question.
- Make each fact DRAMATICALLY specific: include named studies, specific statistics, concrete examples, named institutions
- Address EVERY vulnerability and weakness listed above
- Add new sub-questions ONLY if the feedback identifies missing perspectives or gaps
- Add new assumptions ONLY if assumption reliability is flagged as weak
- Do NOT add sub-conclusions — those are user-derived
- Do NOT add consequences
- Set fields to null in analysis_updates if they don't need changes
- new_sub_questions and new_assumptions can be empty arrays if not needed`;

        // Inject refinement search results
        if (refineSearchResults) {
          refinePrompt += `\n\n## ADDITIONAL WEB RESEARCH FOR REFINEMENT\nUse these real search results to strengthen evidence and fix weaknesses:\n\n${refineSearchResults}`;
        }

        const refineRes = await invokeDraftAI({
          messages: [
            { role: "system", content: refinePrompt },
            { role: "user", content: `Fix all issues. Need: Evidence>=${LOGIC_CATEGORY_TARGET}, Assumptions>=${LOGIC_CATEGORY_TARGET}, Consistency>=${LOGIC_CATEGORY_TARGET}, Resilience>=${SCORE_TARGET}. Current: Evidence=${evidenceScore}, Assumptions=${assumptionScore}, Consistency=${consistencyScore}, Resilience=${finalResilienceScore}` },
          ],
          mode: "draft",
        });

        if (refineRes.error) {
          console.error("Refinement API error:", refineRes.error);
          continue;
        }

        const refineReply = refineRes.data?.choices?.[0]?.message?.content || "";
        try {
          let cleanReply = refineReply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const jsonMatch = cleanReply.match(/\{[\s\S]*\}/);
          const refineData = JSON.parse(jsonMatch ? jsonMatch[0] : cleanReply);

          // 1. Update analysis fields
          if (refineData.analysis_updates) {
            const au = refineData.analysis_updates;
            const updateFields: any = { updated_at: new Date().toISOString() };
            if (au.purpose) updateFields.purpose = au.purpose;
            if (au.sub_purposes) updateFields.sub_purposes = au.sub_purposes;
            if (au.overarching_question) updateFields.overarching_question = au.overarching_question;
            if (Object.keys(updateFields).length > 1) {
              await supabase.from("analyses").update(updateFields).eq("id", analysis.id);
            }
          }

          // 2. Update existing sub-question information
          if (refineData.sub_question_updates && Array.isArray(refineData.sub_question_updates)) {
            for (const update of refineData.sub_question_updates) {
              if (update.id && update.information) {
                await supabase.from("sub_questions").update({
                  information: serializeInformation(update.information),
                  updated_at: new Date().toISOString(),
                }).eq("id", update.id);
              }
            }
            toast.success(`Updated ${refineData.sub_question_updates.length} sub-questions`);
          }

          // 3. Add new sub-questions if needed
          if (refineData.new_sub_questions && Array.isArray(refineData.new_sub_questions) && refineData.new_sub_questions.length > 0) {
            const newSqInserts = refineData.new_sub_questions.map((sq: any, i: number) => ({
              analysis_id: analysis.id,
              question: sq.question || "",
              pov_category: sq.pov_category || "individual",
              information: serializeInformation(sq.information),
              sub_conclusion: "",
              sort_order: currentSqs.length + i,
              is_draft: true,
            }));
            const { data: insertedSqs } = await supabase.from("sub_questions").insert(newSqInserts as any).select();

            // Insert assumptions for new sub-questions
            if (insertedSqs) {
              const assumptionInserts: any[] = [];
              insertedSqs.forEach((insertedSq: any, idx: number) => {
                const originalSq = refineData.new_sub_questions[idx];
                const assumptions = originalSq?.assumptions;
                if (assumptions && typeof assumptions === 'object') {
                  const typeMapping: Record<string, string> = {
                    explicit_premises: "foundational_concepts",
                    hidden_premises: "unknown_unknowns",
                    conceptual_frameworks: "concepts_shaping_inferences",
                    background_definitions: "foundational_concepts",
                  };
                  for (const [key, items] of Object.entries(assumptions)) {
                    const dbType = typeMapping[key] || "unknown_unknowns";
                    if (Array.isArray(items)) {
                      (items as string[]).forEach((content: string) => {
                        assumptionInserts.push({ sub_question_id: insertedSq.id, content, assumption_type: dbType });
                      });
                    }
                  }
                }
              });
              if (assumptionInserts.length > 0) {
                await supabase.from("assumptions").insert(assumptionInserts);
              }
            }
            toast.success(`Added ${refineData.new_sub_questions.length} new sub-questions`);
          }

          // 4. Add new assumptions to existing sub-questions
          if (refineData.new_assumptions && Array.isArray(refineData.new_assumptions) && refineData.new_assumptions.length > 0) {
            const validAssumptions = refineData.new_assumptions.filter((a: any) => a.sub_question_id && a.content);
            if (validAssumptions.length > 0) {
              await supabase.from("assumptions").insert(validAssumptions);
              toast.success(`Added ${validAssumptions.length} new assumptions`);
            }
          }
        } catch (e) {
          console.error("Failed to parse refinement response:", e, refineReply?.substring(0, 500));
          // Don't break — try again next iteration
        }
      }

      // Final reload
      onDraftComplete?.();

      // Update draft run as completed
      if (draftRunId) {
        await updateDraftRun(draftRunId, {
          status: timedOut ? "completed_timeout" : "completed",
          iterations: iteration,
          sub_questions_generated: allSubQuestions.length,
          final_logic_score: finalLogicScore,
          final_resilience_score: finalResilienceScore,
        });
      }

      setView("chat");
      const statusEmoji = timedOut ? "⏱️" : "✅";
      const statusText = timedOut
        ? `Draft completed (3-min limit reached, best-effort). Generated ${allSubQuestions.length} sub-questions${requestedCount > 0 ? `/${requestedCount}` : ""}.\n\n📊 Final scores — Logic: ${finalLogicScore}/100, Resilience: ${finalResilienceScore}/100\n\nScores may not have met targets. You can manually refine or re-run.`
        : `Draft complete with auto-refinement! Generated ${allSubQuestions.length} sub-questions${requestedCount > 0 ? `/${requestedCount}` : ""}.\n\n📊 Final scores — Logic: ${finalLogicScore}/100, Resilience: ${finalResilienceScore}/100`;
      const draftMsg: Message[] = [
        { role: "user", content: `Draft Full House for: "${goalInput}"` },
        { role: "assistant", content: `${statusEmoji} ${statusText}\n\nReview the yellow-highlighted elements and Accept or Decline.\n\nNote: Sub-conclusions are left empty for you to derive. Consequences are never AI-generated.` },
      ];
      setMessages((prev) => {
        const cleaned = prev.filter(m => !m.content.startsWith("⏳"));
        return [...cleaned, ...draftMsg];
      });
      persistMessages([...messages, ...draftMsg]);
      toast.success(`Draft applied with ${allSubQuestions.length} sub-questions!`);
    } catch (err: any) {
      toast.error(err.message || "Draft failed");
      if (draftRunId) updateDraftRun(draftRunId, { status: "failed" });
      if (draftRunId) appendDraftLog(draftRunId, `Failed: ${err.message || "Unknown error"}`);
    } finally {
      setDraftLoading(false);
      setActiveDraftRunId(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            {view === "chat" && activeChatId && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("list")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Bot className="h-5 w-5 text-primary" />
            <span className="flex-1">
              {view === "chat"
                ? chats.find((c) => c.id === activeChatId)?.chat_title || "AI Assistant"
                : view === "draft-info"
                ? "Draft Full House"
                : view === "draft-history" || view === "draft-detail"
                ? "Draft History"
                : "Chat History"}
            </span>
            {view === "chat" && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("draft-history")} title="Draft History">
                  <History className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("list")}>
                  <List className="h-4 w-4" />
                </Button>
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {syncing && (
          <div className="px-4 py-2 bg-primary/10 flex items-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" /> Syncing to House...
          </div>
        )}

        {/* Views */}
        {view === "list" ? (
          <ChatListView
            chats={chats}
            onSelectChat={(id) => selectChat(id)}
            onNewChat={createNewChat}
            onRenameChat={renameChat}
            onDeleteChat={deleteChat}
          />
        ) : view === "draft-info" ? (
          <DraftInfoPage
            onBack={() => setView("chat")}
            onDraft={draftFullHouse}
            loading={draftLoading}
            defaultGoal={analysis?.purpose || analysis?.overarching_question || ""}
          />
        ) : view === "draft-history" ? (
          <DraftHistoryView
            runs={draftRuns}
            selectedRunId={selectedDraftRunId}
            onSelectRun={(id) => { setSelectedDraftRunId(id); setView("draft-detail"); }}
            onDeleteRun={deleteDraftRun}
            onNewDraft={() => setView("draft-info")}
            onBack={() => setView("chat")}
          />
        ) : view === "draft-detail" ? (
          (() => {
            const selectedRun = draftRuns.find((r) => r.id === selectedDraftRunId);
            return selectedRun ? (
              <DraftRunDetail run={selectedRun} onBack={() => setView("draft-history")} />
            ) : (
              <DraftHistoryView
                runs={draftRuns}
                selectedRunId={null}
                onSelectRun={(id) => { setSelectedDraftRunId(id); setView("draft-detail"); }}
                onDeleteRun={deleteDraftRun}
                onNewDraft={() => setView("draft-info")}
                onBack={() => setView("chat")}
              />
            );
          })()
        ) : (
          <>
            {/* Messages area with text selection toolbar */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 relative">
              <div ref={messagesContainerRef} className="relative">
                <TextSelectionToolbar
                  containerRef={messagesContainerRef}
                  onAskGroq={handleAskGroq}
                  onImplementChange={handleImplementChange}
                />
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <Bot className="h-10 w-10 mx-auto mb-3 text-primary/40" />
                    <p>Ask me anything about your analysis, or hit <strong>Draft Full House</strong> to auto-generate content.</p>
                    <p className="mt-2 text-xs">Try: "Update the Purpose to..." for direct edits.</p>
                  </div>
                )}
                {messages.filter((m) => m.role !== "system").map((m, i) => (
                  <div key={i} className="space-y-2 mb-3">
                    <div className={`text-sm rounded-lg px-3 py-2 ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground ml-8"
                        : "bg-muted text-foreground mr-8"
                    }`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    {m.action && (
                      <div className="mr-8">
                        <ProposedChangeCard
                          action={m.action}
                          onApply={applyAction}
                          onDismiss={() => {
                            setMessages((prev) =>
                              prev.map((msg, idx) => idx === i ? { ...msg, action: undefined } : msg)
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {pendingPlacement && (
                  <PlacementSelector
                    text={pendingPlacement}
                    onSelect={handlePlacementSelect}
                    onCancel={() => setPendingPlacement(null)}
                  />
                )}
              </div>
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm mr-8">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              )}
            </div>

            {/* Bottom controls */}
            <div className="border-t border-border px-4 py-3 space-y-2">
              {/* Toggle row */}
              <div className="flex gap-2">
                <Button
                  variant={researchMode ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-8"
                  onClick={() => setResearchMode(!researchMode)}
                >
                  <Search className="h-3.5 w-3.5" />
                  Research {researchMode ? "On" : "Off"}
                </Button>
                <Button
                  variant={autoImplement ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-8"
                  onClick={() => setAutoImplement(!autoImplement)}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Auto-Implement {autoImplement ? "On" : "Off"}
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full justify-center gap-2 text-sm"
                onClick={() => setView("draft-info")}
                disabled={draftLoading}
              >
                {draftLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Draft Full House
              </Button>

              <div className="flex gap-2">
                <Textarea
                  placeholder={autoImplement ? "Next message will auto-implement..." : "Ask the AI or type a goal..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-[44px] max-h-[120px] text-sm resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                />
                <Button size="icon" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
