// Top app bar: logo/wordmark, Framework/Collab nav, What's new, Profile, Sign out.
// See handoff 02 §4 / 05 §2. Profile shows the real signed-in email; Sign out is wired.

import { LogoMark } from '@/components/icons'
import { SparkIcon } from './buildIcons'

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
}

export function AppBar({
  userEmail,
  onOpenNotes,
  onSignOut,
}: {
  userEmail: string | null
  onOpenNotes: () => void
  onSignOut: () => void
}) {
  return (
    <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 24px' }}>
        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
            Houses of Thought
          </span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 14 }}>
          <span style={{ ...monoLabel, color: 'var(--ink-subtle)', padding: '6px 10px' }}>Framework</span>
          <span
            style={{
              ...monoLabel,
              color: 'var(--ink)',
              background: 'var(--parchment)',
              border: '1px solid var(--rule)',
              borderRadius: 6,
              padding: '6px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <SparkIcon size={12} fill="var(--amber-hover)" />
            Collab
          </span>
        </nav>

        {/* Right cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={onOpenNotes}
            title="What changed vs the old flow"
            style={{
              ...monoLabel,
              color: 'var(--blueprint)',
              border: '1px dashed var(--blueprint)',
              borderRadius: 6,
              padding: '6px 11px',
            }}
          >
            What&apos;s new
          </button>
          <span style={{ ...monoLabel, color: 'var(--ink-subtle)' }} title={userEmail ?? undefined}>
            {userEmail ? shortenEmail(userEmail) : 'Profile'}
          </span>
          <button type="button" onClick={onSignOut} style={{ ...monoLabel, color: 'var(--ink-subtle)' }}>
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
