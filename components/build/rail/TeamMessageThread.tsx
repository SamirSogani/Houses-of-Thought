'use client'

// team-panel-v2 item 5: a "Message" affordance next to each teammate opens
// this — a small thread between exactly two people who both have standing on
// the house (house_direct_messages_insert RLS, 0036, enforces the standing
// check server-side regardless of what this component sends). Simple send +
// poll-based list, no realtime infra anywhere in this codebase.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft } from '../buildIcons'

interface MessageRow {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
}

const POLL_MS = 5_000

export function TeamMessageThread({
  houseId,
  currentUserId,
  otherUserId,
  otherName,
  onBack,
}: {
  houseId: string
  currentUserId: string
  otherUserId: string
  otherName: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<MessageRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error: loadError } = await supabase
      .from('house_direct_messages')
      .select('id, sender_id, recipient_id, body, created_at')
      .eq('house_id', houseId)
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true })
    if (loadError) {
      console.error(`TeamMessageThread — load failed: code=${loadError.code} message=${loadError.message}`)
      setError("Couldn't load this conversation.")
      return
    }
    setError(null)
    setMessages((data ?? []) as MessageRow[])
  }, [houseId, currentUserId, otherUserId])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      const supabase = createClient()
      const { error: sendError } = await supabase.from('house_direct_messages').insert({
        house_id: houseId,
        sender_id: currentUserId,
        recipient_id: otherUserId,
        body: trimmed,
      })
      if (sendError) {
        console.error(`TeamMessageThread — send failed: code=${sendError.code} message=${sendError.message}`)
        setError("Couldn't send that — try again.")
        return
      }
      setDraft('')
      setError(null)
      load()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 320 }}>
      <button
        type="button"
        onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start', fontSize: 12, color: 'var(--ink-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 10px' }}
      >
        <ChevronLeft size={12} /> Back to Team
      </button>

      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 10 }}>{otherName}</div>

      <div
        ref={listRef}
        className="build-scroll"
        style={{ flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2, minHeight: 120 }}
      >
        {messages === null && <div style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>Loading…</div>}
        {messages !== null && messages.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45 }}>
            No messages yet — say hello.
          </div>
        )}
        {messages?.map((m) => {
          const mine = m.sender_id === currentUserId
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '84%',
                  background: mine ? 'var(--amber-tint)' : 'var(--parchment)',
                  border: '1px solid var(--rule)',
                  borderRadius: 10,
                  padding: '7px 10px',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', marginTop: 3 }}>
                  {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--warning-text)', marginTop: 8 }}>{error}</div>}

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${otherName}…`}
          aria-label={`Message ${otherName}`}
          style={{ flex: 1, height: 38, padding: '0 12px', fontSize: 14, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 8, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className="btn-primary"
          style={{ opacity: sending ? 0.6 : 1 }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
