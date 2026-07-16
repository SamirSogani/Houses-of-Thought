'use client'

// Right rail (Co-pilot / Team tabs), in two shells that share the tab strip and
// panel body: the fixed 320px desktop aside, and a slide-over drawer for <1024px
// (opened from the floating Co-pilot button in BuildHousePage). Only one shell is
// ever mounted, so CopilotPanel never fetches twice. Extracted from
// BuildHousePage.tsx during the mobile retrofit.

import { useEffect } from 'react'
import type { Action, State } from '@/lib/build/types'
import { XIcon } from '@/components/icons'
import { CopilotPanel } from './rail/CopilotPanel'

function RailTabs({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const tabs: { key: 'copilot' | 'team'; label: string }[] = [
    { key: 'copilot', label: 'Co-pilot' },
    { key: 'team', label: 'Team' },
  ]
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)' }}>
      {tabs.map((t) => {
        const active = state.rightTab === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => dispatch({ type: 'SET_TAB', tab: t.key })}
            style={{ flex: 1, padding: '10px 0 12px', fontWeight: 600, fontSize: 13, color: active ? 'var(--ink)' : 'var(--ink-subtle)', borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`, marginBottom: -1 }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function RailBody({
  state,
  dispatch,
  draftCard,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  draftCard?: React.ReactNode
}) {
  return state.rightTab === 'copilot' ? (
    <CopilotPanel state={state} dispatch={dispatch} draftCard={draftCard} />
  ) : (
    <EmptyTeam />
  )
}

export function RightRail({
  state,
  dispatch,
  draftCard,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // Draft Mode card, created in BuildHousePage (where its runner lives).
  draftCard?: React.ReactNode
}) {
  return (
    <aside className="bhp-right-rail" style={{ flex: '0 0 320px', background: 'var(--white)', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <RailTabs state={state} dispatch={dispatch} />
      <div className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px' }}>
        <RailBody state={state} dispatch={dispatch} draftCard={draftCard} />
      </div>
    </aside>
  )
}

// Mobile (<1024px) shell: scrim + right slide-over holding the same tabs.
export function MobileRailDrawer({
  state,
  dispatch,
  draftCard,
  onClose,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  draftCard?: React.ReactNode
  onClose: () => void
}) {
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
        className="fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Co-pilot and team"
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
            <RailTabs state={state} dispatch={dispatch} />
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
          <RailBody state={state} dispatch={dispatch} draftCard={draftCard} />
        </div>
      </div>
    </div>
  )
}

// Collaboration isn't wired yet, so the Team tab is a single centered invite
// prompt. The button is intentionally inert until invite is built.
function EmptyTeam() {
  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '32px 8px' }}>
      <p style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5, maxWidth: 220 }}>
        Build with other people. Invite them to reason on this house together.
      </p>
      <button
        type="button"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', border: '1px solid var(--ink)', borderRadius: 8, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--white)' }}
      >
        Invite people
      </button>
    </div>
  )
}
