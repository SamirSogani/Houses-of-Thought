'use client'

// Shared brand-styled primitives for the Profile form: section card, field label,
// text input, and textarea. Kept small and reused across every profile section.

import { useState } from 'react'

export function SectionCard({
  children,
  accent,
  style,
}: {
  children: React.ReactNode
  accent?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--rule)',
        ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
        borderRadius: 'var(--radius-card)',
        padding: 'clamp(16px, 2.4vw, 22px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function FieldLabel({ label, helper, color }: { label: string; helper?: string; color?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, letterSpacing: '-0.01em', color: color ?? 'var(--ink)' }}>
        {label}
      </div>
      {helper && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5, marginTop: 6, maxWidth: '60ch' }}>
          {helper}
        </p>
      )}
    </div>
  )
}

const controlBase: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--ink)',
  background: 'var(--parchment)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  outline: 'none',
  transition: 'border-color 0.15s',
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
  invalid?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const borderColor = invalid ? 'var(--warning)' : focused ? 'var(--ink)' : 'var(--rule)'
  return (
    <input
      value={value}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...controlBase, height: 46, padding: '0 14px', borderColor }}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  rows = 4,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
  rows?: number
}) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value}
      rows={rows}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...controlBase, padding: '11px 14px', lineHeight: 1.5, resize: 'vertical', borderColor: focused ? 'var(--ink)' : 'var(--rule)' }}
    />
  )
}
