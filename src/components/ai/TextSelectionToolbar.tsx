import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Zap } from "lucide-react";

interface TextSelectionToolbarProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onAskGroq: (text: string) => void;
  onImplementChange: (text: string) => void;
}

export default function TextSelectionToolbar({ containerRef, onAskGroq, onImplementChange }: TextSelectionToolbarProps) {
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setPosition(null);
        setSelectedText("");
        return;
      }

      // Check if selection is within our container
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setPosition(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) { setPosition(null); return; }

      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setSelectedText(text);
      setPosition({
        top: rect.top - containerRect.top - 40,
        left: Math.max(0, rect.left - containerRect.left + rect.width / 2 - 100),
      });
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [containerRef]);

  if (!position || !selectedText) return null;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex gap-1 bg-popover border border-border rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
      style={{ top: position.top, left: position.left }}
    >
      <Button
        size="sm"
        variant="ghost"
        className="text-xs h-7 gap-1"
        onClick={() => {
          onAskGroq(selectedText);
          setPosition(null);
          window.getSelection()?.removeAllRanges();
        }}
      >
        <Bot className="h-3 w-3" /> Ask Groq
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-xs h-7 gap-1"
        onClick={() => {
          onImplementChange(selectedText);
          setPosition(null);
          window.getSelection()?.removeAllRanges();
        }}
      >
        <Zap className="h-3 w-3" /> Implement
      </Button>
    </div>
  );
}
