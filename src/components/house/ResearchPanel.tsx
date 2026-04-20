import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, ExternalLink, Copy, Check, History, ArrowLeft, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

interface ResearchEntry {
  query: string;
  results: BraveResult[];
  timestamp: string;
}

interface ResearchSession {
  id: string;
  chat_title: string;
  messages: ResearchEntry[];
  updated_at: string;
}

interface ResearchPanelProps {
  analysisId?: string;
}

const TITLE_PREFIX = "[research] ";

/**
 * Student Research panel with persistent, multi-session history (mirrors AI sidebar UX).
 * Stored in `sidebar_chats` with a `[research]` title prefix to distinguish from AI chats.
 */
export default function ResearchPanel({ analysisId }: ResearchPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<ResearchEntry[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [view, setView] = useState<"current" | "history">("current");
  const [sessions, setSessions] = useState<ResearchSession[]>([]);

  const loadSessions = useCallback(async () => {
    if (!analysisId) return;
    const { data } = await supabase
      .from("sidebar_chats")
      .select("*")
      .eq("analysis_id", analysisId)
      .like("chat_title", `${TITLE_PREFIX}%`)
      .order("updated_at", { ascending: false });
    setSessions(
      (data || []).map((d: any) => ({
        id: d.id,
        chat_title: (d.chat_title || "").replace(TITLE_PREFIX, ""),
        messages: Array.isArray(d.messages) ? d.messages : [],
        updated_at: d.updated_at,
      })),
    );
  }, [analysisId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const persist = async (newEntries: ResearchEntry[], firstQuery?: string) => {
    if (!analysisId) return;
    if (sessionId) {
      await supabase.from("sidebar_chats").update({
        messages: newEntries as any,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    } else {
      const title = (firstQuery || "Research").slice(0, 60);
      const { data } = await supabase.from("sidebar_chats").insert({
        analysis_id: analysisId,
        chat_title: TITLE_PREFIX + title,
        messages: newEntries as any,
      } as any).select().single();
      if (data) setSessionId(data.id);
    }
    loadSessions();
  };

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
      const entry: ResearchEntry = { query: q, results: items, timestamp: new Date().toISOString() };
      const updated = [...entries, entry];
      setEntries(updated);
      setQuery("");
      if (items.length === 0) toast.info("No results found.");
      await persist(updated, entries.length === 0 ? q : undefined);
    } catch (e: any) {
      toast.error(e?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyCitation = async (r: BraveResult, key: string) => {
    await navigator.clipboard.writeText(`${r.title}. ${r.url}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const newSession = () => {
    setEntries([]);
    setSessionId(null);
    setView("current");
  };

  const openSession = (s: ResearchSession) => {
    setEntries(s.messages);
    setSessionId(s.id);
    setView("current");
  };

  const deleteSession = async (id: string) => {
    await supabase.from("sidebar_chats").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (sessionId === id) newSession();
  };

  if (view === "history") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setView("current")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <h3 className="text-sm font-display font-semibold flex items-center gap-1.5">
              <History className="h-4 w-4 text-primary" />
              Research History
            </h3>
          </div>
        </div>
        <div className="space-y-1.5">
          {sessions.length === 0 && <p className="text-xs text-muted-foreground italic">No previous research sessions.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-muted/50 rounded p-2 cursor-pointer hover:bg-muted gap-2" onClick={() => openSession(s)}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{s.chat_title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.messages.length} search{s.messages.length !== 1 ? "es" : ""} · {new Date(s.updated_at).toLocaleString()}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Search className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Research</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={newSession} title="New session">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setView("history")} title="View history">
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Search the web with Brave. History is saved per house.
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

      {entries.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground italic">Results will appear here.</p>
      )}

      <div className="space-y-3">
        {entries.map((entry, ei) => (
          <div key={ei} className="space-y-1.5">
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
              <p className="text-[11px] font-medium text-foreground truncate">{entry.query}</p>
            </div>
            {entry.results.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic pl-4">No results.</p>
            )}
            {entry.results.map((r, i) => {
              const key = `${ei}-${i}`;
              return (
                <div key={key} className="bg-muted/40 border border-border rounded p-2 space-y-1">
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
                      onClick={() => copyCitation(r, key)}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      title="Copy citation"
                    >
                      {copiedKey === key ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === key ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {sessions.length > 0 && (
        <button onClick={() => setView("history")} className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center py-1">
          View {sessions.length} saved session{sessions.length !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
