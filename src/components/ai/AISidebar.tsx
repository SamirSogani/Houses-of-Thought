import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;
type SubQuestion = Tables<"sub_questions">;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AISidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis?: Analysis | null;
  subQuestions?: SubQuestion[];
  profile?: Tables<"profiles"> | null;
  onDraftComplete?: () => void;
}

function buildSystemPrompt(analysis?: Analysis | null, subQuestions?: SubQuestion[], profile?: Tables<"profiles"> | null): string {
  let ctx = `You are a critical thinking assistant based on the Trapasso "House of Reason" framework.\n\n`;
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
      ctx += `${i + 1}. [${sq.pov_category}] "${sq.question}" — Info: ${sq.information || "None"} — Sub-conclusion: ${sq.sub_conclusion || "None"}\n`;
    });
    ctx += "\n";
  }
  ctx += `IMPORTANT: Start by acknowledging what the user has already written. Never ask them to repeat existing content.\n`;
  return ctx;
}

function buildDraftPrompt(analysis?: Analysis | null, profile?: Tables<"profiles"> | null): string {
  const p = profile as any;
  return `You are a critical thinking assistant. Generate a COMPLETE draft for every element of the House of Reason EXCEPT the Overarching Conclusion (7.2).

Return ONLY valid JSON in this EXACT format (no markdown, no code fences):
{"purpose":"...","sub_purposes":"...","overarching_question":"...","consequences":"...","sub_questions":[{"question":"...","pov_category":"individual","information":"...","sub_conclusion":"..."}]}

User Profile: Role: ${p?.role_title || "Not set"}, Location: ${p?.location_context || "Not set"}
Personal Foundation: Bio: ${profile?.biological || "Not set"}, Social: ${profile?.social || "Not set"}, Familial: ${profile?.familial || "Not set"}, Individual: ${profile?.individual || "Not set"}
${analysis?.purpose ? `Current Purpose: ${analysis.purpose}` : ""}
${analysis?.overarching_question ? `Current Question: ${analysis.overarching_question}` : ""}

Generate 3-6 sub-questions across individual, group, and ideas_disciplines categories. Be thorough but concise.`;
}

export default function AISidebar({ open, onOpenChange, analysis, subQuestions, profile, onDraftComplete }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
      setMessages([...newMessages, { role: "assistant", content: reply }]);
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

      const apiMessages: Message[] = [
        { role: "system", content: buildDraftPrompt(analysis, profile) },
        { role: "user", content: `My goal: ${goalInput}` },
      ];

      const res = await supabase.functions.invoke("groq-chat", {
        body: { messages: apiMessages, mode: "draft" },
      });

      if (res.error) throw new Error(res.error.message);
      const reply = res.data?.choices?.[0]?.message?.content || "";

      // Parse JSON from reply
      let draft: any;
      try {
        // Try to extract JSON from the response
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        draft = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Failed to parse draft. Raw:\n" + reply }]);
        toast.error("AI returned invalid format. Try again.");
        setDraftLoading(false);
        return;
      }

      // Write draft directly to database
      const analysisUpdate: any = { is_draft: true, updated_at: new Date().toISOString() };
      if (draft.purpose) analysisUpdate.purpose = draft.purpose;
      if (draft.sub_purposes) analysisUpdate.sub_purposes = draft.sub_purposes;
      if (draft.overarching_question) analysisUpdate.overarching_question = draft.overarching_question;
      if (draft.consequences) analysisUpdate.consequences = draft.consequences;

      await supabase.from("analyses").update(analysisUpdate).eq("id", analysis.id);

      // Insert sub-questions as drafts
      if (draft.sub_questions?.length) {
        const sqInserts = draft.sub_questions.map((sq: any, i: number) => ({
          analysis_id: analysis.id,
          question: sq.question || "",
          pov_category: sq.pov_category || "individual",
          information: sq.information || "",
          sub_conclusion: sq.sub_conclusion || "",
          sort_order: (subQuestions?.length || 0) + i,
          is_draft: true,
        }));
        await supabase.from("sub_questions").insert(sqInserts as any);
      }

      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Draft Full House for: "${goalInput}"` },
        { role: "assistant", content: "✅ Draft written directly to your House! Review the yellow-highlighted elements and Accept or Decline." },
      ]);
      setInput("");
      toast.success("Draft applied to your House!");
      onDraftComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Draft failed");
    } finally {
      setDraftLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Bot className="h-5 w-5 text-primary" /> AI Assistant
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Bot className="h-10 w-10 mx-auto mb-3 text-primary/40" />
              <p>Ask me anything about your analysis, or hit <strong>Draft Full House</strong> to auto-generate content directly into your House.</p>
            </div>
          )}
          {messages.filter((m) => m.role !== "system").map((m, i) => (
            <div key={i} className={`text-sm rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : "bg-muted text-foreground mr-8"
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
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
      </SheetContent>
    </Sheet>
  );
}
