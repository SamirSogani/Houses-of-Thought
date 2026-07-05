'use client'

// Standalone empty-house shell (/house). Recreates the AI-in-schools house
// workspace layer by layer, but starting empty, so the user can add things into
// it. Reuses the real Build chrome (AppBar / ContextBar / BlueprintRail / Canvas)
// fed a local reducer — no Supabase, no persistence. The right rail is the
// AI / Team sidebar shell with no content in it yet (wired in a later pass).
//
// Deliberately does not touch /build or /examples.

import { useEffect, useReducer, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { reducer } from '@/lib/build/state'
import { computeStrength } from '@/lib/build/strength'
import type { State } from '@/lib/build/types'
import { AppBar } from '@/components/build/AppBar'
import { ContextBar } from '@/components/build/ContextBar'
import { BlueprintRail } from '@/components/build/BlueprintRail'
import { Canvas } from '@/components/build/Canvas'
import { InviteModal } from '@/components/build/InviteModal'
import { WhatsNewDrawer } from '@/components/build/WhatsNewDrawer'
import { Toast } from '@/components/build/Toast'

// An empty AI-in-schools house: the frame (purpose + question) is fixed copy in
// FrameLayer, but every layer the user fills in starts blank.
const emptyState: State = {
  step: 1,
  title: 'Should AI be used in schools?',
  rightTab: 'copilot',
  inviteOpen: false,
  inviteInput: '',
  copied: false,
  notesOpen: false,
  toast: '',
  concepts: [],
  perspectives: [],
  evidence: [],
  assumptions: [],
  pos: [],
  neg: [],
  unc: [],
  watchpoints: [],
  accepted: {},
  activePerspective: null,
}

export default function HousePage() {
  const router = useRouter()
  const [state, dispatch] = useReducer(reducer, emptyState)
  const strength = computeStrength(state)
  const canvasRef = useRef<HTMLElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Toast auto-dismiss after 2200ms; a new toast resets the timer (matches Build).
  useEffect(() => {
    if (!state.toast) return
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => dispatch({ type: 'SET_TOAST', value: '' }), 2200)
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [state.toast])

  // Every navigation scrolls the canvas to top.
  useEffect(() => {
    canvasRef.current?.scrollTo({ top: 0 })
  }, [state.step, state.activePerspective])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--parchment)' }}>
      <header style={{ flex: '0 0 auto' }}>
        <AppBar
          userEmail={null}
          onOpenNotes={() => dispatch({ type: 'OPEN_NOTES' })}
          onSignOut={() => router.push('/')}
        />
        <ContextBar
          title={state.title}
          strength={strength}
          onTitleChange={(v) => dispatch({ type: 'SET_TITLE', value: v })}
          onOpenReview={() => dispatch({ type: 'GO_STEP', n: 7 })}
          onInvite={() => dispatch({ type: 'OPEN_INVITE' })}
          onPublish={() => dispatch({ type: 'PUBLISH' })}
        />
      </header>

      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        <BlueprintRail state={state} strength={strength} onGo={(n) => dispatch({ type: 'GO_STEP', n })} />
        <Canvas ref={canvasRef} state={state} strength={strength} dispatch={dispatch} />
        <EmptyRightRail rightTab={state.rightTab} onTab={(tab) => dispatch({ type: 'SET_TAB', tab })} />
      </div>

      {state.inviteOpen && <InviteModal inviteInput={state.inviteInput} copied={state.copied} dispatch={dispatch} />}
      {state.notesOpen && <WhatsNewDrawer dispatch={dispatch} />}
      <Toast message={state.toast} />
    </div>
  )
}

// The AI / Team sidebar — same tab shell as the Build workspace, but with no
// content in either panel yet. Content lands in a later pass.
function EmptyRightRail({ rightTab, onTab }: { rightTab: State['rightTab']; onTab: (tab: 'copilot' | 'team') => void }) {
  const tabs: { key: 'copilot' | 'team'; label: string }[] = [
    { key: 'copilot', label: 'Co-pilot' },
    { key: 'team', label: 'Team' },
  ]
  return (
    <aside style={{ flex: '0 0 320px', background: 'var(--white)', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)' }}>
        {tabs.map((t) => {
          const active = rightTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              style={{ flex: 1, padding: '10px 0 12px', fontWeight: 600, fontSize: 13, color: active ? 'var(--ink)' : 'var(--ink-subtle)', borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`, marginBottom: -1 }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px' }} />
    </aside>
  )
}
