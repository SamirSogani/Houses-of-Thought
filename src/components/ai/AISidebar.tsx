import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Sparkles, Loader2, ArrowLeft, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import ChatListView from "./ChatListView";
import ProposedChangeCard from "./ProposedChangeCard";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  action?: any; // parsed action for proposed changes
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

function buildSystemPrompt(analysis?: Analysis | null, subQuestions?: SubQuestion[], profile?: Tables<"profiles"> | null): string {
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

function buildDraftPrompt(analysis?: Analysis | null, profile?: Tables<"profiles"> | null, requestedCount?: number): string {
  const p = profile as any;
  const count = requestedCount || 6;
  return `You are a critical thinking assistant. Generate a COMPLETE draft for every element of the House of Reason EXCEPT the Overarching Conclusion (7.2).

Return ONLY valid JSON in this EXACT format (no markdown, no code fences):
{"purpose":"...","sub_purposes":"...","overarching_question":"...","consequences":"...","sub_questions":[{"question":"...","pov_category":"individual","information":"...","sub_conclusion":"..."}]}

User Profile: Role: ${p?.role_title || "Not set"}, Location: ${p?.location_context || "Not set"}
Personal Foundation: Bio: ${profile?.biological || "Not set"}, Social: ${profile?.social || "Not set"}, Familial: ${profile?.familial || "Not set"}, Individual: ${profile?.individual || "Not set"}
${analysis?.purpose ? `Current Purpose: ${analysis.purpose}` : ""}
${analysis?.overarching_question ? `Current Question: ${analysis.overarching_question}` : ""}

CRITICAL: Generate EXACTLY ${count} sub-questions across individual, group, and ideas_disciplines categories. Do NOT generate fewer than ${count}. Each must be unique and substantive.`;
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

export default function AISidebar({ open, onOpenChange, analysis, subQuestions, profile, onDraftComplete }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Multi-chat state
  const [view, setView] = useState<"chat" | "list">("chat");
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatsLoaded, setChatsLoaded] = useState(false);

  // Load chats when sidebar opens or analysis changes
  const loadChats = useCallback(async () => {
    if (!analysis) return;
    const { data } = await supabase
      .from("sidebar_chats")
      .select("*")
      .eq("analysis_id", analysis.id)
      .order("updated_at", { ascending: false });
    setChats((data as any[]) || []);
    setChatsLoaded(true);
  }, [analysis]);

  useEffect(() => {
    if (open && analysis) loadChats();
  }, [open, analysis, loadChats]);

  // Auto-create a chat if none exist
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

  const applyAction = async (action: any) => {
    if (!analysis) throw new Error("No analysis loaded");
    setSyncing(true);
    try {
      if (action.action === "update_analysis") {
        const rawFields = action.fields || {};
        // Whitelist only valid analysis columns to prevent AI hallucinating column names
        const validKeys = ["purpose", "sub_purposes", "overarching_question", "overarching_conclusion", "consequences", "title"];
        const fields: Record<string, any> = {};
        for (const key of Object.keys(rawFields)) {
          const normalized = key.replace(/-/g, "_"); // fix AI using hyphens instead of underscores
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
      throw err; // Re-throw so ProposedChangeCard knows it failed
    } finally {
      setSyncing(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); setLoading(false); return; }

      const apiMessages: Message[] = [
        { role: "system", content: buildSystemPrompt(analysis, subQuestions, profile) },
        ...newMessages,
      ];

      const res = await supabase.functions.invoke("groq-chat", {
        body: { messages: apiMessages, mode: "chat" },
      });

      if (res.error) throw new Error(res.error.message);
      const reply = res.data?.choices?.[0]?.message?.content || "No response.";

      const { action, textContent } = parseActionFromReply(reply);
      const assistantMsg: Message = { role: "assistant", content: textContent || reply, action };
      const updatedMessages = [...newMessages, assistantMsg];
      setMessages(updatedMessages);
      persistMessages(updatedMessages);
    } catch (err: any) {
      toast.error(err.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const draftFullHouse = async () => {
    if (draftLoading || !analysis) return;
    setDraftLoading(true);

    const goalInput = input.trim() || analysis?.purpose || analysis?.overarching_question || "";
    if (!goalInput) {
      toast.error("Enter a goal or set a Purpose/Question first");
      setDraftLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); setDraftLoading(false); return; }

      const countMatch = goalInput.match(/(\d+)\s*sub.?questions?/i);
      const requestedCount = countMatch ? parseInt(countMatch[1]) : undefined;
      const batchSize = 20;
      const needsBatching = requestedCount && requestedCount > batchSize;
      const totalBatches = needsBatching ? Math.ceil(requestedCount / batchSize) : 1;

      let allSubQuestions: any[] = [];

      for (let batch = 0; batch < totalBatches; batch++) {
        const batchCount = needsBatching
          ? Math.min(batchSize, requestedCount - allSubQuestions.length)
          : requestedCount || 6;

        const apiMessages: Message[] = [
          { role: "system", content: buildDraftPrompt(analysis, profile, batchCount) },
          { role: "user", content: `My goal: ${goalInput}` },
        ];

        if (batch > 0 && allSubQuestions.length > 0) {
          apiMessages.push({
            role: "assistant",
            content: `Previously generated ${allSubQuestions.length} sub-questions: ${JSON.stringify(allSubQuestions.map(sq => sq.question))}`,
          });
          apiMessages.push({
            role: "user",
            content: `Generate the next ${batchCount} UNIQUE sub-questions. Do NOT repeat any of the above.`,
          });
        }

        const res = await supabase.functions.invoke("groq-chat", {
          body: { messages: apiMessages, mode: "draft", batchIndex: batch, totalBatches },
        });

        if (res.error) throw new Error(res.error.message);
        const reply = res.data?.choices?.[0]?.message?.content || "";

        let draft: any;
        try {
          const jsonMatch = reply.match(/\{[\s\S]*\}/);
          draft = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
        } catch {
          try {
            const arrMatch = reply.match(/\[[\s\S]*\]/);
            draft = { sub_questions: JSON.parse(arrMatch ? arrMatch[0] : "[]") };
          } catch {
            toast.error("AI returned invalid format on batch " + (batch + 1));
            break;
          }
        }

        if (batch === 0) {
          const analysisUpdate: any = { is_draft: true, updated_at: new Date().toISOString() };
          if (draft.purpose) analysisUpdate.purpose = draft.purpose;
          if (draft.sub_purposes) analysisUpdate.sub_purposes = draft.sub_purposes;
          if (draft.overarching_question) analysisUpdate.overarching_question = draft.overarching_question;
          if (draft.consequences) analysisUpdate.consequences = draft.consequences;
          await supabase.from("analyses").update(analysisUpdate).eq("id", analysis.id);
        }

        if (draft.sub_questions?.length) {
          allSubQuestions = [...allSubQuestions, ...draft.sub_questions];
          // Stream to DB: save each batch immediately
          const sqInserts = draft.sub_questions.map((sq: any, i: number) => ({
            analysis_id: analysis.id,
            question: sq.question || "",
            pov_category: sq.pov_category || "individual",
            information: sq.information || "",
            sub_conclusion: sq.sub_conclusion || "",
            sort_order: (subQuestions?.length || 0) + allSubQuestions.length - draft.sub_questions.length + i,
            is_draft: true,
          }));
          await supabase.from("sub_questions").insert(sqInserts as any);
        }

        if (needsBatching) {
          setMessages((prev) => {
            const existing = prev.filter(m => !m.content.startsWith("⏳"));
            return [...existing, { role: "assistant", content: `⏳ Generated ${allSubQuestions.length}/${requestedCount} sub-questions (batch ${batch + 1}/${totalBatches})...` }];
          });
        }
      }

      const draftMsg: Message[] = [
        { role: "user", content: `Draft Full House for: "${goalInput}"` },
        { role: "assistant", content: `✅ Draft complete! Generated ${allSubQuestions.length} sub-questions. Review the yellow-highlighted elements and Accept or Decline.` },
      ];
      setMessages((prev) => {
        const cleaned = prev.filter(m => !m.content.startsWith("⏳"));
        return [...cleaned, ...draftMsg];
      });
      persistMessages([...messages, ...draftMsg]);
      setInput("");
      toast.success(`Draft applied with ${allSubQuestions.length} sub-questions!`);
      onDraftComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Draft failed");
    } finally {
      setDraftLoading(false);
    }
  };

  const showChatView = view === "chat";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            {showChatView && activeChatId && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("list")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Bot className="h-5 w-5 text-primary" />
            <span className="flex-1">
              {showChatView
                ? chats.find((c) => c.id === activeChatId)?.chat_title || "AI Assistant"
                : "Chat History"}
            </span>
            {showChatView && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("list")}>
                <List className="h-4 w-4" />
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        {syncing && (
          <div className="px-4 py-2 bg-primary/10 flex items-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" /> Syncing to House...
          </div>
        )}

        {!showChatView ? (
          <ChatListView
            chats={chats}
            onSelectChat={(id) => selectChat(id)}
            onNewChat={createNewChat}
            onRenameChat={renameChat}
            onDeleteChat={deleteChat}
          />
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Bot className="h-10 w-10 mx-auto mb-3 text-primary/40" />
                  <p>Ask me anything about your analysis, or hit <strong>Draft Full House</strong> to auto-generate content.</p>
                  <p className="mt-2 text-xs">Try: "Update the Purpose to..." for direct edits.</p>
                </div>
              )}
              {messages.filter((m) => m.role !== "system").map((m, i) => (
                <div key={i} className="space-y-2">
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
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm mr-8">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              )}
            </div>

            <div className="border-t border-border px-4 py-3 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-center gap-2 text-sm"
                onClick={draftFullHouse}
                disabled={draftLoading}
              >
                {draftLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Draft Full House
              </Button>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ask the AI or type a goal for Draft..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-[44px] max-h-[120px] text-sm resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                />
                <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim()}>
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
