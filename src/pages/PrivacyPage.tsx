import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </button>
        <h1 className="text-4xl font-display font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: March 18, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8">
          <section>
            <h2 className="text-xl font-display font-semibold mb-2">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">House of Thought (also known as House of Reason) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains what information we collect, how we use it, and the choices you have regarding your data.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">When you use House of Thought, we may collect the following types of information:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name and email address (provided during account creation)</li>
              <li>Account login credentials</li>
              <li>User-created reasoning projects, analyses, and related content</li>
              <li>Feedback, support messages, and bug reports submitted through the platform</li>
              <li>Usage data such as pages visited and features used</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">3. How Information Is Used</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">Collected information may be used to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Operate and maintain the platform</li>
              <li>Improve reasoning tools, AI features, and user experience</li>
              <li>Provide support and respond to user feedback</li>
              <li>Maintain security, prevent abuse, and enforce our Terms of Service</li>
              <li>Communicate important updates about the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">4. Data Sharing Policy</h2>
            <p className="text-muted-foreground leading-relaxed">House of Thought does not sell, share, rent, or distribute your personal data to third parties. Your data is used exclusively for operating and improving the House of Thought platform. We may disclose information only if required by law or to protect the rights, safety, or property of House of Thought and its users.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">5. AI Processing</h2>
            <p className="text-muted-foreground leading-relaxed">Your inputs — including reasoning projects, questions, and analysis content — may be processed by AI systems to generate reasoning suggestions, implications, and other analytical outputs. This processing is performed solely to deliver the platform's core functionality. AI-generated outputs are not stored or used for purposes beyond providing the service to you.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">6. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">We implement reasonable technical and organizational measures to protect your personal information from unauthorized access, loss, misuse, or alteration. However, no method of electronic storage or transmission is completely secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">7. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">Users must be at least 12 years old to create an account on House of Thought. The platform does not knowingly collect personal data from children under 12. If we become aware that we have collected information from a child under 12, we will take steps to delete that data promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">8. User Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Access and review the personal data associated with your account</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and all associated data</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">You can delete your account at any time through the Profile settings page or by contacting our support team.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">9. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">User data is retained only as long as necessary to operate the platform and provide the service. When you delete your account, all associated data — including reasoning projects, profile information, and feedback — will be permanently removed from our systems.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">10. Changes to Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">House of Thought may update this Privacy Policy periodically to reflect changes in our practices or applicable laws. We will notify users of significant changes. Continued use of the platform after changes are posted constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-2">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">If you have questions about this Privacy Policy or your personal data, please contact us at <a href="mailto:houseofthought.support@gmail.com" className="text-primary hover:underline">houseofthought.support@gmail.com</a>.</p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
