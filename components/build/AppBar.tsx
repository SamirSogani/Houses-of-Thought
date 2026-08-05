// Top app bar: logo/wordmark (links back to the dashboard), profile link, sign
// out. The old decorative Framework/Collab spans and the "What's new" drawer
// button were removed — they were inert chrome and an internal handoff artifact
// (audit 2026-07-19, ai-slop §7/§10).

import Link from 'next/link'
import { LogoMark } from '@/components/icons'

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
}

export function AppBar({
  userEmail,
  onSignOut,
  fromReasoningRun,
}: {
  userEmail: string | null
  onSignOut: () => void
  // Set when this house was materialized from a reasoning-pipeline run
  // ("View in house") — renders a small mono link back to that run in the
  // admin runs browser. Undefined on every other house.
  fromReasoningRun?: string
}) {
  return (
    <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--rule)' }}>
      <div className="bhp-appbar" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 24px' }}>
        {/* Logo + wordmark → back to the dashboard */}
        <Link
          href="/dashboard"
          title="Back to your dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <LogoMark />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
            Houses of Thought
          </span>
        </Link>

        {fromReasoningRun && (
          <Link
            href={`/admin/reasoning/runs?run=${fromReasoningRun}`}
            style={{ ...monoLabel, color: 'var(--ink-subtle)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            ← Back to pipeline
          </Link>
        )}

        {/* Right cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
          <Link
            href="/profile"
            className="bhp-appbar-email"
            style={{ ...monoLabel, color: 'var(--ink-subtle)', textDecoration: 'none' }}
            title={userEmail ? `Profile · ${userEmail}` : 'Profile'}
          >
            {userEmail ? shortenEmail(userEmail) : 'Profile'}
          </Link>
          <button type="button" onClick={onSignOut} className="bhp-pad-tap" style={{ ...monoLabel, color: 'var(--ink-subtle)' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function shortenEmail(email: string): string {
  return email.length > 22 ? email.slice(0, 20) + '…' : email
}
