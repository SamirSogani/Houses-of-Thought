import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Check, X, GraduationCap, BookOpen, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/lib/permissions";

const RECAPTCHA_SITE_KEY = "6Lc04ZYsAAAAAFnj1YpUnZczombrN9FjB24QJjdD";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character (!@#$%...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const MIN_AGE = 12;

declare global {
  interface Window {
    onRecaptchaLoad?: () => void;
    grecaptcha: {
      render: (container: string | HTMLElement, params: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void }) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [accountType, setAccountType] = useState<AccountType>("standard");
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaWidgetId = useRef<number | null>(null);
  const recaptchaRendered = useRef(false);

  const usernameTrimmed = username.trim();
  const usernameValid =
    usernameTrimmed.length >= 3 &&
    usernameTrimmed.length <= 30 &&
    /^[A-Za-z0-9_.-]+$/.test(usernameTrimmed);

  const passwordStrength = useMemo(() => PASSWORD_RULES.map(r => r.test(password)), [password]);
  const allPasswordRulesMet = passwordStrength.every(Boolean);

  const isTooYoung = birthDate ? differenceInYears(new Date(), birthDate) < MIN_AGE : false;

  const renderRecaptcha = useCallback(() => {
    if (
      recaptchaRendered.current ||
      !recaptchaContainerRef.current ||
      !window.grecaptcha?.render
    ) return;
    recaptchaRendered.current = true;
    recaptchaWidgetId.current = window.grecaptcha.render(recaptchaContainerRef.current, {
      sitekey: RECAPTCHA_SITE_KEY,
      callback: (token: string) => setRecaptchaToken(token),
      "expired-callback": () => setRecaptchaToken(null),
    });
  }, []);

  // Load reCAPTCHA v2 script
  useEffect(() => {
    if (isLogin) return;

    recaptchaRendered.current = false;
    setRecaptchaToken(null);

    // If script already loaded, just render
    if (window.grecaptcha?.render) {
      // Small delay to ensure DOM is ready
      setTimeout(renderRecaptcha, 100);
      return;
    }

    window.onRecaptchaLoad = () => {
      renderRecaptcha();
    };

    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup to avoid reload issues
    };
  }, [isLogin, renderRecaptcha]);

  // Re-render captcha when switching to signup mode
  useEffect(() => {
    if (!isLogin && window.grecaptcha?.render) {
      recaptchaRendered.current = false;
      setTimeout(renderRecaptcha, 100);
    }
  }, [isLogin, renderRecaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && (!termsAccepted || !privacyAccepted)) {
      toast.error("You must accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }
    if (!isLogin && !allPasswordRulesMet) {
      toast.error("Password does not meet all strength requirements.");
      return;
    }
    if (!isLogin && !usernameValid) {
      toast.error("Username must be 3–30 characters and only contain letters, numbers, underscore, dot, or dash.");
      return;
    }
    if (!isLogin && !birthDate) {
      toast.error("Please enter your date of birth.");
      return;
    }
    if (!isLogin && isTooYoung) {
      toast.error(`You must be at least ${MIN_AGE} years old to create an account.`);
      return;
    }

    setLoading(true);

    // Verify reCAPTCHA v2 server-side for signup
    if (!isLogin) {
      if (!recaptchaToken) {
        toast.error("Please complete the reCAPTCHA checkbox.");
        setLoading(false);
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke("verify-recaptcha", {
          body: { token: recaptchaToken },
        });
        if (fnError || !data?.success) {
          toast.error("reCAPTCHA verification failed. Please try again.");
          setLoading(false);
          // Reset captcha
          if (recaptchaWidgetId.current !== null && window.grecaptcha?.reset) {
            window.grecaptcha.reset(recaptchaWidgetId.current);
          }
          setRecaptchaToken(null);
          return;
        }
      } catch {
        toast.error("Verification failed. Please try again.");
        setLoading(false);
        return;
      }
    }

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, usernameTrimmed);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      // Reset captcha on error
      if (!isLogin && recaptchaWidgetId.current !== null && window.grecaptcha?.reset) {
        window.grecaptcha.reset(recaptchaWidgetId.current);
        setRecaptchaToken(null);
      }
    } else if (!isLogin) {
      // Persist account type + ensure username is saved (trigger also does this,
      // but upsert here covers the case where the row already existed).
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase
          .from("profiles")
          .upsert(
            {
              user_id: newUser.id,
              username: usernameTrimmed,
              ...(accountType !== "standard" ? { account_type: accountType } : {}),
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "user_id" }
          );
      }
      toast.success("Account created! Please check your email to verify your account before signing in.");
    }
  };

  const canSubmitSignup = termsAccepted && privacyAccepted && allPasswordRulesMet && usernameValid && !!birthDate && !isTooYoung && !!recaptchaToken;

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    if (!isLogin && (!termsAccepted || !privacyAccepted)) {
      toast.error("You must accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || `${provider} sign-in failed.`);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${provider} sign-in failed.`;
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </button>
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto">
              <path d="M24 4L4 20H10V40H18V28H30V40H38V20H44L24 4Z" 
                stroke="currentColor" strokeWidth="2" fill="hsl(var(--primary) / 0.1)" className="text-primary"/>
            </svg>
          </div>
          <CardTitle className="text-2xl font-display">Houses of Thought</CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to your thinking space" : "Create your thinking space"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alex_miller"
                  required
                  minLength={3}
                  maxLength={30}
                  autoComplete="username"
                />
                <p className="text-[11px] text-muted-foreground">
                  3–30 characters. Letters, numbers, underscore, dot, or dash. Shown to your teacher and classmates.
                </p>
                {username.length > 0 && !usernameValid && (
                  <p className="text-xs text-destructive">
                    Username must be 3–30 characters and only contain letters, numbers, underscore, dot, or dash.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              {!isLogin && password.length > 0 && (
                <div className="space-y-1 pt-1">
                  {PASSWORD_RULES.map((rule, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      {passwordStrength[i] ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-destructive" />
                      )}
                      <span className={passwordStrength[i] ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !birthDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {birthDate ? format(birthDate, "PPP") : <span>Select your date of birth</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={birthDate}
                        onSelect={setBirthDate}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={1900}
                        toYear={new Date().getFullYear()}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  {isTooYoung && (
                    <p className="text-xs text-destructive">
                      You must be at least {MIN_AGE} years old to create an account.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>What best describes you?</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { type: "standard" as AccountType, label: "Standard", icon: UserIcon },
                      { type: "student" as AccountType, label: "Student", icon: GraduationCap },
                      { type: "teacher" as AccountType, label: "Teacher", icon: BookOpen },
                    ].map(({ type, label, icon: Icon }) => {
                      const active = accountType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setAccountType(type)}
                          className={cn(
                            "rounded-lg border px-2 py-2 text-xs font-medium transition-colors flex flex-col items-center gap-1",
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-card text-foreground hover:bg-muted/50"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    You can change this later in your profile settings.
                  </p>
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(v) => setTermsAccepted(v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                      I have read and agree to the{" "}
                      <Link to="/terms?from=signup" className="text-primary hover:underline underline-offset-4" target="_blank">
                        Terms of Service
                      </Link>
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="privacy"
                      checked={privacyAccepted}
                      onCheckedChange={(v) => setPrivacyAccepted(v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="privacy" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                      I have read and agree to the{" "}
                      <Link to="/privacy?from=signup" className="text-primary hover:underline underline-offset-4" target="_blank">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                </div>
                <div className="flex justify-center pt-2">
                  <div ref={recaptchaContainerRef}></div>
                </div>
              </>
            )}
            <Button type="submit" className="w-full" disabled={loading || (!isLogin && !canSubmitSignup)}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn("google")}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn("apple")}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </Button>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
    <SiteFooter />
    </div>
  );
}
