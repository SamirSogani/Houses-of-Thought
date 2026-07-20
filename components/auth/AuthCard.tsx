import type { ReactNode } from 'react'
import Header from '@/components/Header'

// Shared scaffold for the auth pages (login, forgot-password, reset-password):
// the site header, the centered parchment stage, the eyebrow + display heading,
// and the white card that holds the form. `children` render inside the card;
// `belowCard` renders in the column beneath it (login's footer note).
export function AuthCard({
  eyebrow,
  heading,
  children,
  belowCard,
}: {
  eyebrow: string
  heading: string
  children: ReactNode
  belowCard?: ReactNode
}) {
  return (
    <>
      <Header />

      {/* acct-vh-header = dvh-safe `calc(100vh - 73px)` (account-responsive.css). */}
      <main
        className="acct-vh-header"
        style={{
          background: 'var(--parchment)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(32px, 6vw, 80px) var(--px)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
            <span className="eyebrow">{eyebrow}</span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(32px, 5vw, 44px)',
              lineHeight: 1.08,
              letterSpacing: '-0.015em',
              color: 'var(--ink)',
              marginBottom: 32,
            }}
          >
            {heading}
          </h1>

          {/* Card */}
          <div
            style={{
              background: 'var(--white)',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(24px, 4vw, 36px)',
            }}
          >
            {children}
          </div>

          {belowCard}
        </div>
      </main>
    </>
  )
}

export const authInputStyle: React.CSSProperties = {
  height: 48,
  padding: '0 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 16,
  color: 'var(--ink)',
  background: 'var(--parchment)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  outline: 'none',
  transition: 'border-color 0.15s',
}

const authLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-subtle)',
}

// A labelled text input matching the auth card's field styling. Focus/blur nudge
// the border colour imperatively (same behaviour as the original inline fields).
export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
}: {
  id: string
  label: string
  type: 'email' | 'password' | 'text'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  minLength?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={authLabelStyle}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={authInputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
      />
    </div>
  )
}

// The "— or —" rule between the form and the mode-switch line.
export function AuthDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--ink-subtle)',
          textTransform: 'uppercase',
        }}
      >
        or
      </span>
      <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
    </div>
  )
}

export function AuthError({ children }: { children: ReactNode }) {
  // role="alert" so a failed sign-in is announced rather than appearing
  // silently for screen-reader users (a11y S2).
  return (
    <p role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--warning-text)' }}>
      {children}
    </p>
  )
}
