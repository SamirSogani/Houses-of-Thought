// Perspectives Sector deep-dive view: tensions, agreements, missing voices,
// steel-manned arguments, and a stakeholder power/interest map. Read-only —
// this renders an already-generated PerspectivesSectorAnalysis (rendered
// inside SectorShell by Canvas.tsx). Mirrors the card/label idioms of
// components/build/layers/PerspectiveDetail.tsx and PerspectivesLayer.tsx.

import type { PerspectivesSectorAnalysis } from '@/lib/sectors/types'

type Tension = PerspectivesSectorAnalysis['tensions'][number]
type Agreement = PerspectivesSectorAnalysis['agreements'][number]
type MissingVoice = PerspectivesSectorAnalysis['missingVoices'][number]
type SteelMan = PerspectivesSectorAnalysis['steelManned'][number]
type StakeholderEntry = PerspectivesSectorAnalysis['stakeholderMap'][number]

const cardStyle: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--rule)',
  borderRadius: 11,
  padding: '16px 18px',
}

function SectionHeader({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
      <span
        className="mono"
        style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-subtle)' }}
      >
        {children}
      </span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>
        · {count}
      </span>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ ...cardStyle, borderStyle: 'dashed', color: 'var(--ink-subtle)', fontSize: 13 }}>
      {label}
    </div>
  )
}

// ── Tensions ─────────────────────────────────────────────────────────────

const natureColor: Record<Tension['nature'], string> = {
  'value-based': 'var(--warning-text)',
  factual: 'var(--blueprint)',
  priority: 'var(--amber-text)',
  methodological: 'var(--green-text)',
}

function NatureBadge({ nature }: { nature: Tension['nature'] }) {
  const color = natureColor[nature]
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color,
        border: `1px solid ${color}`,
        borderRadius: 10,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {nature}
    </span>
  )
}

function TensionCard({ tension }: { tension: Tension }) {
  const resolvableColor = tension.resolvable ? 'var(--green-text)' : 'var(--warning-text)'
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)', flex: 1, minWidth: 200 }}>
          {tension.perspective1} <span style={{ color: 'var(--ink-subtle)', fontWeight: 400 }}>vs</span> {tension.perspective2}
        </div>
        <NatureBadge nature={tension.nature} />
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 10 }}>{tension.conflictPoint}</p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12 }}>
        <span className="mono" style={{ fontSize: 10, color: resolvableColor, whiteSpace: 'nowrap', marginTop: 1 }}>
          {tension.resolvable ? '✓ Resolvable' : '✗ Unresolved'}
        </span>
        {tension.resolutionPath && (
          <span style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{tension.resolutionPath}</span>
        )}
      </div>
    </div>
  )
}

// ── Agreements ───────────────────────────────────────────────────────────

const strengthColor: Record<Agreement['strength'], string> = {
  strong: 'var(--green-text)',
  moderate: 'var(--amber-text)',
  weak: 'var(--ink-subtle)',
}

function AgreementCard({ agreement }: { agreement: Agreement }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {agreement.perspectives.map((p, i) => (
            <span
              key={i}
              className="mono"
              style={{ fontSize: 10, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 10, padding: '2px 9px' }}
            >
              {p}
            </span>
          ))}
        </div>
        <span
          className="mono"
          style={{
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: strengthColor[agreement.strength],
            border: `1px solid ${strengthColor[agreement.strength]}`,
            borderRadius: 10,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {agreement.strength}
        </span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 10 }}>{agreement.commonGround}</p>
    </div>
  )
}

// ── Missing voices ───────────────────────────────────────────────────────

function MissingVoiceCard({ voice }: { voice: MissingVoice }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>
        {voice.voice}
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5, marginTop: 6 }}>{voice.whyRelevant}</p>
      <div
        style={{
          background: 'var(--parchment)',
          border: '1px solid var(--rule)',
          borderLeft: '3px solid var(--amber)',
          borderRadius: 10,
          padding: '12px 14px',
          marginTop: 12,
          fontSize: 13,
          color: 'var(--ink-mid)',
          lineHeight: 1.55,
        }}
      >
        <div className="mono" style={{ fontSize: 9, color: 'var(--amber-text)', marginBottom: 4 }}>Likely stance</div>
        {voice.likelyStance}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', whiteSpace: 'nowrap', marginTop: 1 }}>
          Impact
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{voice.impactOnConclusion}</span>
      </div>
    </div>
  )
}

// ── Steel-manned arguments ───────────────────────────────────────────────

