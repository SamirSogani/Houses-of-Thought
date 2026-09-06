'use client'

// House Chat (decision 017): ask a question in chat and the product responds by
// building a real house — never by answering. Admin-only beta, mounted by
// app/admin/chat/page.tsx behind isCallerAdmin().
//
// The transcript is ephemeral, like the interview (privacy surface): only the
// houses persist, each a normal owner-scoped row that opens in /build/[id] with
// the standard claim gate. One build runs at a time; the composer waits for the
// active build to settle. Each new question starts a fresh intake window (turns
// after the last build), so an earlier question is never re-extracted.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuthedPage } from '@/components/useAuthedPage'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { createClient } from '@/lib/supabase/client'
import { blankState } from '@/lib/build/persistence'
import { emptyDraft } from '@/lib/ai/draft'
import { RATE_LIMITED_CODE, RATE_LIMITED_COPY } from '@/lib/ai/findings'
import { titleFromQuestion, type ChatIntakeResponse, type ChatTurn } from '@/lib/ai/chat'
import type { State } from '@/lib/build/types'
import { ChatBuildCard, type BuildSettle } from './ChatBuildCard'

// 'notice' is templated product copy (build hand-offs) — rendered like an
// assistant bubble but excluded from the intake transcript, so the model only
// ever sees turns it or the person actually wrote.
type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'notice'; text: string }
  | { kind: 'build'; houseId: string; initial: State; rev: string; conclude: boolean }

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
}

const bubbleBase: React.CSSProperties = {
  maxWidth: '85%',
  fontSize: 13.5,
  lineHeight: 1.5,
  color: 'var(--ink)',
  border: '1px solid var(--rule)',
  borderRadius: 10,
  padding: '9px 12px',
}

