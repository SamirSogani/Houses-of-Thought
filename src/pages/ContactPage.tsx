import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SiteNavbar from "@/components/layout/SiteNavbar";
import SiteFooter from "@/components/layout/SiteFooter";
import { Send, Bug, Lightbulb, HelpCircle } from "lucide-react";

const userTypes = ["Free", "Student", "Teacher", "Pro", "Other"];
const subjectTypes = [
  { value: "feedback", label: "Feedback", tag: "[Feedback]", icon: Send },
  { value: "bug", label: "Bug Report", tag: "[Bug Report]", icon: Bug },
  { value: "feature", label: "Feature Request", tag: "[Feature Request]", icon: Lightbulb },
  { value: "account", label: "Account Issue", tag: "[Account Issue]", icon: HelpCircle },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !userType || !subjectType || !message) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);

    const subjectMeta = subjectTypes.find((s) => s.value === subjectType);
    const emailSubject = `${subjectMeta?.tag} Houses of Thought ${
      subjectType === "feedback" ? "Message" :
      subjectType === "bug" ? "Issue" :
      subjectType === "feature" ? "Suggestion" : "Support"
    }`;

    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: { name, email, userType, subjectType: emailSubject, message },
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      console.error("Contact form error:", err);
      toast.error("Something went wrong. Please try emailing us directly at houseofthought.support@gmail.com");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNavbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center animate-fade-in">
          <div className="h-16 w-16 rounded-full bg-pov-ideas/10 flex items-center justify-center mx-auto mb-6">
            <Send className="h-8 w-8 text-pov-ideas" />
          </div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-3">Thank You!</h2>
          <p className="text-lg text-muted-foreground">
            Thank you for helping improve the Houses of Thought. We'll get back to you soon.
          </p>
          <Button variant="outline" className="mt-8" onClick={() => setSubmitted(false)}>
            Send Another Message
          </Button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNavbar />

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3">
            Contact & Feedback
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Have feedback, found a bug, or want to request a feature? We'd love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Form */}
          <Card className="md:col-span-2 animate-fade-in">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>User Type</Label>
                    <Select value={userType} onValueChange={setUserType}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {userTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject Type</Label>
                    <Select value={subjectType} onValueChange={setSubjectType}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjectTypes.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    className="min-h-[140px]"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Sidebar info */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Direct Email</CardTitle>
              </CardHeader>
              <CardContent>
                <a href="mailto:houseofthought.support@gmail.com" className="text-sm text-primary hover:underline break-all">
                  houseofthought.support@gmail.com
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reporting Bugs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If you encounter a bug, please include: what you were trying to do, what happened instead, any error messages, and screenshots if possible.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Feature Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tell us the feature title, a description, and why it would help. We review every suggestion.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
