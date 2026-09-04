// Findings badge + inline banner for sector deep-dive results. Two exports:
// - FindingsBadge: compact pill for the BlueprintRail layer buttons
// - FindingsBanner: expandable banner at the top of a layer's canvas view

import { useState } from 'react'
import type { SectorFinding } from '@/lib/sectors/types'

const severityColor: Record<SectorFinding['severity'], string> = {
  insight: 'var(--blueprint)',
  warning: 'var(--amber-text)',
  critical: 'var(--warning-text)',
}

const severityIcon: Record<SectorFinding['severity'], string> = {
  insight: '◆',
  warning: '▲',
  critical: '●',
}

export function FindingsBadge({ findings }: { findings: SectorFinding[] }) {
  if (findings.length === 0) return null
  const worst = findings.reduce((w, f) =>
    f.severity === 'critical' ? 'critical' : f.severity === 'warning' && w !== 'critical' ? 'warning' : w,
    'insight' as SectorFinding['severity']
  )
  return (
    <span
      title={`${findings.length} sector finding${findings.length > 1 ? 's' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        color: severityColor[worst],
        background: 'transparent',
        border: `1px solid ${severityColor[worst]}`,
        borderRadius: 10,
        padding: '1px 6px',
        lineHeight: 1.4,
      }}
    >
      {severityIcon[worst]} {findings.length}
    </span>
  )
}

export function FindingsBanner({
  findings,
  sectorLabel,
  onOpenSector,
}: {
  findings: SectorFinding[]
  sectorLabel: string
  onOpenSector: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (findings.length === 0) return null

  return (
    <div
      style={{
        marginTop: 16,
        marginBottom: 8,
        background: 'var(--white)',
        border: '1px solid var(--blueprint)',
        borderLeft: '3px solid var(--blueprint)',
        borderRadius: 8,
        padding: '10px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          {findings.length} finding{findings.length > 1 ? 's' : ''} from {sectorLabel}
        </button>
        <button
          type="button"
          onClick={onOpenSector}
          className="mono"
          style={{
            fontSize: 9,
            color: 'var(--blueprint)',
            background: 'transparent',
            border: '1px solid var(--blueprint)',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          Open sector
        </button>
      </div>
      {expanded && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {findings.map((f, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.5, padding: '4px 0' }}>
              <span style={{ color: severityColor[f.severity], flexShrink: 0, fontSize: 10, marginTop: 2 }}>{severityIcon[f.severity]}</span>
              {f.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