function SteelManCard({ item }: { item: SteelMan }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>
        {item.perspective}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginTop: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', marginBottom: 5 }}>Original</div>
          <div style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5, fontStyle: 'italic' }}>
            {item.originalStance}
          </div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--green-text)', marginBottom: 5 }}>Strengthened</div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-mid)',
              lineHeight: 1.5,
              background: 'var(--parchment)',
              border: '1px solid var(--rule)',
              borderLeft: '3px solid var(--green-mid)',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {item.strengthened}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', whiteSpace: 'nowrap', marginTop: 1 }}>
          + Evidence
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{item.additionalEvidence}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--blueprint)', whiteSpace: 'nowrap', marginTop: 1 }}>
          Changes
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{item.whatChanges}</span>
      </div>
    </div>
  )
}

// ── Stakeholder map ──────────────────────────────────────────────────────

const levelColor: Record<StakeholderEntry['power'], string> = {
  high: 'var(--warning-text)',
  medium: 'var(--amber-text)',
  low: 'var(--ink-subtle)',
}

function LevelBadge({ level }: { level: StakeholderEntry['power'] }) {
  const color = levelColor[level]
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color,
        background: 'transparent',
        border: `1px solid ${color}`,
        borderRadius: 10,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {level}
    </span>
  )
}

// high-power+high-interest → "Key player", etc. — a quick quadrant read.
function quadrantLabel(power: StakeholderEntry['power'], interest: StakeholderEntry['interest']): string {
  const hiPower = power === 'high'
  const hiInterest = interest === 'high'
  if (hiPower && hiInterest) return 'Key player'
  if (hiPower && !hiInterest) return 'Keep satisfied'
  if (!hiPower && hiInterest) return 'Keep informed'
  return 'Monitor'
}

function StakeholderRow({ entry }: { entry: StakeholderEntry }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.4fr) auto auto minmax(0,2fr)',
        gap: 12,
        alignItems: 'center',
        padding: '11px 14px',
        borderBottom: '1px solid var(--rule-soft)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{entry.perspective}</span>
      <LevelBadge level={entry.power} />
      <LevelBadge level={entry.interest} />
      <span style={{ fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--blueprint)', marginRight: 6 }}>
          {quadrantLabel(entry.power, entry.interest)}
        </span>
        {entry.influence}
      </span>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────

export function PerspectivesSector({ analysis }: { analysis: PerspectivesSectorAnalysis }) {
  return (
    <div className="fade-in">
      {/* Tensions */}
      <section>
        <SectionHeader count={analysis.tensions.length}>Tensions</SectionHeader>
        {analysis.tensions.length === 0 ? (
          <Empty label="No genuine conflicts found between the house's perspectives." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analysis.tensions.map((t, i) => (
              <TensionCard key={i} tension={t} />
            ))}
          </div>
        )}
      </section>

      {/* Agreements */}
      <section style={{ marginTop: 28 }}>
        <SectionHeader count={analysis.agreements.length}>Agreements</SectionHeader>
        {analysis.agreements.length === 0 ? (
          <Empty label="No shared common ground identified across perspectives." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analysis.agreements.map((a, i) => (
              <AgreementCard key={i} agreement={a} />
            ))}
          </div>
        )}
      </section>

      {/* Missing voices */}
      <section style={{ marginTop: 28 }}>
        <SectionHeader count={analysis.missingVoices.length}>Missing voices</SectionHeader>
        {analysis.missingVoices.length === 0 ? (
          <Empty label="No missing voices identified." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {analysis.missingVoices.map((v, i) => (
              <MissingVoiceCard key={i} voice={v} />
            ))}
          </div>
        )}
      </section>

      {/* Steel-manned arguments */}
      <section style={{ marginTop: 28 }}>
        <SectionHeader count={analysis.steelManned.length}>Steel-manned arguments</SectionHeader>
        {analysis.steelManned.length === 0 ? (
          <Empty label="No perspectives needed steel-manning." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analysis.steelManned.map((s, i) => (
              <SteelManCard key={i} item={s} />
            ))}
          </div>
        )}
      </section>

      {/* Stakeholder map */}
      <section style={{ marginTop: 28 }}>
        <SectionHeader count={analysis.stakeholderMap.length}>Stakeholder map</SectionHeader>
        {analysis.stakeholderMap.length === 0 ? (
          <Empty label="No stakeholders mapped." />
        ) : (
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.4fr) auto auto minmax(0,2fr)',
                gap: 12,
                padding: '9px 14px',
                background: 'var(--parchment)',
                borderBottom: '1px solid var(--rule)',
              }}
              className="mono"
            >
              <span style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Perspective</span>
              <span style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Power</span>
              <span style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Interest</span>
              <span style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Influence</span>
            </div>
            {analysis.stakeholderMap.map((entry, i) => (
              <StakeholderRow key={i} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
