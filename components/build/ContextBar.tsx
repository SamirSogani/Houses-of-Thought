// Context bar: editable title, live strength pill, presence stack, Invite, Publish.
// See handoff 02 §5 / 05 §3.

import type { AiMode, PersonKey } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { strengthColor } from '@/lib/build/strength'
import { people } from '@/lib/build/people'
import { Avatar } from './Avatar'
import { PlusIcon, UploadIcon } from './buildIcons'

const presenceOrder: PersonKey[] = ['you', 'maya', 'devan', 'ai']

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
  saveStatus = null,
  onModeChange,
  onTitleChange,
  onOpenReview,
  onInvite,
  onPublish,
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
  // null hides the indicator (read-only views, tab-locked views).
  saveStatus?: SaveStatus | null
  onModeChange: (mode: AiMode) => void
  onTitleChange: (v: string) => void
  onOpenReview: () => void
  onInvite: () => void
  onPublish: () => void
}) {
  const col = strengthColor(strength.overall)
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
          style={{ fontSize: 10, color: save?.alert ? 'var(--warning)' : 'var(--ink-subtle)', marginBottom: 3 }}
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
          draftLocked
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
            {draftLocked ? 'Strength · provisional' : 'House strength'}
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, color: col }}>
              {strength.overall}
            </span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>
              /100
            </span>
          </span>
        </span>
        <span style={{ width: 64, height: 6, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
          <span
            className="build-bar-fill"
            style={{
              display: 'block',
              height: '100%',
              width: `${strength.overall}%`,
              background: col,
              borderRadius: 3,
              transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)',
            }}
          />
        </span>
      </button>

      {/* Co-pilot mode: Learn | Decide (decision 007) */}
      <div
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

      {/* Right cluster */}
      <div className="bhp-context-actions" style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
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
        </div>
        <button
          type="button"
          onClick={onInvite}
          disabled={readOnly}
          className="bhp-context-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 38,
            padding: '0 15px',
            border: '1px solid var(--ink)',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--ink)',
            background: 'var(--white)',
            opacity: readOnly ? 0.5 : 1,
            cursor: readOnly ? 'not-allowed' : 'pointer',
          }}
        >
          <PlusIcon size={14} />
          Invite
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={readOnly}
          title={draftLocked ? 'Claim every AI-drafted layer to unlock publishing.' : undefined}
          className="bhp-context-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 38,
            padding: '0 17px',
            background: 'var(--amber)',
            color: 'var(--ink)',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            opacity: readOnly || draftLocked ? 0.5 : 1,
            cursor: readOnly ? 'not-allowed' : 'pointer',
          }}
        >
          <UploadIcon size={14} />
          Publish
        </button>
      </div>
    </div>
  )
}
