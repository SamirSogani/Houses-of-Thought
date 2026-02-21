import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LogOut, Home, Settings } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Analysis = Tables<"analyses">;

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyses();
  }, []);

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
    if (error) {
      toast.error(error.message);
    } else if (data) {
      navigate(`/analysis/${data.id}`);
    }
  };

  const deleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setAnalyses((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Home className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-display font-bold text-foreground">House of Reason</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
              <Settings className="h-4 w-4 mr-1" /> Profile
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Your Analyses</h2>
            <p className="text-muted-foreground mt-1">Build and explore your Houses of Reason</p>
          </div>
          <Button onClick={createNewAnalysis}>
            <Plus className="h-4 w-4 mr-2" /> New Analysis
          </Button>
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
              <p className="text-muted-foreground mb-4">Create your first House of Reason to start thinking critically.</p>
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
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/30 animate-fade-in group"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => navigate(`/analysis/${a.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-display truncate">{a.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground truncate mb-3">
                    {a.overarching_question || "No question set yet"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={(e) => deleteAnalysis(a.id, e)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
