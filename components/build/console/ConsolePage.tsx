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
import Link from 'next/link'
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
  type ConsoleTurn,
  type RerunProposal,
} from '@/lib/ai/console'
import { useReasoningPipelineRunner } from '../useReasoningPipelineRunner'
import { useIsMobile } from '../useIsMobile'
import type { RunState } from '@/components/admin/reasoning/ReasoningStagesList'
import { createClient } from '@/lib/supabase/client'
import { useConsoleChats } from './useConsoleChats'
import { ChatSidebar } from './ChatSidebar'
import { ConsoleTranscript } from './ConsoleTranscript'
import { RerunPanel } from './RerunPanel'

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
    // chats.chats/createChat are recreated each render off the same fetch
    // cycle; keying on loadState + the id list (via chatId's own presence
    // check above) is enough to avoid re-running this per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.loadState, chatId, houseId, router])

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
    setConfirmingRerun(null)
    void save()
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
      { id: optimisticId, role: 'user', message, actions: null, rerunProposal: null, createdAt: new Date().toISOString() },
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
    const ok = await chats.deleteChat(id)
    if (ok && id === chatId) router.replace(`/build/${houseId}/console`, { scroll: false })
  }

  const rerunActive = runner.phase !== 'idle'
  const selectedChat = chats.chats.find((c) => c.id === chatId) ?? null

  const sidebar = (
    <ChatSidebar
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
    <div style={{ minHeight: '100vh', background: 'var(--parchment)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--rule)',
          background: 'var(--white)',
        }}
      >
        <Link href={`/build/${houseId}`} style={{ fontSize: 13, color: 'var(--blueprint)', textDecoration: 'none', fontWeight: 600 }}>
          ‹ Back to house
        </Link>
        <span style={{ color: 'var(--rule)' }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>Full console</span>
        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}
          >
            Chats
          </button>
        )}
      </header>

      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        {!isMobile && (
          <aside style={{ flex: '0 0 240px', borderRight: '1px solid var(--rule)', background: 'var(--white)', minHeight: 0 }}>
            {sidebar}
          </aside>
        )}

        {isMobile && mobileDrawerOpen && (
          <div onClick={() => setMobileDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(20,33,58,0.42)' }}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="fade-in"
              role="dialog"
              aria-modal="true"
              aria-label="Chats"
              style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(85vw, 300px)', background: 'var(--white)', boxShadow: '24px 0 60px rgba(20,33,58,0.24)' }}
            >
              {sidebar}
            </div>
          </div>
        )}

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
      </div>
    </div>
  )
}
