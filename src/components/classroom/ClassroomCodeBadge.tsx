import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ClassroomCodeBadge({ code, size = "md" }: { code: string; size?: "sm" | "md" | "lg" }) {
  const [copied, setCopied] = useState(false);
  const sizeClass =
    size === "lg" ? "text-2xl px-4 py-2" : size === "sm" ? "text-sm px-2 py-1" : "text-base px-3 py-1.5";

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-2 rounded-lg bg-primary/10 text-primary font-mono font-bold tracking-wider hover:bg-primary/15 transition-colors ${sizeClass}`}
      title="Copy code"
    >
      <span>{code}</span>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-60" />}
    </button>
  );
}
