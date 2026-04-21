import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, GraduationCap } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import { useClassrooms } from "@/hooks/useClassrooms";
import ClassroomCard from "@/components/classroom/ClassroomCard";
import CreateClassroomDialog from "@/components/classroom/CreateClassroomDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { usePermissions } from "@/hooks/usePermissions";

export default function TeacherClassroomsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { classrooms, counts, loading, createClassroom } = useClassrooms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { permissions } = usePermissions(profile);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(data || null);
      setProfileLoaded(true);
    })();
  }, [user]);

  // Route guard: students (or anyone without classroom-creation rights) go back to dashboard.
  useEffect(() => {
    if (!profileLoaded) return;
    if (!permissions.canCreateClassrooms) navigate("/dashboard", { replace: true });
  }, [profileLoaded, permissions.canCreateClassrooms, navigate]);

  if (!profileLoaded || !permissions.canCreateClassrooms) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-display font-bold text-foreground">Classrooms</h1>
            </div>
          </div>
          {permissions.canCreateClassrooms && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Classroom
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse h-40" />
            ))}
          </div>
        ) : classrooms.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-display font-semibold mb-2">No classrooms yet</h3>
              <p className="text-muted-foreground mb-4">Create your first classroom to invite students.</p>
              {permissions.canCreateClassrooms && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create First Classroom
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((c) => (
              <ClassroomCard
                key={c.id}
                classroom={c}
                studentCount={counts[c.id] || 0}
                onOpen={() => navigate(`/classrooms/${c.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      <CreateClassroomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={async (name, cap) => await createClassroom(name, cap)}
      />

      <SiteFooter />
    </div>
  );
}
