// What's-new drawer. See handoff 05 §15 / 04 §12 / 07 §5.

import { useEffect } from 'react'
import type { Action } from '@/lib/build/types'
import { XIcon } from '@/components/icons'
import { changeCards } from '@/lib/build/content'

export function WhatsNewDrawer({ dispatch }: { dispatch: React.Dispatch<Action> }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dispatch({ type: 'CLOSE_NOTES' })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dispatch])

  return (
    <div
      onClick={() => dispatch({ type: 'CLOSE_NOTES' })}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(20,33,58,0.42)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        className="fade-in build-scroll"
        role="dialog"
        aria-modal="true"
        aria-label="What changed, and why"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, maxWidth: '100%', height: '100%', background: 'var(--parchment)', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,33,58,0.24)' }}
      >
        <div style={{ position: 'sticky', top: 0, background: 'var(--parchment)', borderBottom: '1px solid var(--rule)', padding: '22px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--amber-hover)' }}>Design rationale</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)', marginTop: 4 }}>What changed, and why</div>
          </div>
          <button type="button" aria-label="Close" onClick={() => dispatch({ type: 'CLOSE_NOTES' })} style={{ width: 32, height: 32, border: '1px solid var(--rule)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <XIcon size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 26px calc(40px + env(safe-area-inset-bottom))' }}>
          {changeCards.map((c, i) => (
            <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--amber-hover)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17, color: 'var(--ink)' }}>{c.title}</span>
              </div>
              <div className="bhp-oldnew" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, background: 'var(--parchment)', borderRadius: 8, padding: 10 }}>
                  <div className="mono" style={{ fontSize: 8, color: 'var(--warning)' }}>Old</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mid)', marginTop: 4, lineHeight: 1.45 }}>{c.old}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--amber-tint)', borderRadius: 8, padding: 10 }}>
                  <div className="mono" style={{ fontSize: 8, color: 'var(--amber-hover)' }}>New</div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 4, lineHeight: 1.45 }}>{c.next}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
