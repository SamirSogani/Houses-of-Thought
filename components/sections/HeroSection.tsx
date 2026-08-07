'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ghostQuestions = [
  'Should I leave my job to start a company?',
  'Is remote schooling better for my child?',
  'Should we adopt AI grading in our district?',
  'Is it ethical to use AI-generated art commercially?',
  'Should I move abroad for a lower cost of living?',
]

function NineMarkHero() {
  const [filled, setFilled] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFilled((f) => (f >= 9 ? 0 : f + 1))
    }, 320)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 10px)',
        gap: '4px',
      }}
      aria-hidden="true"
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: i < filled ? 'var(--amber)' : 'var(--ink-mid)',
            transition: 'background 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      ))}
    </div>
  )
}

export default function HeroSection() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [ghostIdx, setGhostIdx] = useState(0)
  const [ghostVisible, setGhostVisible] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const cycle = setInterval(() => {
      setGhostVisible(false)
      setTimeout(() => {
        setGhostIdx((i) => (i + 1) % ghostQuestions.length)
        setGhostVisible(true)
      }, 400)
    }, 4000)
    return () => clearInterval(cycle)
  }, [])

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
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBlock: 'clamp(80px, 15vh, 160px)',
        paddingInline: 'var(--px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Architectural grid background */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.035,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="hero-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <line x1="60" y1="0" x2="60" y2="60" stroke="#F7F6F2" strokeWidth="0.5" />
            <line x1="0" y1="60" x2="60" y2="60" stroke="#F7F6F2" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      {/* Nine mark in corner */}
      <div
        style={{
          position: 'absolute',
          top: 'clamp(80px, 10vh, 120px)',
          right: 'var(--px)',
        }}
      >
        <NineMarkHero />
      </div>

      {/* Main content */}
      <div
        style={{
          maxWidth: '52ch',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* System annotation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              width: 24,
              height: 1,
              background: 'var(--amber)',
              display: 'block',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--rule)',
            }}
          >
            8 layers · 9 standards · 47 reviewers
          </span>
          <span
            style={{
              width: 24,
              height: 1,
              background: 'var(--amber)',
              display: 'block',
            }}
          />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(36px, 7vw, 76px)',
            lineHeight: 1.0,
            letterSpacing: '-0.025em',
            color: 'var(--parchment)',
          }}
        >
          What are you
          <br />
          trying to{' '}
          <span
            style={{
              color: 'var(--amber)',
              fontStyle: 'italic',
            }}
          >
            decide
          </span>
          ?
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(16px, 1.5vw, 19px)',
            lineHeight: 1.6,
            color: 'var(--rule)',
            maxWidth: '42ch',
            margin: '28px auto 0',
          }}
        >
          Don&rsquo;t pay $100/month for an AI verdict you can&rsquo;t inspect.
          Build the reasoning yourself — perspectives, evidence, assumptions —
          graded by nine intellectual standards. Free, always.
        </p>

        {/* The input box */}
        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: 44,
            position: 'relative',
          }}
        >
          <div
            className="live-edge"
            style={{
              position: 'relative',
              borderRadius: 12,
              background: 'var(--ink-mid)',
              border: '1px solid var(--ink-subtle)',
              overflow: 'hidden',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Enter a question to reason about"
              style={{
                width: '100%',
                padding: '20px 120px 20px 22px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(16px, 1.3vw, 18px)',
                color: 'var(--parchment)',
                caretColor: 'var(--amber)',
              }}
            />
            {/* Ghost placeholder */}
            {!value && (
              <span
                style={{
                  position: 'absolute',
                  left: 22,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'clamp(16px, 1.3vw, 18px)',
                  color: 'var(--ink-subtle)',
                  pointerEvents: 'none',
                  opacity: ghostVisible ? 0.6 : 0,
                  transition: 'opacity 0.35s',
                }}
              >
                {ghostQuestions[ghostIdx]}
              </span>
            )}
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
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--amber-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--amber)')}
            >
              Build →
            </button>
          </div>

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-subtle)',
              marginTop: 14,
              letterSpacing: '0.04em',
            }}
          >
            No sign-up required. No payment ever.
          </p>
        </form>
      </div>

      {/* Bottom annotation */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(24px, 4vh, 48px)',
          left: 'var(--px)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-subtle)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 1,
            background: 'var(--amber)',
            display: 'block',
          }}
        />
        Trapasso / Paul–Elder framework · Rev. A
      </div>
    </section>
  )
}
