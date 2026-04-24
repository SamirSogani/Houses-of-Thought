import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import { useAuth } from "@/hooks/useAuth";

export default function TermsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const fromSignup = searchParams.get("from") === "signup";

  const backLabel = user ? "Back to Dashboard" : fromSignup ? "Back to Sign Up" : "Back to Home";
  const backPath = user ? "/dashboard" : fromSignup ? "/auth?mode=signup" : "/";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <button onClick={() => navigate(backPath)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </button>
        <h1 className="text-4xl font-display font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Last updated: March 18, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8">
          <section>
            <h2 className="text-xl font-display font-semibold mb-2">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">Houses of Thought (also known as House of Reason) is an AI-powered reasoning platform designed to help users analyze complex questions using structured critical thinking tools. By accessing or using the platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">2. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed">You must be at least 12 years old to create an account or use Houses of Thought. If you are under 18, you should have permission from a parent, guardian, or teacher before using the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">You are responsible for maintaining the confidentiality and security of your account credentials. You must provide accurate and complete information when creating an account. You are responsible for all activity that occurs under your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">When using Houses of Thought, you agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Upload illegal, harmful, or offensive content</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Attempt to hack, disrupt, reverse-engineer, or exploit the platform</li>
              <li>Abuse or manipulate the AI reasoning systems</li>
              <li>Use the platform for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">5. Educational Purpose Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">Houses of Thought is designed for educational and analytical purposes only. The platform does not provide legal, medical, financial, or professional advice. Any conclusions or reasoning generated through the platform should not be treated as professional guidance.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">6. AI Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">AI-generated suggestions, reasoning tools, and analysis outputs may occasionally produce inaccurate, incomplete, or biased information. Users should independently verify any important conclusions derived from AI-assisted features. We do not guarantee the accuracy of AI-generated content.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">7. Content Responsibility</h2>
            <p className="text-muted-foreground leading-relaxed">You are solely responsible for the content you create, upload, or share within the platform. Houses of Thought does not endorse, verify, or guarantee the accuracy of user-generated content.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">Houses of Thought owns and retains all rights to the platform software, system architecture, design, branding, and proprietary reasoning framework. You retain ownership of your own reasoning projects and content. By using the platform, you grant Houses of Thought a limited, non-exclusive license to store, process, and display your content solely for the purpose of providing the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">9. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">Houses of Thought does not guarantee uninterrupted, error-free, or continuous operation of the platform. The service may occasionally be unavailable due to scheduled maintenance, technical issues, or circumstances beyond our control.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">We reserve the right to suspend or terminate your account if you violate these Terms of Service, misuse the platform, or engage in conduct that we determine is harmful to the service or other users. You may also delete your account at any time through the platform settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">11. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">The platform is provided "as is" and "as available" without warranties of any kind, either express or implied. To the fullest extent permitted by law, Houses of Thought shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">Houses of Thought may update these Terms of Service periodically. We will notify users of significant changes. Continued use of the platform after changes are posted constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">13. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">If you have questions about these Terms of Service, please contact us at <a href="mailto:housesofthought.support@gmail.com" className="text-primary hover:underline">housesofthought.support@gmail.com</a>.</p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
