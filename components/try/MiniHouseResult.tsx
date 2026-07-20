'use client'

import Link from 'next/link'
import { ArrowIcon, CheckIcon, XIcon, CompassIcon, HeartIcon, TrendingUpIcon } from '@/components/icons'
import type { MiniHouse } from '@/lib/ai/mini-house'
import Fade from './Fade'

// Accent + icon per fixed perspective position (Practical/Logical, Emotional/
// Personal, Long-Term/Strategic) — one of the brand's secondary hues each, used
// only as a thin top rule + label color (amber stays the action color elsewhere).
const POV_ACCENT = ['var(--green-text)', 'var(--warning-text)', 'var(--amber-text)']
const POV_ICON = [CompassIcon, HeartIcon, TrendingUpIcon]

const READING_MAX = 980

export default function MiniHouseResult({
  miniHouse,
  originalQuestion,
  onTryAnother,
}: {
  miniHouse: MiniHouse
  originalQuestion: string
  onTryAnother: () => void
}) {
  const { restated_question, perspectives, assumptions, evidence, synthesis } = miniHouse

  return (
    <div style={{ padding: 'clamp(32px, 6vw, 64px) 0 0' }}>
      <div className="container">
        <div style={{ maxWidth: READING_MAX, margin: '0 auto' }}>
          {/* Heading */}
          <Fade delay={0}>
            <p className="eyebrow-amber">Mini House · complete</p>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(28px, 4vw, 44px)',
                lineHeight: 1.12,
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
                marginTop: 14,
              }}
            >
              {restated_question}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontStyle: 'italic',
                fontSize: 15,
                color: 'var(--ink-subtle)',
                marginTop: 12,
              }}
            >
              Originally asked: &ldquo;{originalQuestion}&rdquo;
            </p>
          </Fade>

          {/* 01 · Three perspectives */}
          <Fade delay={200}>
            <SectionHead num="01" label="Three perspectives" sub="Looked at from three angles" />
            <div className="mh-cols-3">
              {perspectives.map((p, i) => {
                const PovIcon = POV_ICON[i]
                return (
                  <article key={i} style={card(POV_ACCENT[i])}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ color: POV_ACCENT[i], display: 'flex' }}>
                        <PovIcon size={15} />
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: POV_ACCENT[i] }}>
                        {p.title}
                      </span>
                    </span>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontStyle: 'italic',
                        fontSize: 14.5,
                        lineHeight: 1.55,
                        color: 'var(--ink-mid)',
                        marginBottom: 16,
                      }}
                    >
                      {p.summary}
                    </p>
                    {p.sub_questions.map((sq, j) => (
                      <div key={j} style={{ marginTop: j === 0 ? 0 : 16 }}>
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 14.5,
                            fontWeight: 600,
                            color: 'var(--ink)',
                            marginBottom: 6,
                          }}
                        >
                          Q. {sq.question}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-mid)' }}>
                          {sq.answer}
                        </p>
                      </div>
                    ))}
                  </article>
                )
              })}
            </div>
          </Fade>

          {/* 02 · Sub-conclusions */}
          <Fade delay={400}>
            <SectionHead num="02" label="Sub-conclusions" sub="What each perspective concludes — on its own" />
            <div className="mh-cols-3">
              {perspectives.map((p, i) => (
                <article key={i} style={{ ...card(POV_ACCENT[i]), background: 'var(--parchment)' }}>
                  <p className="mono" style={{ fontSize: 11, color: POV_ACCENT[i], marginBottom: 10 }}>
                    {p.title} concludes
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-mid)' }}>
                    {p.sub_conclusion}
                  </p>
                </article>
              ))}
            </div>
          </Fade>

          {/* 03 · Assumptions */}
          <Fade delay={600}>
            <SectionHead num="03" label="Assumptions" sub="What you're quietly taking for granted" />
            <div className="mh-cols-3">
              {assumptions.map((a, i) => (
                <article
                  key={i}
                  style={{
                    border: '1px solid var(--rule-soft)',
                    borderRadius: 'var(--radius-card)',
                    background: 'var(--amber-tint)',
                    padding: '20px 22px',
                  }}
                >
                  <p className="mono" style={{ fontSize: 11, color: 'var(--green-mid)', marginBottom: 10 }}>
                    {a.type} assumption
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-mid)' }}>
                    {a.text}
                  </p>
                </article>
              ))}
            </div>
          </Fade>

          {/* 04 · Evidence */}
          <Fade delay={800}>
            <SectionHead
              num="04"
              label="Evidence"
              sub={evidence.length > 0 ? `${evidence.length} thing${evidence.length === 1 ? '' : 's'} worth knowing` : 'Sourced from live search'}
            />
            {evidence.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-subtle)', lineHeight: 1.6 }}>
                No sourced evidence surfaced for this question in the quick pass. A full House runs deeper,
                cited research with real citations.
              </p>
            ) : (
              <div style={{ border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius-card)', background: 'var(--white)', overflow: 'hidden' }}>
                {evidence.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 16,
                      padding: '18px 22px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--rule-soft)',
                    }}
                  >
                    <span className="mono" style={{ fontSize: 12, color: 'var(--amber-text)', flexShrink: 0, paddingTop: 2 }}>
                      E.{String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink)' }}>
                        {e.summary}
                      </p>
                      <p
                        style={{
                          marginTop: 6,
                          fontFamily: 'var(--font-body)',
                          fontStyle: 'italic',
                          fontSize: 13,
                          color: 'var(--ink-subtle)',
                        }}
                      >
                        {e.mla_citation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Fade>

          {/* 05 · Synthesis */}
          <Fade delay={1000}>
            <SectionHead num="05" label="Synthesis" sub="Pulling it together" />
            <article
              style={{
                border: '1px solid var(--rule)',
                borderLeft: '3px solid var(--blueprint)',
                borderRadius: 'var(--radius-card)',
                background: 'var(--white)',
                padding: 'clamp(22px, 3vw, 32px)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16.5, lineHeight: 1.7, color: 'var(--ink-mid)' }}>
                {synthesis.final_take}
              </p>

              <div style={{ height: 1, background: 'var(--rule-soft)', margin: '24px 0' }} />

              <div className="mh-synth-grid">
                <div>
                  <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', marginBottom: 12 }}>
                    Key tradeoffs
                  </p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {synthesis.key_tradeoffs.map((t, i) => (
                      <li
                        key={i}
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 14.5,
                          lineHeight: 1.55,
                          color: 'var(--ink-mid)',
                          paddingLeft: 16,
                          position: 'relative',
                        }}
                      >
                        <span style={{ position: 'absolute', left: 0, color: 'var(--amber-text)' }}>—</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', marginBottom: 12 }}>
                    Strongest tension
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-mid)' }}>
                    {synthesis.strongest_tension}
                  </p>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--rule-soft)', margin: '24px 0' }} />

              <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', marginBottom: 12 }}>
                Sit with this
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 'clamp(19px, 2.4vw, 24px)',
                  lineHeight: 1.35,
                  color: 'var(--ink)',
                }}
              >
                {synthesis.reflective_question}
              </p>
            </article>
          </Fade>

          {/* Conversion CTA */}
          <Fade delay={1200}>
            <ConversionBlock originalQuestion={originalQuestion} onTryAnother={onTryAnother} />
          </Fade>
        </div>
      </div>
    </div>
  )
}

