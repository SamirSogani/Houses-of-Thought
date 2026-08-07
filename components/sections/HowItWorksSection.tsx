'use client'

import { useState } from 'react'
import Link from 'next/link'

const standards = [
  {
    name: 'Clarity',
    short: 'Can the point be understood without confusion?',
    icon: '◯',
  },
  {
    name: 'Accuracy',
    short: 'Is every claim factually correct?',
    icon: '◎',
  },
  {
    name: 'Precision',
    short: 'Is it specific enough to be useful?',
    icon: '◈',
  },
  {
    name: 'Relevance',
    short: 'Does each point connect to the question?',
    icon: '◇',
  },
  {
    name: 'Depth',
    short: 'Are complexities addressed, not glossed over?',
    icon: '▽',
  },
  {
    name: 'Breadth',
    short: 'Are other viewpoints considered?',
    icon: '◁',
  },
  {
    name: 'Logic',
    short: 'Do the conclusions follow from the evidence?',
    icon: '△',
  },
  {
    name: 'Significance',
    short: 'Are the most important issues prioritized?',
    icon: '◆',
  },
  {
    name: 'Fairness',
    short: 'Is the reasoning free from bias?',
    icon: '▢',
  },
]

export default function HowItWorksSection() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--section-py-lg)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '56ch', margin: '0 auto' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--amber-text)',
            }}
          >
            The nine standards
          </span>
          <h2
            className="h2"
            style={{
              marginTop: 14,
              fontSize: 'clamp(28px, 4vw, 48px)',
            }}
          >
            Every layer, graded nine ways.
          </h2>
          <p
            className="body-text"
            style={{
              maxWidth: '46ch',
              margin: '16px auto 0',
            }}
          >
            Each layer of your house is evaluated against nine universal
            intellectual standards from the Paul–Elder framework. Not a
            single score — nine independent measures of reasoning quality.
          </p>
        </div>

        {/* The 3×3 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'clamp(8px, 1.5vw, 16px)',
            maxWidth: 640,
            margin: '52px auto 0',
          }}
          role="group"
          aria-label="The nine standards of reasoning — select one to read its definition"
        >
          {standards.map((s, i) => {
            const active = activeIdx === i
            return (
              <button
                key={s.name}
                onClick={() => setActiveIdx(active ? null : i)}
                onMouseEnter={() => setActiveIdx(i)}
                aria-pressed={active}
                aria-label={`${s.name}: ${s.short}`}
                style={{
                  aspectRatio: '1',
                  border: active
                    ? '2px solid var(--amber)'
                    : '1px solid var(--rule)',
                  borderRadius: 10,
                  background: active ? 'var(--white)' : 'var(--white)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 12,
                  transition:
                    'border-color 0.2s, box-shadow 0.3s, transform 0.2s',
                  boxShadow: active
                    ? '0 0 24px var(--amber-glow)'
                    : 'none',
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                  color: 'var(--ink)',
                }}
              >
                <span
                  style={{
                    fontSize: 'clamp(18px, 2.5vw, 28px)',
                    lineHeight: 1,
                    color: active ? 'var(--amber)' : 'var(--ink-subtle)',
                    transition: 'color 0.2s',
                  }}
                >
                  {s.icon}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 'clamp(12px, 1.3vw, 15px)',
                    color: 'var(--ink)',
                  }}
                >
                  {s.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Definition panel */}
        <div
          aria-live="polite"
          style={{
            maxWidth: 640,
            margin: '24px auto 0',
            minHeight: 64,
            textAlign: 'center',
          }}
        >
          {activeIdx !== null && (
            <div
              style={{
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                padding: '18px 24px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  color: 'var(--ink-mid)',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: 'var(--ink)' }}>
                  {standards[activeIdx].name}
                </strong>{' '}
                — {standards[activeIdx].short}
              </p>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/framework" className="text-link">
            Read the full framework →
          </Link>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-subtle)',
            marginTop: 20,
            letterSpacing: '0.04em',
            maxWidth: '60ch',
            margin: '20px auto 0',
          }}
        >
          The nine-standard review panel is in active testing — not yet part of
          the standard free builder. The framework itself guides every house.
        </p>
      </div>
    </section>
  )
}
