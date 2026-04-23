import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SelectionPayload {
  /** The selected text (trimmed). */
  text: string;
  /** Optional pre-filled body for the comment composer (e.g. quoted snippet or AI draft). */
  draft: string;
}

interface Props {
  /** Container whose selections we listen to. */
  containerRef: React.RefObject<HTMLElement>;
  /** Triggered by user clicking "Comment on selection". */
  onComment: (payload: SelectionPayload) => void;
  /** Show the AI-assist button. Defaults to true. */
  enableAI?: boolean;
  /** Optional analysis context passed to the AI prompt. */
  contextSummary?: string;
}

/**
 * Floating toolbar shown when the teacher (or any commenter) highlights text
 * inside a read-only house. Mirrors the look of the AI sidebar TextSelectionToolbar
 * but the actions target the comment system instead of the AI sidebar.
 */
export default function CommentSelectionToolbar({
  containerRef,
  onComment,
  enableAI = true,
  contextSummary,
}: Props) {
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handle = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPos(null);
        setText("");
        return;
      }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setPos(null);
        return;
      }
      const value = sel.toString().trim();
      if (value.length < 3) {
        setPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      setText(value);
      setPos({
        top: rect.top - cRect.top - 44,
        left: Math.max(0, rect.left - cRect.left + rect.width / 2 - 110),
      });
    };

    document.addEventListener("mouseup", handle);
    document.addEventListener("keyup", handle);
    return () => {
      document.removeEventListener("mouseup", handle);
      document.removeEventListener("keyup", handle);
    };
  }, [containerRef]);

  const close = () => {
    setPos(null);
    setText("");
    window.getSelection()?.removeAllRanges();
  };

  const quoted = (snippet: string) => `> ${snippet.replace(/\n/g, "\n> ")}\n\n`;

  const handleComment = () => {
    onComment({ text, draft: quoted(text) });
    close();
  };

  const handleAIAssist = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const systemPrompt = `You are a thoughtful, supportive teacher reviewing a student's reasoning in a "Houses of Thought" critical-thinking analysis.

Your job: read a short snippet the teacher highlighted from the student's work and draft ONE concise piece of constructive feedback (2–4 sentences) the teacher can edit and send.

Rules:
- Specific to the snippet — never generic.
- Lead with what's working, then a focused suggestion or question that pushes the student's thinking.
- Plain text. No headers, no markdown bullets, no emojis. No "Dear student".
- Do not restate the snippet.
${contextSummary ? `\nAnalysis context for grounding:\n${contextSummary}\n` : ""}`;

      const res = await supabase.functions.invoke("ai-router", {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Highlighted snippet:\n"""\n${text}\n"""` },
          ],
          mode: "chat",
        },
      });
      if (res.error) throw new Error(res.error.message);
      const reply = res.data?.choices?.[0]?.message?.content?.trim() || "";
      if (!reply) throw new Error("No suggestion returned");
      onComment({ text, draft: `${quoted(text)}${reply}` });
      close();
    } catch (err: any) {
      toast.error(err.message || "AI draft failed");
    } finally {
      setAiBusy(false);
    }
  };

  if (!pos || !text) return null;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex gap-1 bg-popover border border-border rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={handleComment}>
        <MessageSquare className="h-3 w-3" /> Comment
      </Button>
      {enableAI && (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 gap-1"
          onClick={handleAIAssist}
          disabled={aiBusy}
        >
          {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {aiBusy ? "Drafting…" : "AI-assist"}
        </Button>
      )}
    </div>
  );
}
