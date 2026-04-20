import { useState } from "react";
import { Search, Loader2, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Dedicated Research panel for Student accounts (replaces the AI sidebar's
 * Research Mode toggle). Calls the existing `brave-search` edge function.
 */
export default function ResearchPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BraveResult[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brave-search", {
        body: { query: q, count: 8 },
      });
      if (error) throw error;
      const items: BraveResult[] = Array.isArray(data?.results) ? data.results : [];
      setResults(items);
      if (items.length === 0) toast.info("No results found.");
    } catch (e: any) {
      toast.error(e?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyCitation = async (r: BraveResult, i: number) => {
    const citation = `${r.title}. ${r.url}`;
    await navigator.clipboard.writeText(citation);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Search className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold">Research</h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Search the web with Brave. Use the results to ground facts and find sources you can cite in your house.
      </p>

      <div className="flex gap-1.5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
          placeholder="Search a topic, fact, or source..."
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8" onClick={runSearch} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {results.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground italic">Results will appear here.</p>
      )}

      <div className="space-y-2">
        {results.map((r, i) => (
          <div key={i} className="bg-muted/40 border border-border rounded p-2 space-y-1">
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary hover:underline flex items-start gap-1"
            >
              <span className="flex-1">{r.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
            </a>
            <p className="text-[10px] text-muted-foreground line-clamp-3 leading-snug">{r.description}</p>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">{r.url}</span>
              <button
                onClick={() => copyCitation(r, i)}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Copy citation"
              >
                {copiedIdx === i ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                {copiedIdx === i ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
