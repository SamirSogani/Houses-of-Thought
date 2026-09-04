// Shared shell for sector deep-dive views. Provides a consistent header with
// back navigation, title, description, and a regenerate button. Each sector
// type renders its own content inside this shell.

import { ChevronLeft } from '../buildIcons'
import type { SectorType } from '@/lib/sectors/types'
import { SECTOR_META } from '@/lib/sectors/types'

export function SectorShell({
  sectorType,
  loading,
  error,
  onBack,
  onRegenerate,
  children,
}: {
  sectorType: SectorType
  loading: boolean
  error: string | null
  onBack: () => void
  onRegenerate: () => void
  children: React.ReactNode
}) {
  const meta = SECTOR_META[sectorType]

  return (
    <div className="fade-in" style={{ marginTop: 0 }}>
      {/* Header */}
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--blueprint)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        <ChevronLeft size={14} stroke="var(--blueprint)" />
        Back to house
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--parchment)',
                background: 'var(--blueprint)',
                borderRadius: 4,
                padding: '3px 8px',
              }}
            >
              Sector
            </span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>
              Deep-dive analysis
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 28,
              letterSpacing: '-0.015em',
              color: 'var(--ink)',
              marginTop: 10,
            }}
          >
            {meta.label}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.5, marginTop: 6, maxWidth: '50ch' }}>
            {meta.description}
          </p>
        </div>
        {!loading && !error && (
          <button
            type="button"
            onClick={onRegenerate}
            className="mono"
            style={{
              flexShrink: 0,
              fontSize: 10,
              color: 'var(--ink-subtle)',
              background: 'transparent',
              border: '1px solid var(--rule)',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              marginTop: 10,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--ink)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-subtle)'; e.currentTarget.style.borderColor = 'var(--rule)' }}
          >
            Regenerate
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-subtle)' }}>
          <div className="sector-spinner" style={{ width: 28, height: 28, border: '2.5px solid var(--rule)', borderTopColor: 'var(--blueprint)', borderRadius: '50%', margin: '0 auto 16px', animation: 'sector-spin 0.8s linear infinite' }} />
          <p className="mono" style={{ fontSize: 11 }}>Analyzing{'…'} this takes 15{'–'}30 seconds</p>
          <style>{`@keyframes sector-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ padding: '24px', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 10, marginTop: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 6 }}>Analysis failed</p>
          <p style={{ fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{error}</p>
          <button
            type="button"
            onClick={onRegenerate}
            style={{
              marginTop: 12,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--parchment)',
              background: 'var(--ink)',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Content (rendered by sector-specific component) */}
      {!loading && !error && children}
    </div>
  )
}
