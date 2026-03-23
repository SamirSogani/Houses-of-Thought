import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const RECAPTCHA_SITE_KEY = "6Lf-QJQsAAAAAJo_8oG0nAuAqO0oNMgyj91oL4-p";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character (!@#$%...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

declare global {
  interface Window {
    grecaptcha: {
      render: (container: HTMLElement, params: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; theme?: string }) => number;
      reset: (widgetId: number) => void;
    };
    onRecaptchaLoad: () => void;
  }
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const recaptchaReadyRef = useRef(false);

  const passwordStrength = useMemo(() => PASSWORD_RULES.map(r => r.test(password)), [password]);
  const allPasswordRulesMet = passwordStrength.every(Boolean);

  const renderRecaptcha = useCallback(() => {
    if (recaptchaRef.current && window.grecaptcha && widgetIdRef.current === null) {
      widgetIdRef.current = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => setRecaptchaToken(token),
        "expired-callback": () => setRecaptchaToken(null),
        theme: "light",
      });
    }
  }, []);

  useEffect(() => {
    // Load reCAPTCHA script if not already loaded
    if (!document.getElementById("recaptcha-script")) {
      window.onRecaptchaLoad = () => {
        recaptchaReadyRef.current = true;
        if (!isLogin) renderRecaptcha();
      };
      const script = document.createElement("script");
      script.id = "recaptcha-script";
      script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.grecaptcha) {
      recaptchaReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isLogin && recaptchaReadyRef.current) {
      // Small delay to ensure the DOM element is mounted
      const timer = setTimeout(() => renderRecaptcha(), 100);
      return () => clearTimeout(timer);
    }
    if (isLogin) {
      // Reset when switching to login
      widgetIdRef.current = null;
      setRecaptchaToken(null);
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
    if (!isLogin && !recaptchaToken) {
      toast.error("Please complete the CAPTCHA verification.");
      return;
    }

    setLoading(true);

    // Verify reCAPTCHA server-side for signup
    if (!isLogin) {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("verify-recaptcha", {
          body: { token: recaptchaToken },
        });
        if (fnError || !data?.success) {
          toast.error("CAPTCHA verification failed. Please try again.");
          setRecaptchaToken(null);
          if (widgetIdRef.current !== null && window.grecaptcha) {
            window.grecaptcha.reset(widgetIdRef.current);
          }
          setLoading(false);
          return;
        }
      } catch {
        toast.error("CAPTCHA verification failed. Please try again.");
        setLoading(false);
        return;
      }
    }

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      // Reset captcha on error
      if (!isLogin && widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
        setRecaptchaToken(null);
      }
    } else if (!isLogin) {
      toast.success("Account created! Please check your email to verify your account before signing in.");
    }
  };

  const canSubmitSignup = termsAccepted && privacyAccepted && allPasswordRulesMet && !!recaptchaToken;

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
                {/* reCAPTCHA widget */}
                <div className="flex justify-center pt-1">
                  <div ref={recaptchaRef}></div>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || (!isLogin && !canSubmitSignup)}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
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
