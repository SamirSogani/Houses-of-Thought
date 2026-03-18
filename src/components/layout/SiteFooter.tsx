import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function SiteFooter() {
  const { user } = useAuth();

  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <path d="M24 4L4 20H10V40H18V28H30V40H38V20H44L24 4Z"
                  stroke="hsl(var(--primary))" strokeWidth="2" fill="hsl(var(--primary) / 0.1)" />
              </svg>
              <span className="font-display font-bold text-foreground">House of Thought</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              An AI-powered reasoning system based on John Trapasso's model, derived from the Paul-Elder Model for critical thinking.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {!user && <li><Link to="/#features" className="hover:text-foreground transition-colors">Features</Link></li>}
              <li><Link to="/framework" className="hover:text-foreground transition-colors">Framework</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><a href="mailto:houseofthought.support@gmail.com" className="hover:text-foreground transition-colors">Support Email</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} House of Thought. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
