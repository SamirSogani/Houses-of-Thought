'use client'

// Post-pipeline console (plan doc
// plans/active/reasoning-pipeline/28-post-pipeline-console.md) — a dedicated
// page (/build/[id]/console), entered deliberately once a reasoning-pipeline
// run is done. Whole-house chatbot: ask a question, or point out a mistake,
// and it answers — proposing add_*/remove_* actions (click-to-accept, same
// invariant as everywhere else) for local corrections, or a rerun proposal
// for foundational ones. A rerun only ever executes after the person
// explicitly confirms it (RerunPanel's Confirm rerun button) — never from a
// chat reply alone.
//
// Extended for multiple chats (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md): this file is
// now the layout shell + data orchestration only — turns/actions/branch
// live in ConsoleTranscript.tsx, the rerun card in RerunPanel.tsx, the chat
// list in ChatSidebar.tsx (backed by useConsoleChats.ts). Chat SELECTION is
// the `?chat=` URL param, not React state — same reasoning doc 28 used to
// justify a route over a modal: back/forward and reload should behave.
// Picking a chat when the param is missing/stale (first visit, a deleted
// chat, a brand-new house with no chats at all) happens in the effect below,
// which either jumps to the most-recently-active chat or bootstraps a fresh
// 'new' one — nothing here EVER auto-creates more than that one bootstrap
// chat.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { reducer } from '@/lib/build/state'
import type { State } from '@/lib/build/types'
import { serializeContent, saveHouse } from '@/lib/build/persistence'
import { aiActionApplicable } from '@/lib/build/aiActions'
import type { AiAction } from '@/lib/ai/findings'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import {
  CONSOLE_MESSAGE_MAX,
  MAX_ACTIVE_CHATS_PER_HOUSE,
  MAX_CHAT_BRANCH_DEPTH,
  MAX_REVISE_ITERATIONS,
  type ConsoleTurn,
  type RerunProposal,
} from '@/lib/ai/console'
import { useReasoningPipelineRunner } from '../useReasoningPipelineRunner'
import { useIsMobile } from '../useIsMobile'
import { useSidebarCollapsed } from './useSidebarCollapsed'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'
import { createClient } from '@/lib/supabase/client'
import { useConsoleChats } from './useConsoleChats'
import { useConsoleCandidate } from './useConsoleCandidate'
import { useConsoleSandbox } from './useConsoleSandbox'
import { ChatSidebar } from './ChatSidebar'
import { ConsoleShell } from './ConsoleShell'
import { ConsoleTranscript } from './ConsoleTranscript'
import { RerunPanel } from './RerunPanel'
import { SandboxPanel } from './SandboxPanel'

interface PersistedRun {
  runId: string
  originalQuery: string
  status: string
  lastStep: string
  runState: RunState
}

type LoadState = 'loading' | 'loaded' | 'error'
type SendState = 'idle' | 'sending' | 'error' | 'rate-limited'

function branchErrorCopy(error?: string): string {
  if (error === 'chat-limit-reached') return `${MAX_ACTIVE_CHATS_PER_HOUSE} active chats is the limit — delete one first.`
  if (error === 'branch-depth-exceeded') return `Branches can only go ${MAX_CHAT_BRANCH_DEPTH} deep from the original chat.`
  return 'Could not create that chat — try again.'
}