export function HouseChat() {
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [inFlight, setInFlight] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null)
  // Decision 018 toggle — per-question, default off, sticky across questions.
  // Captured onto the build item at start, so flipping it mid-build changes
  // nothing already running.
  const [concludeNext, setConcludeNext] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { accountType, caps, signOut } = useAuthedPage()
  const showClassroom = caps.canCreateClasses || accountType === 'student'

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items.length])

  // Turns after the most recent build, excluding notices — what intake may see.
  function intakeWindow(list: ChatItem[]): ChatTurn[] {
    const lastBuild = list.map((m) => m.kind).lastIndexOf('build')
    return list
      .slice(lastBuild + 1)
      .filter((m): m is Extract<ChatItem, { kind: 'user' | 'assistant' }> => m.kind === 'user' || m.kind === 'assistant')
      .map((m) => ({ role: m.kind, content: m.text }))
  }

  async function runIntake(list: ChatItem[]) {
    setInFlight(true)
    setErrorCode(null)
    try {
      const res = await fetch('/api/admin/chat-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: intakeWindow(list) }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setErrorCode(body.error ?? 'generic')
        return
      }
      const data = (await res.json()) as ChatIntakeResponse
      if (!data.done) {
        setItems([...list, { kind: 'assistant', text: data.reply }])
        return
      }
      await startBuild(list, data)
    } catch {
      setErrorCode('generic')
    } finally {
      setInFlight(false)
    }
  }

  // Create the real house row (same minimal insert as /build), arm Draft Mode
  // with the chat origin marker, and hand the card its initial reducer state.
  // The card's first save persists question/purpose/aiContext/draft.
  async function startBuild(list: ChatItem[], data: Extract<ChatIntakeResponse, { done: true }>) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setErrorCode('signed-out')
      return
    }
    const { data: row, error } = await supabase
      .from('houses')
      .insert({ owner_id: user.id })
      .select('id, updated_at')
      .single()
    if (error || !row) {
      setErrorCode('create-failed')
      return
    }

    const initial: State = {
      ...blankState(),
      title: titleFromQuestion(data.question),
      question: data.question,
      purpose: data.purpose,
      mode: 'decide',
      aiContext: data.context,
      draft: { ...emptyDraft(), via: 'chat' },
    }
    setItems([...list, { kind: 'build', houseId: row.id, initial, rev: row.updated_at as string, conclude: concludeNext }])
    setActiveBuildId(row.id)
  }

  function send() {
    const text = input.trim()
    if (!text || inFlight || activeBuildId) return
    const next: ChatItem[] = [...items, { kind: 'user', text }]
    setItems(next)
    setInput('')
    void runIntake(next)
  }

  function handleSettled(r: BuildSettle) {
    setActiveBuildId(null)
    setItems((cur) => [
      ...cur,
      {
        kind: 'notice',
        text: r.conclusions
          ? 'The materials are in, and conclusion candidates are on the card — each grounded in the whole house, with its own implications. Adopting one is still your call; refine it in the builder.'
          : r.drafted
            ? 'The materials are in — the conclusion stays yours to write. Open the house to review each layer and claim it; publish unlocks after the last claim.'
            : 'Nothing was drafted — open the house to build it by hand, or ask another question.',
      },
    ])
  }

  const composerLocked = inFlight || activeBuildId !== null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={() => void signOut()} active="admin" showClassroom={showClassroom} classroomHref={caps.canCreateClasses ? '/classroom' : '/classes'} />

      <div className="container" style={{ paddingBlock: 32, maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink)' }}>
              House Chat
              <span style={{ ...mono, color: 'var(--ink-subtle)', textTransform: 'uppercase', marginLeft: 10, fontWeight: 400 }}>
                beta · admin only
              </span>
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-mid)', marginTop: 4 }}>
              Ask a question — the answer is a house, not an answer.
            </p>
          </div>
          <Link href="/admin" style={{ ...mono, textTransform: 'uppercase', color: 'var(--ink-subtle)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Monitor
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {items.length === 0 && (
            <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>Ask something worth reasoning about</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', marginTop: 4, lineHeight: 1.5 }}>
                The co-pilot builds a real house from your question — concepts, perspectives, cited
                evidence, assumptions, and implications, assembling live. It never writes the
                conclusion; you review and claim each layer in the builder. Each question becomes
                its own house on your dashboard.
              </div>
            </div>
          )}

          {items.map((m, i) =>
            m.kind === 'build' ? (
              <ChatBuildCard
                key={m.houseId}
                houseId={m.houseId}
                initial={m.initial}
                initialRev={m.rev}
                enabled={m.houseId === activeBuildId}
                concludeRequested={m.conclude}
                onSettled={handleSettled}
              />
            ) : (
              <div
                key={i}
                style={{
                  ...bubbleBase,
                  alignSelf: m.kind === 'user' ? 'flex-end' : 'flex-start',
                  background: m.kind === 'user' ? 'var(--amber-tint)' : 'var(--white)',
                }}
              >
                {m.text}
              </div>
            )
          )}

          {inFlight && (
            <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--ink-subtle)', padding: '2px 4px' }}>…</div>
          )}

          {errorCode && (
            <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>
              {errorCode === RATE_LIMITED_CODE ? (
                RATE_LIMITED_COPY
              ) : errorCode === 'forbidden' ? (
                'This page is admin-only.'
              ) : errorCode === 'signed-out' ? (
                'Signed out — log in again to keep going.'
              ) : errorCode === 'create-failed' ? (
                <>
                  Could not create the house.{' '}
                  <button type="button" onClick={() => void runIntake(items)} style={retryStyle}>
                    Retry
                  </button>
                </>
              ) : (
                <>
                  Could not reach the co-pilot.{' '}
                  <button type="button" onClick={() => void runIntake(items)} style={retryStyle}>
                    Retry
                  </button>
                </>
              )}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <input
            aria-label="Your question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
            placeholder={
              activeBuildId
                ? 'Wait for the current build to finish…'
                : 'Should our school ban homework?'
            }
            disabled={composerLocked}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              padding: '10px 12px',
              border: '1px solid var(--rule)',
              borderRadius: 9,
              background: 'var(--white)',
              color: 'var(--ink)',
              outline: 'none',
              opacity: composerLocked ? 0.65 : 1,
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={composerLocked || !input.trim()}
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--ink)',
              background: 'var(--amber-tint)',
              border: '1px solid var(--amber)',
              borderRadius: 9,
              padding: '0 18px',
              cursor: composerLocked || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: composerLocked || !input.trim() ? 0.6 : 1,
            }}
          >
            Ask
          </button>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginTop: 9,
            fontSize: 12,
            color: 'var(--ink-subtle)',
            lineHeight: 1.45,
            cursor: composerLocked ? 'default' : 'pointer',
            userSelect: 'none',
            opacity: composerLocked ? 0.65 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={concludeNext}
            onChange={(e) => setConcludeNext(e.target.checked)}
            disabled={composerLocked}
            style={{ accentColor: 'var(--amber)', margin: 0, flex: '0 0 auto' }}
          />
          <span>
            Draft conclusion candidates too — several disagreeing verdicts, each weighing the whole
            house, with their own implications. Adopting one stays your call.
          </span>
        </label>
      </div>
    </div>
  )
}

const retryStyle: React.CSSProperties = {
  color: 'var(--blueprint)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  textDecoration: 'underline',
}
