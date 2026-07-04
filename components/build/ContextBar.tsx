// Context bar: editable title, live strength pill, presence stack, Invite, Publish.
// See handoff 02 §5 / 05 §3.

import type { PersonKey } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { strengthColor } from '@/lib/build/strength'
import { people } from '@/lib/build/people'
import { Avatar } from './Avatar'
import { PlusIcon, UploadIcon } from './buildIcons'

const presenceOrder: PersonKey[] = ['you', 'maya', 'devan', 'ai']

export function ContextBar({
  title,
  strength,
  onTitleChange,
  onOpenReview,
  onInvite,
  onPublish,
}: {
  title: string
  strength: Strength
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
          }}
        >
          <PlusIcon size={14} />
          Invite
        </button>
        <button
          type="button"
          onClick={onPublish}
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
          }}
        >
          <UploadIcon size={14} />
          Publish
        </button>
      </div>
    </div>
  )
}
