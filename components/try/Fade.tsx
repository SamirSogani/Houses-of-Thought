'use client'

// Staggers the result view's 7 top-level sections in on entry. Reuses the site's
// existing `.fade-in` keyframe (globals.css) — already gated by
// prefers-reduced-motion — rather than adding an animation dependency.
export default function Fade({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <div className="fade-in" style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
      {children}
    </div>
  )
}
