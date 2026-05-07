import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useUnreadComments } from "@/hooks/useUnreadComments";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Home,
  BookOpen,
  Sparkles,
  Info,
  MessageCircle,
  Settings,
  LogOut,
  GraduationCap,
  LogIn,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppNavbarProps {
  /** When true, suppresses the dashboard "Home" anchor (useful on the dashboard itself). */
  showHomeIcon?: boolean;
}

/**
 * Shared top-of-screen application navbar.
 * Used across Dashboard, Framework, Features, About, and Contact pages
 * to provide consistent in-app navigation.
 */
export default function AppNavbar({ showHomeIcon = true }: AppNavbarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const { permissions } = usePermissions(profile);
  const { total: unreadComments } = useUnreadComments();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data || null));
  }, [user]);

  const navLinks = [
    { to: "/features", label: "Features", icon: Sparkles },
    { to: "/about", label: "About", icon: Info },
    { to: "/framework", label: "Framework", icon: BookOpen },
    { to: "/contact", label: "Contact", icon: MessageCircle },
  ];

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Brand */}
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 shrink-0"
        >
          {showHomeIcon ? (
            <Home className="h-5 w-5 text-primary" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 4L4 20H10V40H18V28H30V40H38V20H44L24 4Z"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                fill="hsl(var(--primary) / 0.1)"
              />
            </svg>
          )}
          <span className="text-lg sm:text-xl font-display font-bold text-foreground">
            Houses of Thought
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Button
              key={l.to}
              variant="ghost"
              size="sm"
              onClick={() => navigate(l.to)}
              className={cn(
                "text-sm",
                isActive(l.to) && "bg-primary/10 text-primary hover:bg-primary/15"
              )}
            >
              <l.icon className="h-4 w-4 mr-1.5" />
              {l.label}
            </Button>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="hidden md:flex items-center gap-1">
          {user ? (
            <>
              {(permissions.canCreateClassrooms || permissions.canJoinClassroom) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  onClick={() =>
                    navigate(permissions.canCreateClassrooms ? "/classrooms" : "/classroom")
                  }
                >
                  <GraduationCap className="h-4 w-4 sm:mr-1" />
                  <span className="hidden lg:inline">Classrooms</span>
                  {unreadComments > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                      {unreadComments > 99 ? "99+" : unreadComments}
                    </span>
                  )}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
                <Settings className="h-4 w-4 lg:mr-1" />
                <span className="hidden lg:inline">Profile</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
              >
                <LogOut className="h-4 w-4 lg:mr-1" />
                <span className="hidden lg:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                <LogIn className="h-4 w-4 mr-1" />
                Log In
              </Button>
              <Button size="sm" onClick={() => navigate("/auth?mode=signup")}>
                Create Account
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-muted-foreground"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            {navLinks.map((l) => (
              <button
                key={l.to}
                onClick={() => {
                  setMobileOpen(false);
                  navigate(l.to);
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(l.to)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </button>
            ))}
            <div className="pt-2 mt-2 border-t border-border flex flex-col gap-2">
              {user ? (
                <>
                  {(permissions.canCreateClassrooms || permissions.canJoinClassroom) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMobileOpen(false);
                        navigate(
                          permissions.canCreateClassrooms ? "/classrooms" : "/classroom"
                        );
                      }}
                    >
                      <GraduationCap className="h-4 w-4 mr-2" /> Classrooms
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate("/profile");
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" /> Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setMobileOpen(false);
                      await signOut();
                      navigate("/");
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate("/auth");
                    }}
                  >
                    Log In
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate("/auth?mode=signup");
                    }}
                  >
                    Create Account
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
