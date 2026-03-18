import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X, Link2, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FactSource {
  title: string;
  url?: string;
}

export interface FactEntry {
  text: string;
  evidenceStrength: "very_strong" | "strong" | "moderate" | "weak" | "unsupported";
  sources: FactSource[];
}

interface EvidenceFactInputProps {
  items: FactEntry[];
  onChange: (items: FactEntry[]) => void;
  placeholder?: string;
  analysisContext?: string;
}

const strengthLabels: Record<string, string> = {
  very_strong: "Very Strong",
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  unsupported: "Unsupported",
};

const strengthColors: Record<string, string> = {
  very_strong: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  strong: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  moderate: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
  weak: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
  unsupported: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
};

const strengthDots: Record<string, string> = {
  very_strong: "bg-green-500",
  strong: "bg-green-400",
  moderate: "bg-yellow-500",
  weak: "bg-orange-500",
  unsupported: "bg-red-500",
};

export default function EvidenceFactInput({ items, onChange, placeholder = "Add a fact or piece of evidence...", analysisContext }: EvidenceFactInputProps) {
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [findingSourcesFor, setFindingSourcesFor] = useState<number | null>(null);
  const [ratingIndex, setRatingIndex] = useState<number | null>(null);

  const autoRateEvidence = async (factText: string, index: number, currentItems: FactEntry[]) => {
    setRatingIndex(index);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const ctx = analysisContext
        ? `Facts:\n${index}. "${factText}"\n\nContext: ${analysisContext}`
        : `Facts:\n${index}. "${factText}"`;

      const res = await supabase.functions.invoke("analyze-logic", {
        body: { mode: "rate_evidence", analysisContext: ctx },
      });

      if (res.error || !res.data?.ratings) return;

      const rating = res.data.ratings[0];
      if (rating?.rating) {
        const updated = currentItems.map((item, i) =>
          i === index ? { ...item, evidenceStrength: rating.rating as FactEntry["evidenceStrength"] } : item
        );
        onChange(updated);
      }
    } catch {
      // Silently fail - user can still manually rate
    } finally {
      setRatingIndex(null);
    }
  };

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    const newItems = [...items, { text: trimmed, evidenceStrength: "unsupported" as const, sources: [] }];
    onChange(newItems);
    setNewItem("");
    // Auto-rate in background
    autoRateEvidence(trimmed, newItems.length - 1, newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index].text);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      removeItem(editingIndex);
    } else {
      onChange(items.map((item, i) => (i === editingIndex ? { ...item, text: trimmed } : item)));
    }
    setEditingIndex(null);
    setEditValue("");
  };

  const cancelEdit = () => { setEditingIndex(null); setEditValue(""); };

  const updateStrength = (index: number, strength: string) => {
    onChange(items.map((item, i) => (i === index ? { ...item, evidenceStrength: strength as FactEntry["evidenceStrength"] } : item)));
  };

  const addSource = (index: number) => {
    if (!newSourceTitle.trim()) return;
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return { ...item, sources: [...item.sources, { title: newSourceTitle.trim(), url: newSourceUrl.trim() || undefined }] };
    });
    onChange(updated);
    setNewSourceTitle("");
    setNewSourceUrl("");
  };

  const removeSource = (factIndex: number, sourceIndex: number) => {
    onChange(items.map((item, i) => {
      if (i !== factIndex) return item;
      return { ...item, sources: item.sources.filter((_, si) => si !== sourceIndex) };
    }));
  };

  const findSources = async (index: number) => {
    setFindingSourcesFor(index);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const factText = items[index].text;
      const ctx = analysisContext ? `Fact: "${factText}"\n\nContext: ${analysisContext}` : `Fact: "${factText}"`;

      const res = await supabase.functions.invoke("analyze-logic", {
        body: { mode: "find_sources", analysisContext: ctx },
      });

      if (res.error) throw new Error(res.error.message);

      const sources = res.data?.suggested_sources || [];
      if (sources.length > 0) {
        toast.success(`Found ${sources.length} source suggestions`);
        // Add suggested sources
        onChange(items.map((item, i) => {
          if (i !== index) return item;
          const newSources = sources.map((s: any) => ({ title: `${s.title} (${s.type})`, url: undefined }));
          return { ...item, sources: [...item.sources, ...newSources] };
        }));
        setExpandedIndex(index);
      } else {
        toast.info("No sources found");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to find sources");
    } finally {
      setFindingSourcesFor(null);
    }
  };

  const rateAllEvidence = async () => {
    if (items.length === 0) return;
    setRatingIndex(-1); // -1 means rating all
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const factsText = items.map((item, i) => `${i}. "${item.text}"`).join("\n");
      const ctx = analysisContext ? `Facts:\n${factsText}\n\nContext: ${analysisContext}` : `Facts:\n${factsText}`;

      const res = await supabase.functions.invoke("analyze-logic", {
        body: { mode: "rate_evidence", analysisContext: ctx },
      });

      if (res.error) throw new Error(res.error.message);
      const ratings = res.data?.ratings || [];
      if (ratings.length > 0) {
        const updated = items.map((item, i) => {
          const rating = ratings.find((r: any) => r.index === i);
          return rating ? { ...item, evidenceStrength: rating.rating as FactEntry["evidenceStrength"] } : item;
        });
        onChange(updated);
        toast.success("Evidence ratings updated");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to rate evidence");
    } finally {
      setRatingIndex(null);
    }
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={rateAllEvidence} disabled={ratingIndex !== null}>
              {ratingIndex === -1 ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Search className="h-2.5 w-2.5" />}
              Rate All Evidence
            </Button>
          </div>
          <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="border border-border rounded-lg p-2 space-y-1.5 bg-card/50">
              {/* Fact text */}
              <div className="flex items-start gap-2 group">
                {ratingIndex === index ? (
                  <Loader2 className="w-3 h-3 mt-1.5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${strengthDots[item.evidenceStrength]}`} />
                )}
                {editingIndex === index ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                      autoFocus className="h-7 text-sm bg-card" />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={saveEdit}><Check className="h-3 w-3 text-primary" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cancelEdit}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-foreground leading-relaxed">{item.text}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(index)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(index)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </>
                )}
              </div>

              {/* Evidence strength + expand */}
              <div className="flex items-center gap-2 pl-4">
                <Select value={item.evidenceStrength} onValueChange={(v) => updateStrength(index, v)}>
                  <SelectTrigger className={`h-6 text-[10px] w-auto min-w-[100px] border ${strengthColors[item.evidenceStrength]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="very_strong">🟢 Very Strong</SelectItem>
                    <SelectItem value="strong">🟢 Strong</SelectItem>
                    <SelectItem value="moderate">🟡 Moderate</SelectItem>
                    <SelectItem value="weak">🟠 Weak</SelectItem>
                    <SelectItem value="unsupported">🔴 Unsupported</SelectItem>
                  </SelectContent>
                </Select>

                {item.sources.length > 0 && (
                  <Badge variant="outline" className="text-[9px] h-5 gap-0.5">
                    <Link2 className="h-2.5 w-2.5" />{item.sources.length} source{item.sources.length > 1 ? "s" : ""}
                  </Badge>
                )}

                <button onClick={() => setExpandedIndex(expandedIndex === index ? null : index)} className="text-muted-foreground hover:text-foreground ml-auto">
                  {expandedIndex === index ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Expanded: Sources */}
              {expandedIndex === index && (
                <div className="pl-4 space-y-1.5 border-t border-border/50 pt-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground">Sources</p>

                  {item.sources.map((source, si) => (
                    <div key={si} className="flex items-center gap-1.5 text-[10px] group/source">
                      <Link2 className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-foreground">{source.title}</span>
                        {source.url && (
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline truncate">{source.url}</a>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/source:opacity-100 text-destructive shrink-0" onClick={() => removeSource(index, si)}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}

                  {/* Add source */}
                  <div className="space-y-1">
                    <Input value={newSourceTitle} onChange={(e) => setNewSourceTitle(e.target.value)} placeholder="Source title..." className="h-6 text-[10px] bg-card" />
                    <div className="flex gap-1">
                      <Input value={newSourceUrl} onChange={(e) => setNewSourceUrl(e.target.value)} placeholder="URL (optional)" className="h-6 text-[10px] bg-card" />
                      <Button size="sm" variant="outline" className="h-6 text-[10px] shrink-0 gap-0.5" onClick={() => addSource(index)} disabled={!newSourceTitle.trim()}>
                        <Plus className="h-2.5 w-2.5" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* AI find sources */}
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 w-full" onClick={() => findSources(index)} disabled={findingSourcesFor === index}>
                    {findingSourcesFor === index ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Search className="h-2.5 w-2.5" />}
                    Find Supporting Sources
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder={placeholder} className="h-8 text-sm bg-card" />
        <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1" onClick={addItem} disabled={!newItem.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
