// Implications Sector deep-dive view: causal chains, timeline, scenarios, and
// interaction effects for a house's implications layer. Rendered as the
// `children` of SectorShell (see SectorShell.tsx) once generation completes.

import type { ImplicationsSectorAnalysis } from '@/lib/sectors/types'

type Likelihood = 'likely' | 'possible' | 'unlikely'
type Nature = 'amplifying' | 'canceling' | 'neutral'
type Kind = 'pos' | 'neg' | 'unc'

const likelihoodColor: Record<Likelihood, string> = {
  likely: 'var(--green-text)',
  possible: 'var(--amber-text)',
  unlikely: 'var(--ink-subtle)',
}

const natureColor: Record<Nature, string> = {
  amplifying: 'var(--green-text)',
  canceling: 'var(--warning-text)',
  neutral: 'var(--ink-subtle)',
}

const kindColor: Record<Kind, string> = {
  pos: 'var(--green-text)',
  neg: 'var(--warning-text)',
  unc: 'var(--ink-subtle)',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 11,
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-mid)',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 9,
        letterSpacing: '0.06em',
        color,
        border: `1px solid ${color}`,
        borderRadius: 10,
        padding: '1px 7px',
        lineHeight: 1.5,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--ink-subtle)', fontStyle: 'italic', padding: '4px 0' }}>{children}</p>
  )
}

// ── Causal chains ────────────────────────────────────────────────────────

function CausalChains({ chains }: { chains: ImplicationsSectorAnalysis['causalChains'] }) {
  return (
    <section>
      <SectionHeader>Causal chains</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chains.map((chain, i) => (
          <div key={i} style={{ ...cardStyle, padding: '14px 16px' }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{chain.trigger}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingLeft: 16, borderLeft: '2px solid var(--rule-soft)' }}>
              {chain.secondOrder.map((effect, j) => (
                <div key={j}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: 'var(--ink-subtle)', fontSize: 13, flexShrink: 0 }}>→</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{effect.text}</span>
                    <Badge label={effect.likelihood} color={likelihoodColor[effect.likelihood]} />
                  </div>

                  {chain.thirdOrder.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, paddingLeft: 22, borderLeft: '2px solid var(--rule-soft)' }}>
                      {chain.thirdOrder.map((effect3, k) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: 'var(--ink-subtle)', fontSize: 12, flexShrink: 0 }}>→</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{effect3.text}</span>
                          <Badge label={effect3.likelihood} color={likelihoodColor[effect3.likelihood]} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Timeline ─────────────────────────────────────────────────────────────

const timelineBands: { key: keyof ImplicationsSectorAnalysis['timeline']; label: string; accent: string }[] = [
  { key: 'shortTerm', label: 'Short-term · 0–6mo', accent: 'var(--blueprint)' },
  { key: 'mediumTerm', label: 'Medium-term · 6–24mo', accent: 'var(--amber-text)' },
  { key: 'longTerm', label: 'Long-term · 2yr+', accent: 'var(--green-text)' },
]

function Timeline({ timeline }: { timeline: ImplicationsSectorAnalysis['timeline'] }) {
  return (
    <section>
      <SectionHeader>Timeline</SectionHeader>
      <div className="bhp-impl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {timelineBands.map(({ key, label, accent }) => {
          const items = timeline[key]
          return (
            <div key={key} style={{ ...cardStyle, borderTop: `3px solid ${accent}`, padding: 14 }}>
              <span className="mono" style={{ fontSize: 9.5, color: accent }}>{label}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
                {items.length === 0 ? (
                  <EmptyNote>No effects surfaced in this window.</EmptyNote>
                ) : (
                  items.map((item, i) => (
                    <div key={i} style={{ border: '1px solid var(--rule-soft)', borderRadius: 8, padding: '9px 10px' }}>
                      <p style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>{item.text}</p>
                      <span className="mono" style={{ display: 'inline-block', marginTop: 6, fontSize: 9, color: 'var(--ink-subtle)' }}>
                        {item.timeframe}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Scenarios ────────────────────────────────────────────────────────────

function Scenarios({ scenarios }: { scenarios: ImplicationsSectorAnalysis['scenarios'] }) {
  return (
    <section>
      <SectionHeader>Scenarios</SectionHeader>
      <div className="bhp-impl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {scenarios.map((scenario, i) => (
          <div key={i} style={{ ...cardStyle, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{scenario.name}</p>
              <Badge label={scenario.likelihood} color={likelihoodColor[scenario.likelihood]} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', fontStyle: 'italic', lineHeight: 1.5, marginTop: 6 }}>
              {scenario.condition}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {scenario.implications.map((impl, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: kindColor[impl.kind],
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{impl.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Interactions ─────────────────────────────────────────────────────────

function Interactions({ interactions }: { interactions: ImplicationsSectorAnalysis['interactions'] }) {
  return (
    <section>
      <SectionHeader>Interaction effects</SectionHeader>
      {interactions.length === 0 ? (
        <EmptyNote>No notable interactions between implications surfaced.</EmptyNote>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {interactions.map((interaction, i) => (
            <div key={i} style={{ ...cardStyle, padding: '13px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink)' }}>
                  <span style={{ fontWeight: 600 }}>{interaction.pair[0]}</span>
                  <span style={{ color: 'var(--ink-subtle)' }}>×</span>
                  <span style={{ fontWeight: 600 }}>{interaction.pair[1]}</span>
                </div>
                <Badge label={interaction.nature} color={natureColor[interaction.nature]} />
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-mid)', lineHeight: 1.5, marginTop: 8 }}>{interaction.effect}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────

export function ImplicationsSector({ analysis }: { analysis: ImplicationsSectorAnalysis }) {
  return (
    <div className="fade-in">
      <CausalChains chains={analysis.causalChains} />
      <div style={{ marginTop: 28 }}>
        <Timeline timeline={analysis.timeline} />
      </div>
      <div style={{ marginTop: 28 }}>
        <Scenarios scenarios={analysis.scenarios} />
      </div>
      <div style={{ marginTop: 28 }}>
        <Interactions interactions={analysis.interactions} />
      </div>
    </div>
  )
}
