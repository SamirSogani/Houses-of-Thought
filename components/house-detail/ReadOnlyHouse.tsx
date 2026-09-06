// Read-only render of a finished house — the seven-layer mirror of the Build
// workspace (Frame, Perspectives, Evidence, Assumptions, Conclusion,
// Implications, House Strength), minus the edit controls. Extracted from
// app/examples/[slug]/page.tsx (plans/active/persistence/invite-share-panels.md,
// Mechanism 2 step 4) so the exact same render serves two callers:
//   - /examples/[slug]  — curated marketing fixtures (lib/examples/data.ts),
//     which pass `detail` (hand-authored copy keyed by perspective id, richer
//     than a fixture's own thin Perspective fields).
//   - /shared/[token]    — real user houses (app/api/shared/[token]/route.ts),
//     which never pass `detail` — a saved house's own Perspective fields
//     (stance/subQuestions/supportingEvidence/counters) already carry
//     whatever detail the owner wrote, so the per-perspective fallback below
//     reads directly from `p`.
//
// `detail` stays optional and is tried FIRST specifically so /examples keeps
// rendering byte-for-byte identically to before this extraction.

import { Avatar } from '@/components/build/Avatar'
import { layers, axisMeasures, type PerspectiveDetail } from '@/lib/build/content'
import { people } from '@/lib/build/people'
import { safeHttpUrl } from '@/lib/safeUrl'
import type { Assumption, Evidence, Implication, Perspective, State } from '@/lib/build/types'
import {
  computeStrength,
  strengthColor,
  axisLabel,
  overallLabel,
  overallSummary,
  color as barColor,
} from '@/lib/build/strength'

export const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  color: 'var(--ink-subtle)',
}

const card: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 11,
  padding: '14px 16px',
}

const sourceChip: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  color: 'var(--blueprint)',
  background: 'rgba(62,92,138,0.09)',
  borderRadius: 4,
  padding: '3px 7px',
}

