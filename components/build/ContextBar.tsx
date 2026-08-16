// Context bar: editable title, live strength pill, mode toggle, presence.
// The presence stack used to show only a hardcoded 'you'/'ai' pair — a
// leftover from when collaboration was fake (fake collaborators and the inert
// Invite/Publish buttons were removed — audit 2026-07-19, ai-slop §2-3). Now
// that house_collaborators is real (team-panel-v2 item 1), it shows a real
// avatar for the house owner and every collaborator, sourced from
// useTeamRoster and threaded down from BuildHousePage — plus the co-pilot,
// which still isn't a real account. Falls back to the old 'you'/'ai' pair
// whenever there's no real team context at all (teacher view, strawman
// attack — see RightRail's TeamContext) or the roster hasn't loaded yet.

import type { AiMode, PersonKey } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { strengthColor } from '@/lib/build/strength'
import { people } from '@/lib/build/people'
import { Avatar, RealAvatar } from './Avatar'
import { displayNameFor, formatLastActive, type TeamRoster } from './useTeamRoster'

const presenceOrder: PersonKey[] = ['you', 'ai']

// Live save state, driven by BuildHousePage's save controller. The eyebrow used
// to claim "autosaved" statically (ux-review 6.4) — now it only says what the
// controller has actually observed.
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict' | 'signed-out'

const SAVE_STATUS_TEXT: Record<SaveStatus, { text: string; alert: boolean }> = {
  saved: { text: 'Saved', alert: false },
  dirty: { text: 'Edited', alert: false },
  saving: { text: 'Saving…', alert: false },
  failed: { text: 'Save failed — retrying', alert: true },
  conflict: { text: 'Changed elsewhere — reload', alert: true },
  'signed-out': { text: 'Signed out — log in to save', alert: true },
}

