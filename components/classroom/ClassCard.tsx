'use client'

// A class tile for the teacher's classroom grid + the "Create class" form tile.
// Brand-styled to match components/dashboard/HouseCard.tsx: white card, rule
// border, mono meta labels. The card links to the roster; the join code has its
// own copy button (guarded so it doesn't trigger the card link).

import { useState } from 'react'
import Link from 'next/link'
import type { ClassSummary } from '@/lib/classroom/classes'
import { inviteUrl } from '@/lib/classroom/classes'
import { PlusIcon } from '@/components/build/buildIcons'

export function ClassCard({ cls, memberCount }: { cls: ClassSummary; memberCount: number }) {
  const [copied, setCopied] = useState(false)

  async function copyInvite(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(inviteUrl(cls.joinCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked — leave the code visible for manual copy.
    }
  }

  return (
    <Link
      href={`/classroom/${cls.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--white)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
        minHeight: 170,
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(20,33,58,0.08)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--rule)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 20,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {cls.name}
      </h3>

      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginTop: 10 }}>
        {memberCount} {memberCount === 1 ? 'student' : 'students'}
      </div>

      {/* Join code + copy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 18 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>JOIN CODE</span>
        <span
          className="mono"
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--ink)', background: 'var(--amber-tint)', borderRadius: 5, padding: '3px 8px' }}
        >
          {cls.joinCode}
        </span>
        <button
          type="button"
          onClick={copyInvite}
          className="mono"
          style={{ marginLeft: 'auto', fontSize: 9, color: copied ? 'var(--green-strong)' : 'var(--ink-subtle)', border: '1px solid var(--rule)', borderRadius: 5, padding: '4px 8px', background: 'var(--white)' }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </Link>
  )
}

export function CreateClassCard({
  value,
  onChange,
  onCreate,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onCreate: () => void
  disabled?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: 12,
        minHeight: 170,
        width: '100%',
        border: '1.5px dashed var(--rule)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
        <span
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--amber-tint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <PlusIcon size={16} />
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17 }}>New class</span>
      </span>
      <input
        aria-label="Class name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCreate()
        }}
        placeholder="e.g. Period 3 — Ethics"
        style={{
          height: 42,
          padding: '0 12px',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--ink)',
          background: 'var(--white)',
          border: '1px solid var(--rule)',
          borderRadius: 8,
          outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={onCreate}
        disabled={disabled || value.trim().length === 0}
        className="btn-primary"
        style={{
          justifyContent: 'center',
          opacity: disabled || value.trim().length === 0 ? 0.55 : 1,
          cursor: disabled || value.trim().length === 0 ? 'default' : 'pointer',
        }}
      >
        {disabled ? 'Creating…' : 'Create class'}
      </button>
    </div>
  )
}
