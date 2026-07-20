'use client'

// Right rail (Co-pilot), in two shells that share the panel body: the fixed
// 320px desktop aside, and a slide-over drawer for <1024px (opened from the
// floating Co-pilot button in BuildHousePage). Only one shell is ever mounted,
// so CopilotPanel never fetches twice. The old Team tab (fake presence + an
// inert Invite button) was removed until collaboration actually exists —
// audit 2026-07-19, ai-slop §2.

import { useEffect } from 'react'
import type { Action, State } from '@/lib/build/types'
import { XIcon } from '@/components/icons'
import { useFocusTrap } from '@/components/useFocusTrap'
import { CopilotPanel, type SuggestCache } from './rail/CopilotPanel'
import type { InterviewSession } from './rail/InterviewCard'

function RailHeader() {
  return (
    <div
      style={{
        padding: '10px 16px 12px',
        fontWeight: 600,
        fontSize: 13,
        color: 'var(--ink)',
        borderBottom: '1px solid var(--rule)',
      }}
    >
      Co-pilot
    </div>
  )
}

export function RightRail({
  state,
  dispatch,
  draftCard,
  suggestCache,
  interview,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // Draft Mode card, created in BuildHousePage (where its runner lives).
  draftCard?: React.ReactNode
  // Suggestion cache + interview session, also owned by BuildHousePage so they
  // survive this shell unmounting (tab switch / mobile drawer).
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
}) {
  return (
    <aside className="bhp-right-rail" style={{ flex: '0 0 320px', background: 'var(--white)', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <RailHeader />
      <div className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px' }}>
        <CopilotPanel state={state} dispatch={dispatch} draftCard={draftCard} suggestCache={suggestCache} interview={interview} />
      </div>
    </aside>
  )
}

// Mobile (<1024px) shell: scrim + right slide-over holding the same panel.
export function MobileRailDrawer({
  state,
  dispatch,
  draftCard,
  suggestCache,
  interview,
  onClose,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  draftCard?: React.ReactNode
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
  onClose: () => void
}) {
  // Focus moves into the drawer on open and returns to the Co-pilot button on
  // close; Tab stays inside while it's open (a11y C2).
  const drawerRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(20,33,58,0.42)' }}
    >
      <div
        ref={drawerRef}
        className="fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Co-pilot"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(90vw, 360px)',
          background: 'var(--white)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-24px 0 60px rgba(20,33,58,0.24)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 auto' }}>
            <RailHeader />
          </div>
          <button
            type="button"
            aria-label="Close co-pilot"
            onClick={onClose}
            style={{ width: 44, borderBottom: '1px solid var(--rule)', borderLeft: '1px solid var(--rule-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div
          className="build-scroll bhp-drawer-body"
          style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px calc(18px + env(safe-area-inset-bottom))' }}
        >
          <CopilotPanel state={state} dispatch={dispatch} draftCard={draftCard} suggestCache={suggestCache} interview={interview} />
        </div>
      </div>
    </div>
  )
}
