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
}

function buildSystemPrompt(analysis?: Analysis | null, subQuestions?: SubQuestion[], profile?: Tables<"profiles"> | null): string {
  let ctx = `You are a critical thinking assistant based on the Trapasso "House of Reason" framework. You help users analyze problems systematically.\n\n`;

  if (profile) {
    ctx += `## User's Personal Foundation (4.2)\n- Biological: ${profile.biological || "Not set"}\n- Social: ${profile.social || "Not set"}\n- Familial: ${profile.familial || "Not set"}\n- Individual: ${profile.individual || "Not set"}\n\n`;
  }

  if (analysis) {
    ctx += `## Current Analysis: "${analysis.title}"\n`;
    ctx += `- Purpose (2): ${analysis.purpose || "Not set"}\n`;
    ctx += `- Sub-purposes (2.1): ${analysis.sub_purposes || "Not set"}\n`;
    ctx += `- Overarching Question (3.1): ${analysis.overarching_question || "Not set"}\n`;
    ctx += `- Overarching Conclusion (7.2): ${analysis.overarching_conclusion || "Not set"}\n`;
    ctx += `- Consequences (8): ${analysis.consequences || "Not set"}\n\n`;
  }

  if (subQuestions?.length) {
    ctx += `## Sub-Questions (3.2)\n`;
    subQuestions.forEach((sq, i) => {
      ctx += `${i + 1}. [${sq.pov_category}] "${sq.question}" — Info: ${sq.information || "None"} — Sub-conclusion: ${sq.sub_conclusion || "None"}\n`;
    });
    ctx += "\n";
  }

  ctx += `IMPORTANT: Start your response by acknowledging what the user has already written. For example: "I see you've defined your Purpose as [X]..." unless nothing has been entered yet. Never ask the user to repeat what they've already typed.\n`;
  return ctx;
}

function buildDraftPrompt(analysis?: Analysis | null, profile?: Tables<"profiles"> | null): string {
  return `You are a critical thinking assistant. Based on the user's goal below and their personal foundation, generate a COMPLETE draft for every element of the House of Reason EXCEPT the Overarching Conclusion (7.2).

Return your response in this EXACT JSON format:
{
  "purpose": "...",
  "sub_purposes": "...",
  "overarching_question": "...",
  "consequences": "...",
  "concepts": [{"term": "...", "definition": "..."}],
  "sub_questions": [
    {"question": "...", "pov_category": "individual|group|ideas_disciplines", "information": "...", "sub_conclusion": "..."}
  ]
}

User's Personal Foundation:
- Biological: ${profile?.biological || "Not set"}
- Social: ${profile?.social || "Not set"}
- Familial: ${profile?.familial || "Not set"}
- Individual: ${profile?.individual || "Not set"}

${analysis?.purpose ? `Current Purpose: ${analysis.purpose}` : ""}
${analysis?.overarching_question ? `Current Question: ${analysis.overarching_question}` : ""}

Generate 3-6 sub-questions across all POV categories. Be thorough but concise.`;
}

export default function AISidebar({ open, onOpenChange, analysis, subQuestions, profile }: AISidebarProps) {
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
    if (draftLoading) return;
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

      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Draft Full House for: "${goalInput}"` },
        { role: "assistant", content: "✅ Draft generated! Here's what I suggest:\n\n" + reply },
      ]);
      setInput("");
      toast.success("Draft generated — review in the chat above");
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

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Bot className="h-10 w-10 mx-auto mb-3 text-primary/40" />
              <p>Ask me anything about your analysis, or hit <strong>Draft Full House</strong> to auto-generate.</p>
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

        {/* Input area */}
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
