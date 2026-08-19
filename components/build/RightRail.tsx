'use client'

// Right rail (Co-pilot + Team), in two shells that share the tab strip and
// panel body: the fixed 320px desktop aside, and a slide-over drawer for
// <1024px (opened from the floating Co-pilot button in BuildHousePage). Only
// one shell is ever mounted, so CopilotPanel never fetches twice.
//
// The Team tab (Mechanism 1 of plans/active/persistence/invite-share-panels.md,
// extended by plans/active/persistence/team-panel-v2.md) replaces the one
// removed in commit 1c49db6 for simulating a feature that didn't exist yet
// (fake presence, an inert Invite button, fictional collaborators).
//
// team-panel-v2 item 2: unlike v1, the tab strip is now ALWAYS both tabs —
// `team` being null (teacher viewing a student's house, or a strawman attack)
// no longer collapses the header to a single static "Co-pilot" label; Team's
// content area shows a plain "Not available in this view" state instead of
// the tab disappearing, so switching tabs is always the same gesture.

import { useEffect, useState } from 'react'
import type { Action, State } from '@/lib/build/types'
import { XIcon } from '@/components/icons'
import { ChevronLeft, ChevronRight } from './buildIcons'
import { useFocusTrap } from '@/components/useFocusTrap'
import type { TeamRoster } from './useTeamRoster'
import { CopilotPanel, type SuggestCache } from './rail/CopilotPanel'
import type { InterviewSession } from './rail/InterviewCard'
import type { ReasoningPipelineRunner } from './useReasoningPipelineRunner'
import { TeamPanel } from './rail/TeamPanel'

// Passed only when the current user has real standing on this house (owner or
// an existing collaborator) — see module comment.
export interface TeamContext {
  houseId: string
  currentUserId: string
  isOwner: boolean
}

type RailTab = 'copilot' | 'team'

function RailHeader({
  team,
  tab,
  onTab,
  expanded,
  onToggleExpand,
}: {
  team?: TeamContext | null
  tab: RailTab
  onTab: (t: RailTab) => void
  expanded: boolean
  onToggleExpand: () => void
}) {
  const tabs: { key: RailTab; label: string }[] = [
    { key: 'copilot', label: 'Co-pilot' },
    { key: 'team', label: 'Team' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', flex: '1 1 auto' }}>
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
              {!team && t.key === 'team' && <span className="sr-only"> — not available in this view</span>}
            </button>
          )
        })}
      </div>
      {/* team-panel-v2 item 7: widens the rail (or, on mobile, opens a
          full-width overlay instead of the usual slide-over) once DMs +
          activity log + membership list all have to fit alongside the
          invite form. Exact mechanism is an implementation detail — the plan
          doc leaves it to the implementer. */}
      <button
        type="button"
        onClick={onToggleExpand}
        aria-label={expanded ? 'Narrow panel' : 'Widen panel'}
        title={expanded ? 'Narrow panel' : 'Widen panel'}
        style={{ flex: '0 0 auto', width: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-subtle)', background: 'none', border: 'none', borderLeft: '1px solid var(--rule-soft)' }}
      >
        {expanded ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </div>
  )
}

function RailBody({
  state,
  dispatch,
  draftCard,
  suggestCache,
  interview,
  pipelineRunner,
  team,
  roster,
  tab,
  restrictAuthorship,
  houseId,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  draftCard?: React.ReactNode
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
  pipelineRunner?: ReasoningPipelineRunner
  team?: TeamContext | null
  roster?: TeamRoster | null
  tab: RailTab
  // See CopilotPanel's own doc comment — threaded through unchanged.
  restrictAuthorship?: boolean
  // Post-pipeline console entry point (plan doc 28) — threaded through
  // unchanged, same optionality as Canvas's own houseId (undefined on the
  // localStorage /house builder, which has no row for a console to attach to).
  houseId?: string
}) {
  if (tab === 'team') {
    if (!team) {
      // team-panel-v2 item 2: teacher-viewing-a-student's-house and the
      // strawman-attack views have genuinely no team concept — the tab stays
      // visible (never disappears) but its content says so plainly instead
      // of silently falling back to Co-pilot content.
      return (
        <div className="fade-in" style={{ padding: '32px 8px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', lineHeight: 1.6 }}>
            Not available in this view
          </div>
        </div>
      )
    }
    return <TeamPanel houseId={team.houseId} currentUserId={team.currentUserId} isOwner={team.isOwner} roster={roster ?? null} />
  }
  return (
    <CopilotPanel
      state={state}
      dispatch={dispatch}
      draftCard={draftCard}
      suggestCache={suggestCache}
      interview={interview}
      pipelineRunner={pipelineRunner}
      restrictAuthorship={restrictAuthorship}
      houseId={houseId}
    />
  )
}