export function ContextBar({
  title,
  question,
  strength,
  mode,
  modeLocked = false,
  readOnly = false,
  draftLocked = false,
  scored = true,
  saveStatus = null,
  roster = null,
  currentUserId,
  onModeChange,
  onTitleChange,
  onOpenReview,
}: {
  title: string
  // The overarching question — used as the title placeholder so an unnamed
  // house is identified by its question when no title is entered.
  question: string
  strength: Strength
  mode: AiMode
  // When true (students), the toggle is shown but inert — pinned to Learn.
  modeLocked?: boolean
  // When true (teacher read-only view), the title and write buttons are disabled.
  readOnly?: boolean
  // Draft gate (decision 016 §2): AI-drafted layers await their claim, so the
  // strength renders as provisional and Publish is locked. The score itself is
  // never altered (invariant 6) — this is presentation only.
  draftLocked?: boolean
  // False for a house with no content yet: the pill shows "Not scored yet"
  // instead of a red number, so the product's first feedback isn't a failing
  // grade on an empty page (ux M6). The score itself is unchanged.
  scored?: boolean
  // null hides the indicator (read-only views, tab-locked views).
  saveStatus?: SaveStatus | null
  // Real owner + collaborator data (team-panel-v2 item 1), from
  // useTeamRoster. null when there's no real team context (teacher view,
  // strawman) — falls back to the old 'you'/'ai' presence pair.
  roster?: TeamRoster | null
  // Needed to mark the viewer's own avatar "(you)" instead of by name.
  currentUserId?: string | null
  onModeChange: (mode: AiMode) => void
  onTitleChange: (v: string) => void
  onOpenReview: () => void
}) {
  const col = scored ? strengthColor(strength.overall) : 'var(--ink-subtle)'
  const save = saveStatus ? SAVE_STATUS_TEXT[saveStatus] : null
  return (
    <div
      className="bhp-contextbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '14px 24px',
        borderTop: '1px solid var(--rule-soft)',
        background: 'var(--parchment)',
        flexWrap: 'wrap',
      }}
    >
      {/* Title block */}
      <div className="bhp-title-block" style={{ minWidth: 0 }}>
        <div
          className="mono"
          role={save?.alert ? 'status' : undefined}
          style={{ fontSize: 10, color: save?.alert ? 'var(--warning-text)' : 'var(--ink-subtle)', marginBottom: 3 }}
        >
          {readOnly ? 'House · Read-only' : save ? `House · ${save.text}` : 'House'}
        </div>
        <input
          className="bhp-title-input"
          aria-label="House title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          readOnly={readOnly}
          placeholder={question.trim() || 'Name your house'}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: 'min(46ch, 44vw)',
          }}
        />
      </div>

      {/* Strength pill */}
      <button
        type="button"
        onClick={onOpenReview}
        title={
          !scored
            ? 'Add content to any layer and the score starts working.'
            : draftLocked
              ? 'Provisional — claim the AI-drafted layers to make this score yours.'
              : 'Open Review to see the full breakdown'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--white)',
          border: draftLocked ? '1px dashed var(--amber)' : '1px solid var(--rule)',
          borderRadius: 10,
          padding: '8px 14px',
          opacity: draftLocked ? 0.8 : 1,
        }}
      >
        <span style={{ textAlign: 'left' }}>
          <span className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--ink-subtle)' }}>
            {!scored ? 'House strength' : draftLocked ? 'Strength · provisional' : 'House strength'}
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, color: col }}>
              {scored ? strength.overall : '—'}
            </span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>
              {scored ? '/100' : 'not scored yet'}
            </span>
          </span>
        </span>
        <span style={{ width: 64, height: 6, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
          <span
            className="build-bar-fill"
            style={{
              display: 'block',
              height: '100%',
              width: scored ? `${strength.overall}%` : '0%',
              background: col,
              borderRadius: 3,
              transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)',
            }}
          />
        </span>
      </button>

      {/* Co-pilot mode: Learn | Decide (decision 007) */}
      <div
        role="group"
        aria-label={
          modeLocked
            ? 'Co-pilot mode: Learn (student accounts stay in Learn mode)'
            : 'Co-pilot mode: how much help the co-pilot gives'
        }
        title={modeLocked ? 'Student accounts stay in Learn mode.' : 'How much help the co-pilot gives.'}
        style={{ display: 'inline-flex', border: '1px solid var(--rule)', borderRadius: 8, overflow: 'hidden', background: 'var(--white)', opacity: modeLocked ? 0.6 : 1 }}
      >
        {(['learn', 'decide'] as AiMode[]).map((m) => {
          const active = mode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              disabled={modeLocked}
              aria-pressed={active}
              className="mono bhp-mode-seg"
              style={{
                fontSize: 10,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                padding: '7px 12px',
                border: 'none',
                cursor: modeLocked ? 'not-allowed' : 'pointer',
                color: active ? 'var(--ink)' : 'var(--ink-subtle)',
                background: active ? 'var(--amber-tint)' : 'transparent',
                fontWeight: active ? 700 : 500,
              }}
            >
              {m}
            </button>
          )
        })}
      </div>

      {/* Right cluster: who is actually in the house. */}
      <div className="bhp-context-actions" style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
        {roster && (roster.owner || roster.collaborators.length > 0) ? (
          <RealPresence roster={roster} currentUserId={currentUserId ?? null} />
        ) : (
          <div className="bhp-presence" style={{ display: 'flex', alignItems: 'center', paddingLeft: 7 }}>
            {presenceOrder.map((k) => (
              <Avatar
                key={k}
                who={k}
                size={30}
                ring
                title={`${people[k].name} · ${people[k].role}`}
                style={{ marginLeft: -7 }}
              />
            ))}
            {/* The avatars carry their identity only in a `title` tooltip, which
                keyboard and touch users never see (a11y S7). State it in text for
                assistive tech instead. */}
            <span className="sr-only">
              In this house: {presenceOrder.map((k) => `${people[k].name} (${people[k].role})`).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// Real presence avatars: owner + every collaborator (team-panel-v2 item 1),
// followed by the co-pilot — which still isn't a real account, so it keeps
// its lib/build/people.ts Avatar. Hovering/focusing a person's avatar shows
// their last-active timestamp from house_presence (item 4), same wording
// TeamPanel's own membership list uses.
function RealPresence({ roster, currentUserId }: { roster: TeamRoster; currentUserId: string | null }) {
  const people_ = [...(roster.owner ? [roster.owner] : []), ...roster.collaborators]
  return (
    <div className="bhp-presence" style={{ display: 'flex', alignItems: 'center', paddingLeft: 7 }}>
      {people_.map((p) => {
        const name = displayNameFor(p)
        const isSelf = p.userId === currentUserId
        const label = `${name}${isSelf ? ' (you)' : ''} · ${p.role} · ${formatLastActive(roster.presence[p.userId])}`
        return <RealAvatar key={p.userId} id={p.userId} name={name} size={30} ring title={label} style={{ marginLeft: -7 }} />
      })}
      <Avatar who="ai" size={30} ring title={`${people.ai.name} · ${people.ai.role}`} style={{ marginLeft: -7 }} />
      {/* The avatars carry their identity only in a `title` tooltip, which
          keyboard and touch users never see (a11y S7). State it in text for
          assistive tech instead. */}
      <span className="sr-only">
        In this house: {people_.map((p) => `${displayNameFor(p)} (${p.role}, ${formatLastActive(roster.presence[p.userId])})`).join(', ')}
        {`, ${people.ai.name} (${people.ai.role})`}
      </span>
    </div>
  )
}
