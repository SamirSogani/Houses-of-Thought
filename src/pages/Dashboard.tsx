import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Plus, MoreVertical, Pencil, Share2, Trash2, Globe, Lock, AlertCircle } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import AppNavbar from "@/components/layout/AppNavbar";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { consumePendingImport, importDemoToAccount, clearDemo } from "@/lib/demoSession";

type Analysis = Tables<"analyses">;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);

  useEffect(() => {
    (async () => {
      // If returning from demo signup, import the staged session into a real analysis
      const pending = consumePendingImport();
      if (pending && user) {
        const newId = await importDemoToAccount(pending);
        if (newId) {
          clearDemo();
          toast.success("Your demo House was saved to your account.");
          navigate(`/analysis/${newId}`);
          return;
        } else {
          toast.error("Could not import your demo House — please try again from the analysis page.");
        }
      }
      fetchAnalyses();
      fetchProfile();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    setProfile(data || null);
  };

  const fetchAnalyses = async () => {
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAnalyses(data || []);
    setLoading(false);
  };

  const createNewAnalysis = async () => {
    const { data, error } = await supabase
      .from("analyses")
      .insert({ title: "Untitled Analysis" })
      .select()
      .single();
    if (error) toast.error(error.message);
    else if (data) navigate(`/analysis/${data.id}`);
  };

  const deleteAnalysis = async (id: string) => {
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setAnalyses((prev) => prev.filter((a) => a.id !== id));
  };

  const renameAnalysis = async (id: string) => {
    if (!renameValue.trim()) return;
    await supabase.from("analyses").update({ title: renameValue.trim(), updated_at: new Date().toISOString() }).eq("id", id);
    setAnalyses((prev) => prev.map((a) => (a.id === id ? { ...a, title: renameValue.trim() } : a)));
    setRenamingId(null);
    toast.success("Renamed");
  };

  const togglePublic = async (a: Analysis) => {
    const newVal = !a.is_public;
    await supabase.from("analyses").update({ is_public: newVal, updated_at: new Date().toISOString() }).eq("id", a.id);
    setAnalyses((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_public: newVal } : x)));
    toast.success(newVal ? "Analysis is now public" : "Analysis is now private");
  };

  const copyShareLink = (id: string) => {
    const url = `${window.location.origin}/public/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied!");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {profile && !(profile as any).username && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Add a username so teachers and classmates can recognize you.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Without one, you'll appear in classroom rosters as an anonymous ID.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/profile")}>
              Set username
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Your Analyses</h2>
            <p className="text-muted-foreground mt-1">Build and explore your Houses of Thought</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-6 bg-muted rounded w-3/4" /></CardHeader>
                <CardContent><div className="h-4 bg-muted rounded w-1/2" /></CardContent>
              </Card>
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <Card className="text-center py-16 animate-fade-in">
            <CardContent>
              <svg width="64" height="64" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
                <path d="M24 4L4 20H10V40H18V28H30V40H38V20H44L24 4Z"
                  stroke="currentColor" strokeWidth="1.5" fill="hsl(var(--primary) / 0.08)" className="text-muted-foreground" />
              </svg>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">No analyses yet</h3>
              <p className="text-muted-foreground mb-4">Create your first Houses of Thought to start thinking critically.</p>
              <Button onClick={createNewAnalysis}>
                <Plus className="h-4 w-4 mr-2" /> Create First Analysis
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyses.map((a, i) => (

              <Card
                key={a.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/30 animate-fade-in group relative"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => navigate(`/analysis/${a.id}`)}
              >
                {/* Three-dot menu */}
                <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setRenamingId(a.id); setRenameValue(a.title); }}>
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => togglePublic(a)}>
                        {a.is_public ? <Lock className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                        {a.is_public ? "Make Private" : "Make Public"}
                      </DropdownMenuItem>
                      {a.is_public && (
                        <DropdownMenuItem onClick={() => copyShareLink(a.id)}>
                          <Share2 className="h-4 w-4 mr-2" /> Copy Share Link
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteAnalysis(a.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CardHeader className="pb-2">
                  {renamingId === a.id ? (
                    <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameAnalysis(a.id)}
                        onKeyDown={(e) => e.key === "Enter" && renameAnalysis(a.id)}
                        autoFocus
                        className="text-sm"
                      />
                    </div>
                  ) : (
                    <CardTitle className="text-lg font-display truncate pr-8">{a.title}</CardTitle>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground truncate mb-3">
                    {a.overarching_question || "No question set yet"}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </span>
                    {a.is_public && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Public</span>
                    )}
                  </div>
                  {a.is_public && (
                    <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={`${window.location.origin}/public/${a.id}`}
                          className="text-xs h-7 bg-muted/50 cursor-text"
                          onFocus={(e) => e.target.select()}
                        />
                        <Button variant="outline" size="sm" className="h-7 px-2 shrink-0" onClick={() => copyShareLink(a.id)}>
                          <Share2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Create New House Card */}
            <Card
              className="cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:shadow-lg transition-all duration-200 flex items-center justify-center min-h-[180px] group"
              onClick={createNewAnalysis}
            >
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 rounded-full bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center mb-3 transition-colors">
                  <Plus className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-display font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Create New House</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
