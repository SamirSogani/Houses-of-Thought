// Context bar: editable title, live strength pill, presence stack, Invite, Publish.
// See handoff 02 §5 / 05 §3.

import type { AiMode, PersonKey } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { strengthColor } from '@/lib/build/strength'
import { people } from '@/lib/build/people'
import { Avatar } from './Avatar'
import { PlusIcon, UploadIcon } from './buildIcons'

const presenceOrder: PersonKey[] = ['you', 'maya', 'devan', 'ai']

export function ContextBar({
  title,
  question,
  strength,
  mode,
  modeLocked = false,
  readOnly = false,
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
  onModeChange: (mode: AiMode) => void
  onTitleChange: (v: string) => void
  onOpenReview: () => void
  onInvite: () => void
  onPublish: () => void
}) {
  const col = strengthColor(strength.overall)
  return (
    <div
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
      <div style={{ minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginBottom: 3 }}>
          House · Draft · autosaved
        </div>
        <input
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
        title="Open Review to see the full breakdown"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--white)',
          border: '1px solid var(--rule)',
          borderRadius: 10,
          padding: '8px 14px',
        }}
      >
        <span style={{ textAlign: 'left' }}>
          <span className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--ink-subtle)' }}>
            House strength
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
              className="mono"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 7 }}>
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
            opacity: readOnly ? 0.5 : 1,
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