export function RightRail({
  state,
  dispatch,
  draftCard,
  suggestCache,
  interview,
  pipelineRunner,
  team,
  roster,
  restrictAuthorship,
  houseId,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  // Draft Mode card, created in BuildHousePage (where its runner lives).
  draftCard?: React.ReactNode
  // Suggestion cache + interview session, also owned by BuildHousePage so they
  // survive this shell unmounting (tab switch / mobile drawer).
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
  // House-scoped reasoning pipeline's runner (plan doc 27) — same
  // survives-unmounting rationale, hoisted in BuildHousePage.
  pipelineRunner?: ReasoningPipelineRunner
  team?: TeamContext | null
  // Real owner/collaborator names + presence (team-panel-v2 item 1/4), from
  // BuildHousePage's useTeamRoster — shared with ContextBar so both agree.
  roster?: TeamRoster | null
  // See CopilotPanel's own doc comment — threaded through unchanged.
  restrictAuthorship?: boolean
  // See RailBody's own doc comment — threaded through unchanged.
  houseId?: string
}) {
  const [tab, setTab] = useState<RailTab>('copilot')
  const [expanded, setExpanded] = useState(false)
  return (
    <aside
      className="bhp-right-rail"
      style={{ flex: expanded ? '0 0 520px' : '0 0 320px', background: 'var(--white)', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', minHeight: 0, transition: 'flex-basis 0.18s ease' }}
    >
      <RailHeader team={team} tab={tab} onTab={setTab} expanded={expanded} onToggleExpand={() => setExpanded((e) => !e)} />
      <div className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px' }}>
        <RailBody state={state} dispatch={dispatch} draftCard={draftCard} suggestCache={suggestCache} interview={interview} pipelineRunner={pipelineRunner} team={team} roster={roster} tab={tab} restrictAuthorship={restrictAuthorship} houseId={houseId} />
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
  pipelineRunner,
  team,
  roster,
  onClose,
  restrictAuthorship,
  houseId,
}: {
  state: State
  dispatch: React.Dispatch<Action>
  draftCard?: React.ReactNode
  suggestCache?: React.RefObject<SuggestCache>
  interview?: InterviewSession
  pipelineRunner?: ReasoningPipelineRunner
  team?: TeamContext | null
  roster?: TeamRoster | null
  onClose: () => void
  // See CopilotPanel's own doc comment — threaded through unchanged.
  restrictAuthorship?: boolean
  // See RailBody's own doc comment — threaded through unchanged.
  houseId?: string
}) {
  const [tab, setTab] = useState<RailTab>('copilot')
  // team-panel-v2 item 7, mobile case: "widen" becomes "go full-width" — there
  // is no room to widen a slide-over further on a small viewport.
  const [expanded, setExpanded] = useState(false)
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
          width: expanded ? '100vw' : 'min(90vw, 360px)',
          background: 'var(--white)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-24px 0 60px rgba(20,33,58,0.24)',
          transition: 'width 0.18s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 auto' }}>
            <RailHeader team={team} tab={tab} onTab={setTab} expanded={expanded} onToggleExpand={() => setExpanded((e) => !e)} />
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
          <RailBody state={state} dispatch={dispatch} draftCard={draftCard} suggestCache={suggestCache} interview={interview} pipelineRunner={pipelineRunner} team={team} roster={roster} tab={tab} restrictAuthorship={restrictAuthorship} houseId={houseId} />
        </div>
      </div>
    </div>
  )
}
