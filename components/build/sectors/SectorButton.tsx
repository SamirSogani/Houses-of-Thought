// "Analyze deeper" trigger button, placed at the top of eligible layers
// (Implications, Perspectives). Shows sector status when a deep-dive exists.

import type { SectorType, SectorRow } from '@/lib/sectors/types'

export function SectorButton({
  sectorType,
  sector,
  generating,
  onClick,
}: {
  sectorType: SectorType
  sector: SectorRow | undefined
  generating: boolean
  onClick: () => void
}) {
  const hasFindings = sector?.status === 'complete' && Array.isArray(sector.findings) && sector.findings.length > 0
  const label = sector?.status === 'complete' ? 'View deep-dive' : generating ? 'Analyzing…' : 'Analyze deeper'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={generating}
      aria-label={`${label} — ${sectorType}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: generating ? 'var(--ink-subtle)' : 'var(--blueprint)',
        background: 'var(--white)',
        border: `1px solid ${generating ? 'var(--rule)' : 'var(--blueprint)'}`,
        borderRadius: 8,
        padding: '8px 14px',
        cursor: generating ? 'default' : 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!generating) {
          e.currentTarget.style.background = 'var(--blueprint)'
          e.currentTarget.style.color = 'var(--parchment)'
        }
      }}
      onMouseLeave={(e) => {
        if (!generating) {
          e.currentTarget.style.background = 'var(--white)'
          e.currentTarget.style.color = 'var(--blueprint)'
        }
      }}
    >
      {generating ? (
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            border: '1.5px solid var(--rule)',
            borderTopColor: 'var(--blueprint)',
            borderRadius: '50%',
            animation: 'sector-spin 0.8s linear infinite',
          }}
        />
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v6M5 8h6" />
        </svg>
      )}
      {label}
      {hasFindings && (
        <span
          className="mono"
          style={{
            fontSize: 9,
            color: 'var(--blueprint)',
            background: 'color-mix(in srgb, var(--blueprint) 12%, transparent)',
            borderRadius: 10,
            padding: '1px 6px',
          }}
        >
          {sector!.findings!.length} finding{sector!.findings!.length > 1 ? 's' : ''}
        </span>
      )}
    </button>
  )
}