// A real house's `conclusion` is one free-text field (builder textarea); the
// curated /examples fixtures instead hand-author it as separate bullet
// strings. Splitting on blank lines mirrors how the canonical demo house's own
// single-string conclusion was built in the first place (state.ts joins its
// bullets with '\n\n'), so a real house's paragraphs round-trip into the same
// bullet-block layout this render expects.
export function splitConclusion(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface ReadOnlyHouseProps {
  house: State
  purpose: string
  conclusion: string[]
  reasoning: string
  // Legacy side-channel for the /examples fixtures only — see module comment.
  detail?: Record<number, PerspectiveDetail>
}

export function ReadOnlyHouse({ house: h, purpose, conclusion, reasoning, detail }: ReadOnlyHouseProps) {
  const s = computeStrength(h)
  const implTotal = h.pos.length + h.neg.length + h.unc.length

  return (
    <article style={{ flex: '999 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(30px, 4vw, 48px)' }}>
      {/* Layer 1 — Frame */}
      <LayerSection id="frame" step={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={monoLabel}>Purpose</div>
            <div style={{ ...card, marginTop: 8, fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.55 }}>{purpose}</div>
          </div>
          <div>
            <div style={monoLabel}>Overarching question</div>
            <div style={{ ...card, marginTop: 8, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)' }}>{h.title}</div>
          </div>
          <div>
            <div style={monoLabel}>Key concepts</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {h.concepts.map((c, i) => (
                <span key={`${c.term}-${i}`} style={{ fontSize: 13, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 20, padding: '7px 14px' }}>
                  {c.term}
                </span>
              ))}
            </div>
          </div>
        </div>
      </LayerSection>

      {/* Layer 2 — Perspectives */}
      <LayerSection id="perspectives" step={2}>
        <div style={monoLabel}>{h.perspectives.length} perspectives</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
          {h.perspectives.map((p) => (
            <PerspectiveBlock key={p.id} p={p} detail={detail?.[p.id]} />
          ))}
        </div>
      </LayerSection>

      {/* Layer 3 — Evidence */}
      <LayerSection id="evidence" step={3}>
        <div style={monoLabel}>{h.evidence.length} sourced facts</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {h.evidence.map((e) => (
            <EvidenceRow key={e.id} e={e} />
          ))}
        </div>
      </LayerSection>

      {/* Layer 4 — Assumptions */}
      <LayerSection id="assumptions" step={4}>
        <div style={monoLabel}>{h.assumptions.length} foundational assumptions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          {h.assumptions.map((a, i) => (
            <AssumptionRow key={a.id} a={a} index={i} />
          ))}
        </div>
      </LayerSection>

      {/* Layer 5 — Conclusion */}
      <LayerSection id="conclusion" step={5}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={monoLabel}>Central conclusion</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {conclusion.map((b, i) => (
                <div key={i} style={{ ...card, borderRadius: 10, fontSize: 14, color: 'var(--ink)' }}>{b}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={monoLabel}>Reasoning summary</div>
            <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--amber)', borderRadius: 10, padding: '15px 18px', marginTop: 8, fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.65 }}>
              {reasoning}
            </div>
          </div>
        </div>
      </LayerSection>

      {/* Layer 6 — Implications */}
      <LayerSection id="implications" step={6}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 20, padding: '5px 11px' }}>
            {implTotal} implications mapped
          </span>
          <span style={{ fontSize: 14, color: 'var(--ink-subtle)' }}>Sorted by register and tagged with time horizon and who it lands on.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 16 }}>
          <ImplicationColumn label="Positive" items={h.pos} accent="var(--green-strong)" />
          <ImplicationColumn label="Negative" items={h.neg} accent="var(--warning)" />
          <ImplicationColumn label="Uncertain" items={h.unc} accent="var(--green-mid)" />
        </div>
        {h.watchpoints.length > 0 && (
          <div style={{ marginTop: 22, background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px' }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mid)' }}>Signals to watch · would change the conclusion</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {h.watchpoints.map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--warning-text)', marginRight: 8 }}>→</span>
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}
      </LayerSection>

      {/* Layer 7 — House strength */}
      <LayerSection id="strength" step={7}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 14, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 56, color: strengthColor(s.overall), lineHeight: 1 }}>{s.overall}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>/ 100</span>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <span className="mono" style={{ fontSize: 10, color: strengthColor(s.overall), border: `1px solid ${strengthColor(s.overall)}`, borderRadius: 5, padding: '3px 9px' }}>
              {overallLabel(s.overall)}
            </span>
            <div style={{ fontSize: 15, color: 'var(--ink-mid)', marginTop: 11, lineHeight: 1.55 }}>{overallSummary(s.overall)}</div>
          </div>
        </div>
        <div style={{ ...monoLabel, margin: '22px 0 12px' }}>The three scores</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AxisRow name="Evidence" score={s.evidence} measures={axisMeasures.Evidence} driver={`${h.evidence.length} sourced facts`} />
          <AxisRow name="Logic" score={s.logic} measures={axisMeasures.Logic} driver={`${h.assumptions.length} assumptions, ${h.conclusion?.length ? 'conclusion set' : 'no conclusion'}, ${implTotal} implications`} />
          <AxisRow name="Coverage" score={s.coverage} measures={axisMeasures.Coverage} driver={`${h.perspectives.length} perspectives`} />
        </div>
        <div style={{ marginTop: 14, background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>How the overall is weighted</span>
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>
            Evidence <strong>40%</strong> · Logic <strong>35%</strong> · Coverage <strong>25%</strong>
          </span>
        </div>
      </LayerSection>
    </article>
  )
}

function LayerSection({ id, step, children }: { id: string; step: number; children: React.ReactNode }) {
  const layer = layers[step - 1]
  return (
    <section id={id} style={{ scrollMarginTop: 84 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--amber-text)' }}>Layer {step} / 7</span>
        <span style={{ width: 16, height: 1, background: 'var(--rule)' }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>{layer.kicker}</span>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(22px, 2.8vw, 30px)', letterSpacing: '-0.015em', color: 'var(--ink)', marginTop: 10 }}>
        {layer.title}
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 8, marginBottom: 18, maxWidth: '60ch' }}>{layer.blurb}</p>
      {children}
    </section>
  )
}

function PerspectiveBlock({ p, detail }: { p: Perspective; detail?: PerspectiveDetail }) {
  const owner = people[p.owner]
  const col = barColor(p.strength)
  // detail (examples-only) wins when present; otherwise fall back to the
  // perspective's own fields — what a real, saved house actually carries.
  const stance = detail?.stance ?? (p.stance || p.summary)
  const questions = detail?.questions ?? p.subQuestions
  const evidenceItems: { text: string; source: string; url?: string }[] = detail?.evidence ?? p.supportingEvidence
  const counters = detail?.counters ?? p.counters
  return (
    <div style={{ ...card, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>{p.name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Avatar who={p.owner} size={22} />
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>{owner.name}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 52, height: 5, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${p.strength}%`, background: col }} />
            </span>
            <span className="mono" style={{ fontSize: 10, color: col }}>{p.strength}</span>
          </span>
        </span>
      </div>

      <p style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 10 }}>{stance}</p>

      {questions.length > 0 && (
        <>
          <div style={{ ...monoLabel, margin: '18px 0 10px' }}>Sub-questions · {questions.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{q.q}</div>
                <div style={{ marginTop: 7, fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.55 }}>{q.note}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {evidenceItems.length > 0 && (
        <>
          <div style={{ ...monoLabel, margin: '18px 0 10px' }}>Supporting evidence</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {evidenceItems.map((e, i) => {
              const href = e.url ? safeHttpUrl(e.url) : null
              return (
                <div key={i} style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{e.text}</div>
                  <div style={{ marginTop: 7 }}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...sourceChip, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                        {e.source} ↗
                      </a>
                    ) : (
                      <span style={sourceChip}>{e.source}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {counters.length > 0 && (
        <>
          <div style={{ ...monoLabel, margin: '18px 0 10px', color: 'var(--warning-text)' }}>Counterarguments</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {counters.map((c, i) => (
              <div key={i} style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--warning)', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
                {c}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EvidenceRow({ e }: { e: Evidence }) {
  const href = e.url ? safeHttpUrl(e.url) : null
  return (
    <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Avatar who={e.owner} size={24} title={people[e.owner].name} />
      <div>
        <div style={{ fontSize: 14, color: 'var(--ink)' }}>{e.text}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...sourceChip, textDecoration: 'underline', textUnderlineOffset: 2 }}>
              {e.source} ↗
            </a>
          ) : (
            <span style={sourceChip}>{e.source}</span>
          )}
          {e.byAI && <span className="mono" style={{ fontSize: 9, color: 'var(--amber-text)' }}>via Research Mode</span>}
        </div>
      </div>
    </div>
  )
}

function AssumptionRow({ a, index }: { a: Assumption; index: number }) {
  return (
    <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center' }}>
      <span className="mono" style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--rule)', borderRadius: 6, fontSize: 9, color: 'var(--ink-subtle)', flex: '0 0 auto' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1 }}>{a.text}</span>
      <Avatar who={a.owner} size={22} />
    </div>
  )
}

function ImplicationColumn({ label, items, accent }: { label: string; items: Implication[]; accent: string }) {
  const metaChip: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.11em',
    color: 'var(--ink-subtle)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    padding: '2px 6px',
  }
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderTop: `3px solid ${accent}`, borderRadius: 11, padding: 15 }}>
      <span className="mono" style={{ fontSize: 10, color: accent }}>{label} · {items.length}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {items.length === 0 && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>None recorded.</span>}
        {items.map((it) => (
          <div key={it.id} style={{ border: '1px solid var(--rule-soft)', borderRadius: 9, padding: '11px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>{it.text}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={metaChip}>{it.horizon}</span>
              <span style={metaChip}>{it.who}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AxisRow({ name, score, measures, driver }: { name: string; score: number; measures: string; driver: string }) {
  const col = strengthColor(score)
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>{name}</span>
          <span className="mono" style={{ fontSize: 9, color: col, border: `1px solid ${col}`, borderRadius: 5, padding: '2px 9px' }}>{axisLabel(score)}</span>
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, color: col }}>{score}</span>
      </div>
      <div style={{ height: 7, background: 'var(--rule)', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
        <div style={{ height: '100%', width: `${score}%`, background: col }} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-mid)', marginTop: 12, lineHeight: 1.5 }}>{measures}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>Driving this score</span>
        <span style={{ fontSize: 12, color: 'var(--ink)' }}>{driver}</span>
      </div>
    </div>
  )
}
