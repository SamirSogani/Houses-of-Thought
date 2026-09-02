// Top app bar for the document-view builder (builder-workspace-redesign plan
// §2): logo (back to the dashboard) · "My Houses" crumb · the house's own
// editable title, then presence, profile, and sign out on the right. The
// title used to live in ContextBar under a "House · Saved" eyebrow; the
// prototype puts it in the bar where a document's name goes, and the save
// indicator moved to the status row beside the layer nav.
//
// The old decorative Framework/Collab spans and the "What's new" drawer
// button were removed earlier — inert chrome and an internal handoff artifact
// (audit 2026-07-19, ai-slop §7/§10).

import Link from 'next/link'
import { LogoMark } from '@/components/icons'
import { Presence } from './ContextBar'
import type { TeamRoster } from './useTeamRoster'

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
}

export function AppBar({
  userEmail,
  title,
  question,
  readOnly = false,
  roster = null,
  currentUserId = null,
  onTitleChange,
  onSignOut,
}: {
  userEmail: string | null
  title: string
  // Used as the title placeholder so an unnamed house is identified by its
  // question (same rule ContextBar applied).
  question: string
  readOnly?: boolean
  roster?: TeamRoster | null
  currentUserId?: string | null
  onTitleChange: (v: string) => void
  onSignOut: () => void
}) {
  // The localStorage /house builder has no account and no dashboard to go
  // back to; its crumb points home instead.
  const homeHref = userEmail ? '/dashboard' : '/'
  return (
    <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--rule)' }}>
      <div className="bhp-appbar" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px', minHeight: 56 }}>
        <Link href={homeHref} title={userEmail ? 'Back to your dashboard' : 'Home'} style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
          <LogoMark />
          <span className="sr-only">Houses of Thought</span>
        </Link>

        {userEmail && (
          <Link href="/dashboard" className="bhp-appbar-crumb" style={{ ...monoLabel, color: 'var(--ink-subtle)', textDecoration: 'none', flex: '0 0 auto' }}>
            My Houses
            <span aria-hidden="true" style={{ margin: '0 6px' }}>›</span>
          </Link>
        )}

        <input
          className="bhp-title-input bhp-input16"
          aria-label="House title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          readOnly={readOnly}
          placeholder={question.trim() || 'Name your house'}
          style={{
            // Zero flex-basis: an <input>'s intrinsic width (its `size`) must
            // never decide the bar's line-breaking — it fills whatever is left.
            flex: '1 1 0%',
            width: 0,
            minWidth: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 17,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            textOverflow: 'ellipsis',
          }}
        />

        {/* Right cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto', flex: '0 0 auto' }}>
          <Presence roster={roster} currentUserId={currentUserId} size={26} />
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
