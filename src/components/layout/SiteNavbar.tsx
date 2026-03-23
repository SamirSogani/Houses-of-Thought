import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function SiteNavbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "About", href: "/#about" },
    { label: "Contact", href: "/contact" },
  ];

  const scrollToSection = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith("/#")) {
      const id = href.slice(2);
      if (window.location.pathname !== "/") {
        navigate("/");
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(href);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 4L4 20H10V40H18V28H30V40H38V20H44L24 4Z"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                fill="hsl(var(--primary) / 0.1)"
              />
            </svg>
            <span className="text-lg font-display font-bold text-foreground">
              Houses of Thought
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <button
                key={l.label}
                onClick={() => scrollToSection(l.href)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Log In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth?mode=signup")}>
              Create Account
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-muted-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border pt-4 space-y-2 animate-fade-in">
            {links.map((l) => (
              <button
                key={l.label}
                onClick={() => scrollToSection(l.href)}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                {l.label}
              </button>
            ))}
            <div className="flex gap-2 px-3 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setMobileOpen(false); navigate("/auth"); }}>
                Log In
              </Button>
              <Button size="sm" className="flex-1" onClick={() => { setMobileOpen(false); navigate("/auth?mode=signup"); }}>
                Create Account
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
