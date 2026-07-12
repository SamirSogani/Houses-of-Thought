'use client'

// Root of the Build a House workspace: three-zone shell + right-rail tabs + overlays
// + toast. Owns the reducer. See handoff 02 §3 / 05 §1.

import { useEffect, useReducer, useRef } from 'react'
import { reducer } from '@/lib/build/state'
import { computeStrength } from '@/lib/build/strength'
import { serializeContent } from '@/lib/build/persistence'
import type { State } from '@/lib/build/types'
import { AppBar } from './AppBar'
import { ContextBar } from './ContextBar'
import { BlueprintRail } from './BlueprintRail'
import { Canvas } from './Canvas'
import { CopilotPanel } from './rail/CopilotPanel'
import { InviteModal } from './InviteModal'
import { WhatsNewDrawer } from './WhatsNewDrawer'
import { SubmissionFeedback } from './SubmissionFeedback'
import { Toast } from './Toast'

export function BuildHousePage({
  initialState,
  userEmail,
  houseId,
  modeLocked = false,
  readOnly = false,
  strawman = false,
  feedback = null,
  onSignOut,
  onSave,
}: {
  initialState: State
  userEmail: string | null
  // The house id; needed to load/save teacher feedback. Null for local drafts.
  houseId?: string
  // When true (students), the Learn/Decide toggle is disabled and pinned.
  modeLocked?: boolean
  // When true (a teacher viewing a student's house), edits don't persist and the
  // write-affordances are disabled; a banner makes the read-only state explicit.
  readOnly?: boolean
  // When true, this is an AI strawman to attack (implies readOnly upstream); the
  // banner reads differently from the teacher read-only case.
  strawman?: boolean
  // Teacher assessment surface: 'edit' (teacher on a student submission),
  // 'view' (student on their own house), or null (not a graded context).
  feedback?: 'edit' | 'view' | null
  onSignOut: () => void
  // Persistence adapter, called (debounced) whenever persistable content changes.
  onSave: (state: State) => void
}) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const strength = computeStrength(state)
  const canvasRef = useRef<HTMLElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstSave = useRef(true)
  // Held in a ref so a fresh onSave closure each render never resets the debounce.
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  // Latest state + last-saved content key, so a pending edit can be flushed if the
  // workspace unmounts before the debounce fires (see the flush effect below).
  const stateRef = useRef(state)
  stateRef.current = state
  const savedKeyRef = useRef<string | null>(null)

  // Toast auto-dismiss after 2200ms; a new toast resets the timer (04 §13).
  useEffect(() => {
    if (!state.toast) return
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => dispatch({ type: 'SET_TOAST', value: '' }), 2200)
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [state.toast])

  // Debounced autosave. Keyed on the persistable content only (contentKey), so
  // ephemeral changes (step, tabs, toast, invite) never trigger a write. Skips
  // the first render after load — that state matches the DB already.
  const contentKey = serializeContent(state)
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false
      savedKeyRef.current = contentKey // loaded state already matches the DB
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const key = contentKey
    saveTimer.current = setTimeout(() => {
      onSaveRef.current(stateRef.current)
      savedKeyRef.current = key
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // contentKey is the intended dependency; state/onSave are read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey])

  // Flush a pending edit if the workspace unmounts (route change) inside the
  // 800ms debounce window, so work isn't lost. onSave is a no-op in read-only
  // views, so this is harmless there.
  useEffect(() => {
    return () => {
      if (savedKeyRef.current !== null && serializeContent(stateRef.current) !== savedKeyRef.current) {
        onSaveRef.current(stateRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every navigation scrolls the canvas to top (02 §10).
  useEffect(() => {
    canvasRef.current?.scrollTo({ top: 0 })
  }, [state.step, state.activePerspective])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--parchment)' }}>
      {/* Header (app bar + context bar) */}
      <header style={{ flex: '0 0 auto' }}>
        <AppBar
          userEmail={userEmail}
          onOpenNotes={() => dispatch({ type: 'OPEN_NOTES' })}
          onSignOut={onSignOut}
        />
        {(readOnly || strawman) && (
          <div
            className="mono"
            style={{
              flex: '0 0 auto',
              padding: '7px 24px',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: strawman ? 'var(--amber-hover)' : 'var(--blueprint)',
              background: 'var(--parchment)',
              borderBottom: `1px dashed ${strawman ? 'var(--amber-hover)' : 'var(--blueprint)'}`,
            }}
          >
            {strawman
              ? readOnly
                ? 'AI Strawman · not your work — find the weak links, then open Review to critique it'
                : 'AI Strawman · students will attack this — review and revise it before releasing'
              : "Read-only · you're viewing a student's house"}
          </div>
        )}
        <ContextBar
          title={state.title}
          question={state.question}
          strength={strength}
          mode={state.mode}
          modeLocked={modeLocked}
          readOnly={readOnly}
          onModeChange={(mode) => {
            if (modeLocked) return
            dispatch({ type: 'SET_MODE', mode })
          }}
          onTitleChange={(v) => dispatch({ type: 'SET_TITLE', value: v })}
          onOpenReview={() => dispatch({ type: 'GO_STEP', n: 7 })}
          onInvite={() => dispatch({ type: 'OPEN_INVITE' })}
          onPublish={() => dispatch({ type: 'PUBLISH' })}
        />
        {houseId && feedback && (
          <SubmissionFeedback
            houseId={houseId}
            mode={feedback}
            house={feedback === 'edit' ? JSON.parse(contentKey) : undefined}
          />
        )}
      </header>

      {/* Three-zone row */}
      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        <BlueprintRail state={state} strength={strength} onGo={(n) => dispatch({ type: 'GO_STEP', n })} />
        <Canvas ref={canvasRef} state={state} strength={strength} dispatch={dispatch} />
        <RightRail state={state} dispatch={dispatch} />
      </div>

      {/* Overlays */}
      {state.inviteOpen && <InviteModal inviteInput={state.inviteInput} copied={state.copied} dispatch={dispatch} />}
      {state.notesOpen && <WhatsNewDrawer dispatch={dispatch} />}
      <Toast message={state.toast} />
    </div>
  )
}

function RightRail({ state, dispatch }: { state: React.ComponentProps<typeof CopilotPanel>['state']; dispatch: React.ComponentProps<typeof CopilotPanel>['dispatch'] }) {
  const tabs: { key: 'copilot' | 'team'; label: string }[] = [
    { key: 'copilot', label: 'Co-pilot' },
    { key: 'team', label: 'Team' },
  ]
  return (
    <aside style={{ flex: '0 0 320px', background: 'var(--white)', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
      <div className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px' }}>
        {state.rightTab === 'copilot' ? (
          <CopilotPanel state={state} dispatch={dispatch} />
        ) : (
          <EmptyTeam />
        )}
      </div>
    </aside>
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
