'use client'

// Right rail (Co-pilot [+ Team]), in two shells that share the tab strip and
// panel body: the fixed 320px desktop aside, and a slide-over drawer for
// <1024px (opened from the floating Co-pilot button in BuildHousePage). Only
// one shell is ever mounted, so CopilotPanel never fetches twice.
//
// The Team tab (Mechanism 1 of plans/active/persistence/invite-share-panels.md)
// replaces the one removed in commit 1c49db6 for simulating a feature that
// didn't exist yet (fake presence, an inert Invite button, fictional
// collaborators). It only appears now that `team` is real: BuildHousePage
// passes it exactly when the caller has real standing on the house (owner, or
// an existing collaborator) — never a decorative tab with nothing behind it.

import { useEffect, useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import { XIcon } from '@/components/icons'
import { useFocusTrap } from '@/components/useFocusTrap'
import { CopilotPanel, type SuggestCache } from './rail/CopilotPanel'
import type { InterviewSession } from './rail/InterviewCard'
import { TeamPanel } from './rail/TeamPanel'

// Passed only when the current user has real standing on this house (owner or
// an existing collaborator) — see module comment.
export interface TeamContext {
  houseId: string
  currentUserId: string
  isOwner: boolean
}

type RailTab = 'copilot' | 'team'

function RailHeader({ team, tab, onTab }: { team?: TeamContext | null; tab: RailTab; onTab: (t: RailTab) => void }) {
  if (!team) {
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
  const tabs: { key: RailTab; label: string }[] = [
    { key: 'copilot', label: 'Co-pilot' },
    { key: 'team', label: 'Team' },
  ]
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)' }}>
      {tabs.map((t) => {
        const active = tab === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onTab(t.key)}
            aria-pressed={active}
            style={{ flex: 1, padding: '10px 0 12px', fontWeight: 600, fontSize: 13, color: active ? 'var(--ink)' : 'var(--ink-subtle)', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`, marginBottom: -1 }}
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
  suggestCache,
  interview,
  team,
  tab,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  draftCard?: React.ReactNode
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
  team?: TeamContext | null
  tab: RailTab
}) {
  if (tab === 'team' && team) {
    return <TeamPanel houseId={team.houseId} currentUserId={team.currentUserId} isOwner={team.isOwner} />
  }
  return <CopilotPanel state={state} dispatch={dispatch} draftCard={draftCard} suggestCache={suggestCache} interview={interview} />
}

export function RightRail({
  state,
  dispatch,
  draftCard,
  suggestCache,
  interview,
  team,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // Draft Mode card, created in BuildHousePage (where its runner lives).
  draftCard?: React.ReactNode
  // Suggestion cache + interview session, also owned by BuildHousePage so they
  // survive this shell unmounting (tab switch / mobile drawer).
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
  team?: TeamContext | null
}) {
  const [tab, setTab] = useState<RailTab>('copilot')
  return (
    <aside className="bhp-right-rail" style={{ flex: '0 0 320px', background: 'var(--white)', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <RailHeader team={team} tab={tab} onTab={setTab} />
      <div className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px' }}>
        <RailBody state={state} dispatch={dispatch} draftCard={draftCard} suggestCache={suggestCache} interview={interview} team={team} tab={tab} />
      </div>
    </aside>
  )
}

// Mobile (<1024px) shell: scrim + right slide-over holding the same tabs.
export function MobileRailDrawer({
  state,
  dispatch,
  draftCard,
  suggestCache,
  interview,
  team,
  onClose,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  draftCard?: React.ReactNode
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
  team?: TeamContext | null
  onClose: () => void
}) {
  const [tab, setTab] = useState<RailTab>('copilot')
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
        aria-label={team ? 'Co-pilot and team' : 'Co-pilot'}
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
            <RailHeader team={team} tab={tab} onTab={setTab} />
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
          <RailBody state={state} dispatch={dispatch} draftCard={draftCard} suggestCache={suggestCache} interview={interview} team={team} tab={tab} />
        </div>
      </div>
    </div>
  )
}
