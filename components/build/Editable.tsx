'use client'

// Shared inline-edit primitives for the Build layers. Seamless, borderless
// fields that inherit the surrounding typography so editing looks like typing
// directly onto the house. `InlineText` grows to fit when multiline.

import { useLayoutEffect, useRef } from 'react'

const base: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  width: '100%',
  font: 'inherit',
  color: 'inherit',
  letterSpacing: 'inherit',
  padding: 0,
  margin: 0,
}

export function InlineText({
  value,
  onChange,
  placeholder,
  multiline,
  ariaLabel,
  style,
  onClick,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  ariaLabel?: string
  style?: React.CSSProperties
  onClick?: (e: React.MouseEvent) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea to its content so there is no inner scrollbar.
  useLayoutEffect(() => {
    const el = ref.current
    if (!multiline || !el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, multiline])

  // bhp-input16: below 768px every field computes to ≥16px so iOS never
  // focus-zooms (app/styles/build-responsive.css).
  if (multiline) {
    return (
      <textarea
        ref={ref}
        rows={1}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onClick={onClick}
        className="bhp-input16"
        style={{ ...base, resize: 'none', overflow: 'hidden', lineHeight: 'inherit', ...style }}
      />
    )
  }
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
      className="bhp-input16"
      style={{ ...base, ...style }}
    />
  )
}

export function RemoveButton({
  onClick,
  title = 'Remove',
  style,
}: {
  onClick: (e: React.MouseEvent) => void
  title?: string
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      // bhp-remove: ≥24px touch size below 1024px, same glyph (build-responsive.css).
      className="bhp-remove"
      style={{
        flex: '0 0 auto',
        width: 20,
        height: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        background: 'transparent',
        color: 'var(--ink-subtle)',
        fontSize: 15,
        lineHeight: 1,
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--warning)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}
    >
      ×
    </button>
  )
}
