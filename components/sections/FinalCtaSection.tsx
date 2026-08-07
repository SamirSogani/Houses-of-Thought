'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function FinalCtaSection() {
  const router = useRouter()
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      router.push(`/try?q=${encodeURIComponent(value.trim())}`)
    } else {
      router.push('/try')
    }
  }

  return (
    <section
      className="ink-surface"
      data-surface="ink"
      style={{
        paddingBlock: 'clamp(72px, 12vw, 140px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grid background */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.03,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="cta-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="60"
              y1="0"
              x2="60"
              y2="60"
              stroke="#F7F6F2"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="60"
              x2="60"
              y2="60"
              stroke="#F7F6F2"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cta-grid)" />
      </svg>

      <div
        className="container"
        style={{
          maxWidth: '56ch',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Nine mark */}
        <div className="section-nine-mark active" style={{ marginBottom: 28 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(32px, 5vw, 60px)',
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: 'var(--parchment)',
          }}
        >
          Pick a question
          <br />
          you can&rsquo;t crack.
        </h2>

        {/* Input box — mirrors the hero */}
        <form onSubmit={handleSubmit} style={{ marginTop: 36 }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 12,
              background: 'var(--ink-mid)',
              border: '1px solid var(--ink-subtle)',
              overflow: 'hidden',
            }}
          >
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type your question…"
              aria-label="Enter a question to reason about"
              style={{
                width: '100%',
                padding: '18px 120px 18px 22px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: 16,
                color: 'var(--parchment)',
                caretColor: 'var(--amber)',
              }}
            />
            <button
              type="submit"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '10px 20px',
                background: 'var(--amber)',
                color: 'var(--ink)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 15,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--amber-hover)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'var(--amber)')
              }
            >
              Build →
            </button>
          </div>
        </form>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            marginTop: 20,
            alignItems: 'center',
          }}
        >
          <Link
            href="/login?mode=signup"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--parchment)',
              borderBottom: '1px solid var(--ink-subtle)',
              paddingBottom: 2,
              transition: 'border-color 0.2s',
            }}
          >
            or create a free account
          </Link>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-subtle)',
            marginTop: 20,
            letterSpacing: '0.04em',
          }}
        >
          No sign-up to try. No payment ever. Not now, not later.
        </p>
      </div>
    </section>
  )
}
