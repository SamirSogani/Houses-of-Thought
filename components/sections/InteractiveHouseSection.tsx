'use client'

import { useState } from 'react'

/* The pipeline visualization: show the 8 layers and what each one does
   automatically — the user provided nothing except a question. */

type LayerKey = 'concepts' | 'question' | 'perspectives' | 'evidence' | 'assumptions' | 'conclusion' | 'implications' | 'stress'

const layerDefs: Record<LayerKey, { num: string; name: string; agents: number; definition: string }> = {
  concepts: {
    num: '01',
    name: 'Concepts',
    agents: 5,
    definition: 'The system defines every key term so reasoning starts from shared vocabulary, not ambiguity.',
  },
  question: {
    num: '02',
    name: 'Overarching Question',
    agents: 4,
    definition: 'Your question is refined into the single central question the entire house answers.',
  },
  perspectives: {
    num: '03',
    name: 'Perspectives',
    agents: 7,
    definition: 'Three lenses (Self, Group, Ideas) are generated so the reasoning sees past a single point of view.',
  },
  evidence: {
    num: '04',
    name: 'Evidence',
    agents: 8,
    definition: 'Research Mode finds and cites real sources. Every fact is checkable, not hallucinated.',
  },
  assumptions: {
    num: '05',
    name: 'Assumptions',
    agents: 5,
    definition: 'Hidden beliefs are surfaced — including the unknown unknowns you would miss on your own.',
  },
  conclusion: {
    num: '06',
    name: 'Conclusion',
    agents: 7,
    definition: 'Multiple genuinely disagreeing conclusions are generated, then scored on evidence, logic, and coverage.',
  },
  implications: {
    num: '07',
    name: 'Implications',
    agents: 6,
    definition: 'Positive, negative, and uncertain consequences are mapped so nothing catches you off guard.',
  },
  stress: {
    num: '08',
    name: 'Stress Test',
    agents: 5,
    definition: 'The weakest layer is attacked. If the house survives, it’s defensible. If not, it tells you where.',
  },
}

const layerOrder: LayerKey[] = ['concepts', 'question', 'perspectives', 'evidence', 'assumptions', 'conclusion', 'implications', 'stress']

export default function InteractiveHouseSection() {
  const [activeLayer, setActiveLayer] = useState<LayerKey>('evidence')
  const def = layerDefs[activeLayer]

  return (
    <section style={{ background: 'var(--parchment)', paddingBlock: 'var(--section-py)' }}>
      <div className="container">
        <div style={{ maxWidth: '60ch' }}>
          <p className="eyebrow">Section 03 &mdash; What gets built</p>
          <h2 className="h2" style={{ marginTop: 16 }}>
            You type one question.
            <br />47 agents build this.
          </h2>
          <p className="body-text" style={{ marginTop: 16 }}>
            Each layer is constructed automatically by a team of specialized AI
            agents, then reviewed against nine intellectual standards. Tap a
            layer to see what it does.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: 'clamp(24px, 4vw, 48px)',
            marginTop: 44,
          }}
        >
          {/* Left — layer list (pipeline) */}
          <div style={{ flex: '1 1 340px', minWidth: 'min(280px, 100%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {layerOrder.map((key, i) => {
                const l = layerDefs[key]
                const isActive = activeLayer === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveLayer(key)}
                    onMouseEnter={() => setActiveLayer(key)}
                    aria-pressed={isActive}
                    aria-label={`${l.name}, layer ${i + 1} of 8`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      background: isActive ? 'var(--white)' : 'transparent',
                      border: isActive ? '1px solid var(--amber)' : '1px solid transparent',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'background 0.15s, border-color 0.15s',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: isActive ? 'var(--amber-text)' : 'var(--ink-subtle)',
                        minWidth: 22,
                      }}
                    >
                      {l.num}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        fontWeight: isActive ? 600 : 400,
                        color: 'var(--ink)',
                        flex: 1,
                      }}
                    >
                      {l.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--ink-subtle)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {l.agents} agents
                    </span>
                  </button>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: '10px 16px',
                borderTop: '1px solid var(--rule)',
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <span>Total agents</span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>47</span>
            </div>
          </div>

          {/* Right — definition card */}
          <div style={{ flex: '1 1 300px', minWidth: 'min(280px, 100%)' }}>
            <div
              aria-live="polite"
              style={{
                background: 'var(--white)',
                border: '1px solid var(--rule)',
                borderRadius: 12,
                padding: 28,
                minHeight: 200,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--amber)',
                    color: 'var(--ink)',
                    borderRadius: 4,
                    minWidth: 26,
                    height: 22,
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    padding: '0 6px',
                  }}
                >
                  {def.num}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--ink-subtle)',
                  }}
                >
                  Layer {def.num} of 08
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 28,
                  marginTop: 16,
                  color: 'var(--ink)',
                }}
              >
                {def.name}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 17,
                  lineHeight: 1.6,
                  color: 'var(--ink-mid)',
                  marginTop: 12,
                }}
              >
                {def.definition}
              </p>
              <div
                style={{
                  marginTop: 20,
                  padding: '10px 14px',
                  background: 'var(--parchment)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" stroke="var(--green-strong)" strokeWidth="1.2" fill="none" />
                  <path d="M5.5 8l2 2 3.5-3.5" stroke="var(--green-strong)" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--green-text)',
                  }}
                >
                  Reviewed by {def.agents} agents against 9 standards
                </span>
              </div>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginTop: 14,
              }}
            >
              Your input: one question &middot; Everything else: automatic
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
