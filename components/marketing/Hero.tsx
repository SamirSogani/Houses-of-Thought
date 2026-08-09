'use client'

// Home hero: headline + the try-it box, front and center (redesign brief:
// "the try-it text box front and center (rotating placeholder example
// questions)"). Submitting routes to /try with the question attached, so the
// animated confirmation there can acknowledge exactly what was typed.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowIcon } from '@/components/icons'
import { MINI_HOUSE_EXAMPLES } from '@/lib/ai/mini-house'

const ROTATE_MS = 3200

export default function Hero() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const inputFocused = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      if (inputFocused.current || question) return
      setPlaceholderIndex((i) => (i + 1) % MINI_HOUSE_EXAMPLES.length)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [question])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    router.push(q ? `/try?q=${encodeURIComponent(q)}` : '/try')
  }

  return (
    <section style={{ paddingBlock: 'clamp(64px, 10vw, 120px)' }}>
      <div className="container" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid var(--dusk-rule)',
            borderRadius: 'var(--radius-chip)',
            padding: '6px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--amber)',
          }}
        >
          Always free, no paid tier
        </span>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(38px, 6vw, 68px)',
            lineHeight: 1.06,
            letterSpacing: '-0.015em',
            marginTop: 22,
            color: 'var(--dusk-ink)',
          }}
        >
          Reason through it,
          <br />
          don&rsquo;t just ask.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(17px, 1.6vw, 19px)',
            lineHeight: 1.6,
            color: 'var(--dusk-ink-mid)',
            maxWidth: '52ch',
            margin: '20px auto 0',
          }}
        >
          Ask a real question. Houses of Thought frames it, builds independent
          perspectives, stress-tests the assumptions and evidence, and reaches
          a conclusion, with every step checked by an independent review panel.
        </p>

        <form
          onSubmit={submit}
          className="dusk-card"
          style={{ marginTop: 36, textAlign: 'left', overflow: 'hidden' }}
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 600))}
            onFocus={() => (inputFocused.current = true)}
            onBlur={() => (inputFocused.current = false)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
            }}
            placeholder={MINI_HOUSE_EXAMPLES[placeholderIndex]}
            rows={3}
            aria-label="A question or decision you're facing"
            style={{
              width: '100%',
              resize: 'vertical',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              padding: '22px 24px',
              fontFamily: 'var(--font-body)',
              fontSize: 17,
              lineHeight: 1.6,
              color: 'var(--dusk-ink)',
              minHeight: 96,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 16px', borderTop: '1px solid var(--dusk-rule)' }}>
            <button type="submit" className="btn-primary">
              Try it instantly <ArrowIcon />
            </button>
          </div>
        </form>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dusk-ink-subtle)', marginTop: 14 }}>
          No account needed to try it.
        </p>
      </div>
    </section>
  )
}