export function ConsolePage({ houseId, initialState }: { houseId: string; initialState: State }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const router = useRouter()
  const searchParams = useSearchParams()
  const chatId = searchParams.get('chat')
  const isMobile = useIsMobile()
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed()

  const chats = useConsoleChats(houseId)
  const bootstrapping = useRef(false)

  const [turns, setTurns] = useState<ConsoleTurn[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [persistedRun, setPersistedRun] = useState<PersistedRun | null>(null)
  const [draft, setDraft] = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [confirmingRerun, setConfirmingRerun] = useState<{ turnId: string; proposal: RerunProposal } | null>(null)
  const [branchingMessageId, setBranchingMessageId] = useState<string | null>(null)
  const [revisingMessageId, setRevisingMessageId] = useState<string | null>(null)
  const [reviseError, setReviseError] = useState<{ turnId: string; message: string } | null>(null)
  const [creatingChat, setCreatingChat] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const revRef = useRef<string | undefined>(undefined)
  const stateRef = useRef(state)
  stateRef.current = state
  const scrollRef = useRef<HTMLDivElement>(null)

  const runner = useReasoningPipelineRunner(dispatch, houseId)

  const save = useCallback(async () => {
    const supabase = createClient()
    revRef.current = await saveHouse(supabase, houseId, stateRef.current, revRef.current)
  }, [houseId])

  // Loop C, sandbox reruns with a diff (plan doc
  // plans/active/reasoning-pipeline/31-console-sandbox-reruns.md). The
  // candidate is house-scoped (at most one live at a time, 0043's partial
  // unique index), so it loads once here, same as persistedRun below —
  // never re-fetched on a chat switch (the diff card itself only RENDERS in
  // the owning chat; see candidate.chatId checks in the JSX).
  const candidateHook = useConsoleCandidate(houseId)
  const sandbox = useConsoleSandbox({ runner, dispatch, save, stateRef, candidateHook })

  // Content key for the chat list — see the bootstrap effect's dep comment.
  const chatIdsKey = chats.chats.map((c) => c.id).join(',')

  // Resolve a real chat to view: an already-valid ?chat= param is left
  // alone; otherwise jump to the most-recently-active chat, or — a house
  // with no chats at all yet — bootstrap exactly one 'new' chat and jump
  // there. bootstrapping guards against firing twice while that create is
  // in flight (React effects can re-run before the fetch settles).
  useEffect(() => {
    if (chats.loadState !== 'loaded') return
    if (chatId && chats.chats.some((c) => c.id === chatId)) return
    if (chats.chats.length > 0) {
      router.replace(`/build/${houseId}/console?chat=${chats.chats[0].id}`, { scroll: false })
      return
    }
    if (bootstrapping.current) return
    bootstrapping.current = true
    chats.createChat({ mode: 'new' }).then((result) => {
      bootstrapping.current = false
      if (result.ok && result.chat) {
        router.replace(`/build/${houseId}/console?chat=${result.chat.id}`, { scroll: false })
      }
    })
    // chatIdsKey, not chats.chats: the array identity changes on every
    // refetch, but its CONTENT is what this effect cares about. Without it
    // the effect never re-ran when a chat left the list, so deleting the
    // chat you were viewing left ?chat= pointing at it — the transcript
    // stayed on screen and the delete looked like it had done nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.loadState, chatIdsKey, chatId, houseId, router])

  // Transcript for the selected chat — reset on every chat switch, not just
  // on mount (unlike the pre-multi-chat version of this file, which loaded
  // once for the house's one implicit chat).
  useEffect(() => {
    if (!chatId) return
    let active = true
    setLoadState('loading')
    setTurns([])
    setAdded(new Set())
    setConfirmingRerun(null)
    setSendState('idle')
    setRevisingMessageId(null)
    setReviseError(null)
    fetch(`/api/houses/${houseId}/console?chatId=${chatId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { turns: ConsoleTurn[] }) => {
        if (!active) return
        setTurns(data.turns)
        setLoadState('loaded')
      })
      .catch(() => {
        if (active) setLoadState('error')
      })
    return () => {
      active = false
    }
  }, [chatId, houseId])

  // The house's persisted pipeline run — house-scoped, not chat-scoped, so
  // this loads once and isn't re-fetched on a chat switch.
  useEffect(() => {
    let active = true
    fetch(`/api/houses/${houseId}/reasoning`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { run: PersistedRun | null } | null) => {
        if (active && data?.run) setPersistedRun(data.run)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [houseId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, confirmingRerun, runner.phase])

  useEffect(() => {
    if (runner.phase !== 'done') return
    // Loop C (plan doc 31, Trap 3): a sandbox run's completion must NOT
    // save the house or post the rerun-complete marker — it finalizes into
    // a candidate instead (useConsoleSandbox's own finalizeIfSandbox), and
    // stops here. Checked FIRST, before any of the real-rerun logic below.
    if (runner.sandboxMode) {
      void sandbox.finalizeIfSandbox()
      return
    }
    // ConsolePage only ever calls runner.rerunFrom (never runner.start) for
    // a non-sandbox run, so every OTHER 'done' observed here IS a confirmed
    // rerun completing — read the stage BEFORE clearing confirmingRerun
    // below, it's the last chance to.
    const rerunStage = confirmingRerun?.proposal.stage ?? null
    setConfirmingRerun(null)
    void save()
    if (rerunStage) {
      // Loop B item 1b (doc 30) — the rerun completes client-side (this
      // effect), so the marker has to be requested from here; which chats
      // are active and the marker text itself stay server-side
      // (app/api/houses/[id]/console/rerun-complete/route.ts). Best-effort:
      // the house write above already landed either way, so a failure here
      // just means the marker is missing, not that anything was lost.
      fetch(`/api/houses/${houseId}/console/rerun-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: rerunStage }),
      })
        .then(() => {
          chats.refresh()
          if (chatId) {
            fetch(`/api/houses/${houseId}/console?chatId=${chatId}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data: { turns: ConsoleTurn[] } | null) => {
                if (data) setTurns(data.turns)
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }
    fetch(`/api/houses/${houseId}/reasoning`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { run: PersistedRun | null } | null) => {
        if (data?.run) setPersistedRun(data.run)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.phase])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sendState === 'sending' || !chatId) return
    setSendState('sending')
    const optimisticId = `optimistic-${Date.now()}`
    setTurns((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        message,
        actions: null,
        rerunProposal: null,
        createdAt: new Date().toISOString(),
        revisesMessageId: null,
        revisionIteration: 0,
        critique: null,
      },
    ])
    setDraft('')
    try {
      const res = await fetch(`/api/houses/${houseId}/console`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house: JSON.parse(serializeContent(state)), message, chatId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setSendState(body.error === RATE_LIMITED_CODE ? 'rate-limited' : 'error')
        return
      }
      const { turn } = (await res.json()) as { turn: ConsoleTurn }
      setTurns((prev) => [...prev, turn])
      setSendState('idle')
      chats.refresh()
    } catch {
      setSendState('error')
    }
  }

  // Loop A, bounded revise (doc 30) — no optimistic turn (unlike handleSend):
  // the instruction and the revision both land as real rows in one response,
  // so there's nothing useful to show optimistically beyond the "Revising…"
  // busy state ConsoleTranscript's own ReviseControl already renders.
  async function handleRevise(targetTurnId: string, instruction: string) {
    if (!chatId || revisingMessageId) return
    setRevisingMessageId(targetTurnId)
    setReviseError(null)
    try {
      const res = await fetch(`/api/houses/${houseId}/console/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'revise',
          chatId,
          targetTurnId,
          instruction,
          house: JSON.parse(serializeContent(state)),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        const message =
          body.error === RATE_LIMITED_CODE
            ? RATE_LIMITED_COPY
            : body.error === 'revise-cap-reached'
              ? `${MAX_REVISE_ITERATIONS} revisions is the limit for this answer.`
              : "Couldn't revise that — try again."
        setReviseError({ turnId: targetTurnId, message })
        return
      }
      const { userTurn, assistantTurn } = (await res.json()) as { userTurn: ConsoleTurn; assistantTurn: ConsoleTurn }
      setTurns((prev) => [...prev, userTurn, assistantTurn])
      chats.refresh()
    } catch {
      setReviseError({ turnId: targetTurnId, message: "Couldn't revise that — try again." })
    } finally {
      setRevisingMessageId(null)
    }
  }

  function handleAdd(turnId: string, idx: number, action: AiAction) {
    const key = `${turnId}:${idx}`
    if (!aiActionApplicable(state, action)) {
      dispatch({ type: 'SET_TOAST', value: 'That no longer applies here.' })
      setAdded((prev) => new Set(prev).add(key))
      return
    }
    dispatch({ type: 'APPLY_AI_ACTION', action })
    setAdded((prev) => new Set(prev).add(key))
    void save()
  }

  function handleConfirmRerun() {
    if (!confirmingRerun || !persistedRun) return
    const { proposal } = confirmingRerun
    runner.rerunFrom(persistedRun.runState, proposal.stage, proposal.reason, proposal.guidance)
  }

  // Loop C (plan doc 31) — mirrors handleConfirmRerun's own shape
  // (persistedRun.runState is the same real starting point either way), but
  // opens sandbox.confirmingSandbox instead of starting the run immediately
  // — SandboxPanel's own "Run as sandbox" button is what actually calls
  // runner.rerunSandbox (via handleStartSandbox below), matching RerunPanel's
  // own confirm-then-run split.
  function handlePreviewSandbox(turnId: string, proposal: RerunProposal) {
    if (!chatId) return
    sandbox.previewSandbox(turnId, proposal, chatId)
  }

  function handleStartSandbox() {
    if (!persistedRun) return
    sandbox.startSandbox(persistedRun.runState)
  }

  async function goToChat(id: string) {
    setMobileDrawerOpen(false)
    router.push(`/build/${houseId}/console?chat=${id}`, { scroll: false })
  }

  async function handleNewChat() {
    setCreatingChat(true)
    const result = await chats.createChat({ mode: 'new' })
    setCreatingChat(false)
    if (result.ok && result.chat) void goToChat(result.chat.id)
    else dispatch({ type: 'SET_TOAST', value: branchErrorCopy(result.error) })
  }

  async function handleSeedBranch(fromChatId: string) {
    const result = await chats.createChat({ mode: 'seed', fromChatId })
    if (result.ok && result.chat) void goToChat(result.chat.id)
    else dispatch({ type: 'SET_TOAST', value: branchErrorCopy(result.error) })
  }

  async function handleBranchFromMessage(messageId: string) {
    if (!chatId || branchingMessageId) return
    setBranchingMessageId(messageId)
    const result = await chats.createChat({ mode: 'fork', fromChatId: chatId, fromMessageId: messageId })
    setBranchingMessageId(null)
    if (result.ok && result.chat) void goToChat(result.chat.id)
    else dispatch({ type: 'SET_TOAST', value: branchErrorCopy(result.error) })
  }

  async function handleDeleteChat(id: string) {
    const { ok, chats: remaining } = await chats.deleteChat(id)
    if (!ok) {
      dispatch({ type: 'SET_TOAST', value: 'Could not delete that chat — try again.' })
      return
    }
    if (id !== chatId) return
    // Jump to what's actually left, read from the refreshed list rather than
    // from `chats.chats` (which this delete's own refetch may not have
    // written yet). Clearing ?chat= and letting the bootstrap effect choose
    // used to race that refetch and land back on the chat just deleted.
    const next = remaining?.find((c) => c.id !== id) ?? null
    router.replace(next ? `/build/${houseId}/console?chat=${next.id}` : `/build/${houseId}/console`, { scroll: false })
  }

  const rerunActive = runner.phase !== 'idle'
  const selectedChat = chats.chats.find((c) => c.id === chatId) ?? null

  // Loop C (plan doc 31, "one candidate at a time") — house-wide, not
  // chat-scoped: only one sandbox cascade can be in flight or awaiting a
  // decision per house at all, regardless of which chat is open.
  const sandboxDisabledReason = candidateHook.candidate
    ? 'A sandbox candidate is already pending — promote or discard it first.'
    : sandbox.confirmingSandbox
      ? 'A sandbox rerun is already in progress.'
      : null

  const renderSidebar = (onCollapse?: () => void) => (
    <ChatSidebar
      onCollapse={onCollapse}
      chats={chats.chats}
      selectedChatId={chatId}
      onSelect={goToChat}
      onCreateNew={handleNewChat}
      onBranchChat={handleSeedBranch}
      onRename={(id, title) => void chats.renameChat(id, title)}
      onDelete={handleDeleteChat}
      deletedChats={chats.deletedChats}
      deletedLoadState={chats.deletedLoadState}
      onOpenDeleted={chats.loadDeleted}
      onRestore={(id) => void chats.restoreChat(id)}
      creating={creatingChat}
    />
  )

  return (
    <ConsoleShell
      houseId={houseId}
      isMobile={isMobile}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={toggleSidebar}
      chatCount={chats.chats.length}
      mobileDrawerOpen={mobileDrawerOpen}
      onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
      onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
      renderSidebar={renderSidebar}
    >
        <div style={{ flex: '1 1 auto', maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5, marginBottom: 16 }}>
            Ask about the house, or point out what it got wrong. Proposed changes are click-to-accept, same as
            everywhere else — nothing here writes to the house on its own, including a stage rerun, which only
            happens once you confirm it.
          </div>

          <div ref={scrollRef} style={{ flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
            {loadState === 'loading' && <div style={{ fontSize: 13, color: 'var(--ink-subtle)' }}>Loading…</div>}
            {loadState === 'error' && <div style={{ fontSize: 13, color: 'var(--ink)' }}>Couldn&apos;t load this conversation.</div>}
            {loadState === 'loaded' && turns.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
                Ask why something is here, what it means, or say what it got wrong.
              </div>
            )}

            <ConsoleTranscript
              turns={turns}
              state={state}
              added={added}
              onAdd={handleAdd}
              hasPersistedRun={persistedRun !== null}
              confirmingTurnId={confirmingRerun?.turnId ?? null}
              rerunActive={rerunActive}
              onPreviewRerun={(turnId, proposal) => setConfirmingRerun({ turnId, proposal })}
              onBranchFromMessage={handleBranchFromMessage}
              branchingMessageId={branchingMessageId}
              onRevise={handleRevise}
              revisingMessageId={revisingMessageId}
              reviseError={reviseError}
              onPreviewSandbox={handlePreviewSandbox}
              sandboxDisabledReason={sandboxDisabledReason}
            />

            {confirmingRerun && (
              <RerunPanel
                proposal={confirmingRerun.proposal}
                state={state}
                runner={runner}
                rerunActive={rerunActive}
                onConfirm={handleConfirmRerun}
                onClose={() => setConfirmingRerun(null)}
              />
            )}

            {/* Loop C (plan doc 31) — renders whenever a "Preview as
                sandbox" click is pending/running for THIS render, OR a
                finalized candidate exists that belongs to the chat
                currently open. A candidate from a DIFFERENT chat never
                renders its diff here — only the disabled trigger
                (sandboxDisabledReason) shows elsewhere. */}
            {(sandbox.confirmingSandbox || candidateHook.candidate?.chatId === chatId) && (
              <SandboxPanel
                proposal={sandbox.confirmingSandbox?.proposal ?? null}
                candidate={candidateHook.candidate?.chatId === chatId ? candidateHook.candidate : null}
                runner={runner}
                sandboxActive={runner.sandboxMode && runner.phase !== 'idle'}
                currentContentJson={serializeContent(state)}
                onStartSandbox={handleStartSandbox}
                onPromote={sandbox.promote}
                onDiscard={sandbox.discard}
                onClose={sandbox.closeSandboxPreview}
                promoting={sandbox.promoting}
                discarding={sandbox.discarding}
                actionError={sandbox.actionError}
              />
            )}
          </div>

          {selectedChat?.stale && (
            <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginBottom: 8, lineHeight: 1.45 }}>
              A pipeline rerun has finished since this chat&apos;s last reply — earlier answers here may refer to the
              previous version.
            </div>
          )}
          {sendState === 'rate-limited' && (
            <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.45 }}>{RATE_LIMITED_COPY}</div>
          )}
          {sendState === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.45 }}>Couldn&apos;t reach the co-pilot — try again.</div>
          )}

          <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, CONSOLE_MESSAGE_MAX))}
              placeholder="Ask about the house, or say what it got wrong…"
              aria-label="Message the co-pilot"
              disabled={!chatId}
              style={{ flex: 1, height: 42, padding: '0 13px', fontSize: 14, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 8, outline: 'none' }}
            />
            <button
              type="submit"
              disabled={sendState === 'sending' || draft.trim().length === 0 || !chatId}
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--ink)',
                background: 'var(--amber-tint)',
                border: '1px solid var(--amber)',
                borderRadius: 8,
                padding: '0 18px',
                cursor: 'pointer',
                opacity: sendState === 'sending' ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
    </ConsoleShell>
  )
}
