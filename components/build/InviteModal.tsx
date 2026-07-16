// Invite modal. See handoff 05 §14 / 04 §11 / 06 §5.

import { useEffect, useRef } from 'react'
import type { Action } from '@/lib/build/types'
import { XIcon } from '@/components/icons'
import { LinkChainIcon } from './buildIcons'

export function InviteModal({
  inviteInput,
  copied,
  dispatch,
}: {
  inviteInput: string
  copied: boolean
  dispatch: React.Dispatch<Action>
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dispatch({ type: 'CLOSE_INVITE' })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dispatch])

  return (
    <div
      onClick={() => dispatch({ type: 'CLOSE_INVITE' })}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,33,58,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        className="pop bhp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Invite co-builders"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440, maxWidth: '100%', background: 'var(--white)', borderRadius: 16, padding: 26, boxShadow: '0 24px 60px rgba(20,33,58,0.28)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)' }}>Invite co-builders</span>
          <button type="button" aria-label="Close" onClick={() => dispatch({ type: 'CLOSE_INVITE' })} style={{ width: 32, height: 32, border: '1px solid var(--rule)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <XIcon size={16} />
          </button>
        </div>

        <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginTop: 8, lineHeight: 1.5 }}>
          Bring people into this house. Each co-builder can own perspectives, add evidence, and comment. The co-pilot stays available to everyone.
        </p>

        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginTop: 20 }}>Email or name</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            ref={inputRef}
            className="bhp-input16"
            value={inviteInput}
            onChange={(e) => dispatch({ type: 'SET_INVITE_INPUT', value: e.target.value })}
            placeholder="maya@school.edu"
            style={{ flex: 1, height: 44, border: '1px solid var(--rule)', borderRadius: 9, padding: '0 14px', fontSize: 15, color: 'var(--ink)', background: 'var(--white)', outline: 'none' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
          />
          <button
            type="button"
            onClick={() => dispatch({ type: 'SEND_INVITE' })}
            style={{ height: 44, padding: '0 17px', background: 'var(--amber)', color: 'var(--ink)', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--amber-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--amber)')}
          >
            Send
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--rule-soft)' }}>
          <LinkChainIcon size={16} />
          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-mid)' }}>Anyone with the link can request to join</span>
          <button type="button" onClick={() => dispatch({ type: 'COPY_LINK' })} className="mono bhp-pad-tap" style={{ fontSize: 10, color: 'var(--ink)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--amber-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  )
}