// ── Conversion block + comparison ───────────────────────────────────────────
function ConversionBlock({ originalQuestion, onTryAnother }: { originalQuestion: string; onTryAnother: () => void }) {
  const signupHref = `/login?mode=signup&q=${encodeURIComponent(originalQuestion)}`
  return (
    <section style={{ margin: 'clamp(48px, 8vw, 80px) 0 clamp(48px, 8vw, 88px)' }}>
      <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto' }}>
        <p className="mono" style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>
          Your Mini House is complete
        </p>
        <h2 className="h2" style={{ marginTop: 12 }}>
          This was the compressed version.
        </h2>
        <p className="body-text" style={{ marginTop: 14 }}>
          Create a free account to save your work, build full Houses with deeper analysis, and unlock
          the AI tools that actually stress-test your reasoning.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
          <Link href={signupHref} className="btn-primary">
            Create free account
            <ArrowIcon />
          </Link>
          <button type="button" onClick={onTryAnother} className="btn-secondary">
            Try another question
          </button>
        </div>
        <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', marginTop: 18 }}>
          Mini House results aren&rsquo;t saved. Create an account to keep them.
        </p>
      </div>

      <div className="mh-compare">
        {/* What you just saw */}
        <div style={{ border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius-card)', background: 'var(--white)', padding: 'clamp(22px, 3vw, 30px)' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>
            What you just saw
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--ink)', margin: '8px 0 18px' }}>
            Mini House
          </p>
          <CompareList
            items={[
              { text: '3 perspectives', ok: true },
              { text: '6 sub-questions', ok: true },
              { text: '3 assumptions', ok: true },
              { text: 'Sourced evidence', ok: true },
              { text: 'Single synthesis', ok: true },
              { text: 'Not saved anywhere', ok: false },
            ]}
          />
        </div>

        {/* With a free account */}
        <div style={{ border: '1px solid var(--amber)', borderRadius: 'var(--radius-card)', background: 'var(--white)', padding: 'clamp(22px, 3vw, 30px)', boxShadow: '0 8px 24px rgba(20,33,58,.08)' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--amber-text)' }}>
            With a free account
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--ink)', margin: '8px 0 18px' }}>
            Full Houses of Thought
          </p>
          <CompareList
            items={[
              { text: 'Unlimited perspectives, fully customizable', ok: true },
              { text: 'Dozens of sub-questions, each with sub-conclusions', ok: true },
              { text: 'Full assumption taxonomy (unknown unknowns, foundational, evidence→inference)', ok: true },
              { text: 'Researched evidence with real Brave Search citations', ok: true },
              { text: 'AI co-pilot that challenges your reasoning', ok: true },
              { text: 'House Strength score + reasoning stress tests', ok: true },
              { text: 'Every house autosaved to your dashboard', ok: true },
            ]}
          />
        </div>
      </div>
    </section>
  )
}

function CompareList({ items }: { items: { text: string; ok: boolean }[] }) {
  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{it.ok ? <CheckIcon size={18} /> : <XIcon size={18} />}</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink-mid)' }}>
            {it.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── shared bits ─────────────────────────────────────────────────────────────
function SectionHead({ num, label, sub }: { num: string; label: string; sub: string }) {
  return (
    <div style={{ margin: 'clamp(40px, 6vw, 64px) 0 22px' }}>
      <p className="mono" style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>
        {num} · {label}
      </p>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(22px, 3vw, 30px)',
          lineHeight: 1.2,
          color: 'var(--ink)',
          marginTop: 8,
        }}
      >
        {sub}
      </h2>
    </div>
  )
}

function card(accent: string): React.CSSProperties {
  return {
    border: '1px solid var(--rule-soft)',
    borderTop: `3px solid ${accent}`,
    borderRadius: 'var(--radius-card)',
    background: 'var(--white)',
    padding: '22px 22px 24px',
  }
}
