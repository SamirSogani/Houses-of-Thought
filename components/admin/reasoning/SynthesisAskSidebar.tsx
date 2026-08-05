'use client'

// Ask-AI sidebar for the pro/con synthesis page. A fresh implementation of
// RightRail.tsx's shell pattern (fixed 320px desktop aside; a slide-over
// drawer + useFocusTrap below 1024px) — not importing RightRail itself,
// since it's coupled to the Build reducer (State/Action) this page has
// nothing to do with. Transcript styling mirrors HouseChat.tsx's bubbles.
//
// All state (the transcript, in-flight/error status) is owned by the parent
// (SynthesisPage.tsx) and passed in — this component only owns which of the
// two shells is showing on mobile, exactly like BuildHousePage's railOpen.

import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '@/components/useFocusTrap'
import { useIsMobile } from '@/components/build/useIsMobile'
import { XIcon } from '@/components/icons'
import { SparkIcon } from '@/components/build/buildIcons'
import type { SynthesisChatTurn } from '@/lib/ai/reasoning/synthesis'

const bubbleBase: React.CSSProperties = {
  maxWidth: '90%',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--ink)',
  border: '1px solid var(--rule)',
  borderRadius: 10,
  padding: '9px 12px',
}

interface AskPanelProps {
  chat: SynthesisChatTurn[]
  sending: boolean
  errorMsg: string | null
  onSend: (question: string) => void
}

function AskHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px 12px',
        borderBottom: '1px solid var(--rule)',
      }}
    >
      <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Ask about this run</span>
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}
        >
          <XIcon size={16} />
        </button>
      )}
    </div>
  )
}

function AskPanelBody({ chat, sending, errorMsg, onSend }: AskPanelProps) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat.length, sending])

  function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    onSend(text)
  }

  return (
    <>
      <div
        className="build-scroll"
        style={{ flex: '1 1 auto', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {chat.length === 0 && !sending && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
            Ask a follow-up question — grounded in this run&apos;s own material and the synthesis above, nothing else.
          </div>
        )}
        {chat.map((turn, i) => (
          <div
            key={i}
            style={{
              ...bubbleBase,
              alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
              background: turn.role === 'user' ? 'var(--amber-tint)' : 'var(--white)',
            }}
          >
            {turn.content}
          </div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--ink-subtle)' }}>…</div>}
        {errorMsg && <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>{errorMsg}</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--rule)' }}>
        <input
          aria-label="Ask a question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
          placeholder="Ask about this run…"
          disabled={sending}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            padding: '8px 10px',
            border: '1px solid var(--rule)',
            borderRadius: 8,
            background: 'var(--white)',
            color: 'var(--ink)',
            outline: 'none',
            opacity: sending ? 0.65 : 1,
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            fontWeight: 600,
            fontSize: 12.5,
            color: 'var(--ink)',
            background: 'var(--amber-tint)',
            border: '1px solid var(--amber)',
            borderRadius: 8,
            padding: '0 14px',
            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !input.trim() ? 0.6 : 1,
          }}
        >
          Ask
        </button>
      </div>
    </>
  )
}

function MobileDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const drawerRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(20,33,58,0.42)' }}>
      <div
        ref={drawerRef}
        className="fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Ask about this run"
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
        <AskHeader onClose={onClose} />
        {children}
      </div>
    </div>
  )
}

export function SynthesisAskSidebar(props: AskPanelProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (!isMobile) {
    return (
      <aside
        style={{
          flex: '0 0 320px',
          background: 'var(--white)',
          borderLeft: '1px solid var(--rule)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <AskHeader />
        <AskPanelBody {...props} />
      </aside>
    )
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask about this run"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            zIndex: 45,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 48,
            padding: '0 18px',
            background: 'var(--ink)',
            color: 'var(--parchment)',
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 14,
            boxShadow: '0 12px 32px rgba(20,33,58,0.3)',
          }}
        >
          <SparkIcon size={15} fill="var(--amber)" />
          Ask AI
        </button>
      )}
      {open && (
        <MobileDrawer onClose={() => setOpen(false)}>
          <AskPanelBody {...props} />
        </MobileDrawer>
      )}
    </>
  )
}
