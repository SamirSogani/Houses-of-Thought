import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteFooter from "@/components/layout/SiteFooter";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, Loader2, AlertCircle, GraduationCap, BookOpen, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import DeleteAccountSection from "@/components/ai/DeleteAccountSection";
import { ACCOUNT_TYPE_DESCRIPTIONS, type AccountType } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ACCOUNT_LABEL: Record<AccountType, string> = {
  standard: "Standard",
  student: "Student",
  teacher: "Teacher",
};

const ACCOUNT_OPTIONS: { type: AccountType; label: string; icon: typeof UserIcon }[] = [
  { type: "standard", label: "Standard", icon: UserIcon },
  { type: "student", label: "Student", icon: GraduationCap },
  { type: "teacher", label: "Teacher", icon: BookOpen },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [biological, setBiological] = useState("");
  const [social, setSocial] = useState("");
  const [familial, setFamilial] = useState("");
  const [individual, setIndividual] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [locationContext, setLocationContext] = useState("");
  const [currentProject, setCurrentProject] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("standard");
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<SaveStatus>("idle");
  const [usernameError, setUsernameError] = useState<string>("");
  const [savingAccountType, setSavingAccountType] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Confirmation dialog state for switching account types
  const [pendingType, setPendingType] = useState<AccountType | null>(null);
  const [switchCounts, setSwitchCounts] = useState<{ analyses: number; classroomsOwned: number; memberships: number } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const isLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data) {
      setBiological(data.biological);
      setSocial(data.social);
      setFamilial(data.familial);
      setIndividual(data.individual);
      setAboutMe((data as any).about_me || "");
      setRoleTitle((data as any).role_title || "");
      setLocationContext((data as any).location_context || "");
      setCurrentProject((data as any).current_project || "");
      setUsername((data as any).username || "");
      setSavedUsername((data as any).username || "");
      const t = (data as any).account_type;
      if (t === "student" || t === "teacher" || t === "standard") setAccountType(t);
    }
    // Allow auto-save to run only after the initial load is finished.
    isLoadedRef.current = true;
  };

  // User clicked an account-type button — open the confirmation dialog and
  // load live counts of what's about to be hidden in the CURRENT workspace.
  const requestAccountTypeChange = async (newType: AccountType) => {
    if (newType === accountType || savingAccountType) return;
    setPendingType(newType);
    setSwitchCounts(null);
    setLoadingCounts(true);
    try {
      const [analysesRes, classroomsRes, membersRes] = await Promise.all([
        supabase.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("classrooms").select("id", { count: "exact", head: true }).eq("teacher_id", user!.id),
        supabase.from("classroom_members").select("id", { count: "exact", head: true }).eq("student_id", user!.id),
      ]);
      setSwitchCounts({
        analyses: analysesRes.count ?? 0,
        classroomsOwned: classroomsRes.count ?? 0,
        memberships: membersRes.count ?? 0,
      });
    } finally {
      setLoadingCounts(false);
    }
  };

  const confirmAccountTypeChange = async () => {
    if (!pendingType) return;
    const newType = pendingType;
    setSavingAccountType(true);
    // Account type changes go through a SECURITY DEFINER RPC so users can't
    // self-promote by writing the column directly (RLS now blocks that).
    const { data, error } = await supabase.rpc("set_account_type" as any, {
      p_new_type: newType,
    });
    setSavingAccountType(false);
    setPendingType(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data && (data as any).ok === false) {
      toast.error((data as any).error ?? "Could not switch account type.");
      return;
    }
    setAccountType(newType);
    toast.success(`Switched to ${ACCOUNT_LABEL[newType]}. Your ${ACCOUNT_LABEL[accountType]} workspace is preserved.`);
    // Hard reset to the dashboard so no stale analysis from the prior workspace lingers.
    navigate("/dashboard");
  };

  // Auto-save the eight free-text fields (debounced 500ms) using upsert so
  // it works even if the profile row is missing.
  useEffect(() => {
    if (!user || !isLoadedRef.current) return;
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            biological, social, familial, individual,
            about_me: aboutMe, role_title: roleTitle,
            location_context: locationContext, current_project: currentProject,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id" }
        );
      if (error) {
        setSaveStatus("error");
        toast.error(error.message);
      } else {
        setSaveStatus("saved");
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biological, social, familial, individual, aboutMe, roleTitle, locationContext, currentProject]);

  // Username auto-save (separate because it can fail with uniqueness / format errors)
  useEffect(() => {
    if (!user || !isLoadedRef.current) return;
    const trimmed = username.trim();
    if (trimmed === savedUsername) {
      setUsernameStatus("idle");
      setUsernameError("");
      return;
    }

    // Client-side validation
    if (trimmed.length === 0) {
      setUsernameStatus("error");
      setUsernameError("Username is required.");
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 30) {
      setUsernameStatus("error");
      setUsernameError("Username must be 3–30 characters.");
      return;
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(trimmed)) {
      setUsernameStatus("error");
      setUsernameError("Only letters, numbers, underscore, dot, and dash are allowed.");
      return;
    }

    setUsernameStatus("saving");
    setUsernameError("");
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    usernameTimerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { user_id: user.id, username: trimmed, updated_at: new Date().toISOString() } as any,
          { onConflict: "user_id" }
        );
      if (error) {
        setUsernameStatus("error");
        const msg = /duplicate key|unique/i.test(error.message)
          ? "That username is already taken."
          : error.message;
        setUsernameError(msg);
      } else {
        setSavedUsername(trimmed);
        setUsernameStatus("saved");
      }
    }, 600);

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const statusLabel = () => {
    switch (saveStatus) {
      case "saving": return (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>);
      case "saved":  return (<><Check className="h-3.5 w-3.5 text-primary" /> Saved</>);
      case "error":  return (<><AlertCircle className="h-3.5 w-3.5 text-destructive" /> Save failed — retry</>);
      default:       return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <span>/</span>
          <span className="text-foreground">Profile</span>
        </div>

        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-3xl font-display font-bold">Your Profile</h1>
          {saveStatus !== "idle" && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs rounded-full border px-2 py-0.5",
                saveStatus === "error"
                  ? "border-destructive/40 text-destructive bg-destructive/5"
                  : "border-border text-muted-foreground bg-muted/30"
              )}
            >
              {statusLabel()}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mb-8">Personal information and foundational perspective. Changes save automatically.</p>

        {/* Username section */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2 flex-wrap">
              Username
              {usernameStatus !== "idle" && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs rounded-full border px-2 py-0.5 font-normal",
                    usernameStatus === "error"
                      ? "border-destructive/40 text-destructive bg-destructive/5"
                      : "border-border text-muted-foreground bg-muted/30"
                  )}
                >
                  {usernameStatus === "saving" && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>)}
                  {usernameStatus === "saved" && (<><Check className="h-3.5 w-3.5 text-primary" /> Saved</>)}
                  {usernameStatus === "error" && (<><AlertCircle className="h-3.5 w-3.5" /> Not saved</>)}
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              How teachers and classmates see you in classrooms. 3–30 characters: letters, numbers, underscore, dot, or dash.
            </p>
          </CardHeader>
          <CardContent>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alex_miller"
              maxLength={30}
              className="bg-card"
              autoComplete="username"
            />
            {usernameError && (
              <p className="text-xs text-destructive mt-2">{usernameError}</p>
            )}
          </CardContent>
        </Card>

        {/* Account Type section */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display">Account Type</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose the experience that matches you. You can change this anytime.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ACCOUNT_OPTIONS.map(({ type, label, icon: Icon }) => {
                const active = accountType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={savingAccountType}
                    onClick={() => requestAccountTypeChange(type)}
                    className={cn(
                      "text-left rounded-lg border p-3 transition-colors flex flex-col gap-1.5 disabled:opacity-60",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>
                        {label}
                      </span>
                      {active && <span className="ml-auto text-[10px] uppercase tracking-wide text-primary font-semibold">Active</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {ACCOUNT_TYPE_DESCRIPTIONS[type]}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* About section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">About Me</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={aboutMe} onChange={(e) => setAboutMe(e.target.value)} placeholder="Tell us about yourself..." className="min-h-[80px] bg-card" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Current Project</CardTitle>
            </CardHeader>
            <CardContent>
              <Input value={currentProject} onChange={(e) => setCurrentProject(e.target.value)} placeholder="What are you working on?" className="bg-card" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Role</CardTitle>
            </CardHeader>
            <CardContent>
              <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Student, Researcher, Analyst..." className="bg-card" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Location / Context</CardTitle>
            </CardHeader>
            <CardContent>
              <Input value={locationContext} onChange={(e) => setLocationContext(e.target.value)} placeholder="San Francisco, CA" className="bg-card" />
            </CardContent>
          </Card>
        </div>

        {/* Foundation section */}
        <h2 className="text-2xl font-display font-bold mb-2">Personal Foundational Point of View</h2>
        <p className="text-muted-foreground mb-6">Element 4.2 — These perspectives persist across all your analyses.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: "Biological", value: biological, set: setBiological, desc: "Your biological influences, instincts, and physical perspective" },
            { label: "Social", value: social, set: setSocial, desc: "Your social context, cultural background, and community influences" },
            { label: "Familial", value: familial, set: setFamilial, desc: "Your family upbringing, traditions, and familial values" },
            { label: "Individual", value: individual, set: setIndividual, desc: "Your unique personal experiences, beliefs, and individual identity" },
          ].map((item) => (
            <Card key={item.label} className="house-zone house-zone-foundation">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-display">{item.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={item.value}
                  onChange={(e) => item.set(e.target.value)}
                  placeholder={`Describe your ${item.label.toLowerCase()} perspective...`}
                  className="min-h-[120px] bg-card"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12">
          <DeleteAccountSection />
        </div>
      </div>
      <SiteFooter />

      <AlertDialog open={pendingType !== null} onOpenChange={(open) => { if (!open) setPendingType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch to {pendingType ? ACCOUNT_LABEL[pendingType] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Your <strong>{ACCOUNT_LABEL[accountType]}</strong> workspace will be hidden, including:
                </p>
                {loadingCounts || !switchCounts ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking what will be hidden…
                  </p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>{switchCounts.analyses} {switchCounts.analyses === 1 ? "house" : "houses"} you've created</li>
                    {switchCounts.classroomsOwned > 0 && (
                      <li>{switchCounts.classroomsOwned} classroom{switchCounts.classroomsOwned === 1 ? "" : "s"} you own</li>
                    )}
                    {switchCounts.memberships > 0 && (
                      <li>{switchCounts.memberships} classroom membership{switchCounts.memberships === 1 ? "" : "s"}</li>
                    )}
                    <li>any open analysis you have right now</li>
                  </ul>
                )}
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Nothing is deleted.</strong> Switching back to {ACCOUNT_LABEL[accountType]} will restore everything.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAccountType}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAccountTypeChange} disabled={savingAccountType || loadingCounts}>
              {savingAccountType ? (<><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Switching…</>) : `Switch to ${pendingType ? ACCOUNT_LABEL[pendingType] : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
