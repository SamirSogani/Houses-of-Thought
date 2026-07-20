'use client'

// Account type selector: a keyboard-accessible radiogroup of three option cards.
// The active option gets the ink border + amber "ACTIVE" chip.

import type { AccountType } from '@/lib/profile/data'
import { accountTypes } from '@/lib/profile/data'

function TypeIcon({ type }: { type: AccountType }) {
  if (type === 'student') {
    // graduation cap
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2L1.5 5 8 8l6.5-3z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
        <path d="M4.5 6.5v3c0 1 1.6 1.8 3.5 1.8s3.5-.8 3.5-1.8v-3" stroke="currentColor" strokeWidth="1.3" fill="none" />
      </svg>
    )
  }
  if (type === 'teacher') {
    // book
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3.5C6.5 2.5 4 2.5 2.5 3v9C4 11.5 6.5 11.5 8 12.5M8 3.5C9.5 2.5 12 2.5 13.5 3v9C12 11.5 9.5 11.5 8 12.5M8 3.5v9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      </svg>
    )
  }
  // person
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// `onChange` omitted → read-only. account_type is chosen at signup and pinned by
// RLS (migration 0026); the profile page renders this read-only, while the
// signup page keeps it interactive for the one-time choice.
export function AccountTypeSelector({
  value,
  onChange,
}: {
  value: AccountType
  onChange?: (t: AccountType) => void
}) {
  const readOnly = !onChange
  return (
    <div
      role={readOnly ? 'group' : 'radiogroup'}
      aria-label="Account type"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}
    >
      {accountTypes.map((t) => {
        const active = t.key === value
        // Read-only: only surface the active card so the page isn't offering
        // choices the user can't make.
        if (readOnly && !active) return null
        const Tag = readOnly ? 'div' : 'button'
        return (
          <Tag
            key={t.key}
            {...(readOnly
              ? {}
              : { type: 'button' as const, role: 'radio', 'aria-checked': active, onClick: () => onChange(t.key) })}
            style={{
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '14px 15px',
              borderRadius: 10,
              background: active ? 'var(--amber-tint)' : 'var(--white)',
              border: `1px solid ${active ? 'var(--ink)' : 'var(--rule)'}`,
              transition: 'background 0.15s, border-color 0.15s',
              cursor: readOnly ? 'default' : 'pointer',
            }}
            onMouseEnter={readOnly ? undefined : (e) => { if (!active) e.currentTarget.style.borderColor = 'var(--ink-subtle)' }}
            onMouseLeave={readOnly ? undefined : (e) => { if (!active) e.currentTarget.style.borderColor = 'var(--rule)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                <TypeIcon type={t.key} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</span>
              </span>
              {active && (
                <span className="mono" style={{ fontSize: 8, color: 'var(--amber-hover)', border: '1px solid var(--amber-hover)', borderRadius: 4, padding: '2px 6px' }}>
                  {readOnly ? 'Your account' : 'Active'}
                </span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{t.desc}</span>
          </Tag>
        )
      })}
    </div>
  )
}
