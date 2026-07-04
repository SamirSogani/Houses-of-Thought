'use client'

// Confirmation modal for the Danger Zone. Requires typing DELETE to enable the button.
// Actual account deletion is a destructive, backend-owned action and is NOT performed
// here (no persistence layer yet); the modal explains that on confirm.

import { useEffect, useState } from 'react'
import { XIcon } from '@/components/icons'

export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirmText, setConfirmText] = useState('')
  const [done, setDone] = useState(false)
  const armed = confirmText.trim().toUpperCase() === 'DELETE'

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
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,33,58,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete account"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440, maxWidth: '100%', background: 'var(--white)', borderRadius: 16, padding: 26, boxShadow: '0 24px 60px rgba(20,33,58,0.28)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--warning)' }}>Delete account</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, border: '1px solid var(--rule)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <XIcon size={16} />
          </button>
        </div>

        {done ? (
          <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginTop: 14, lineHeight: 1.55 }}>
            Account deletion will be available once accounts are backed by a database. Nothing was deleted.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginTop: 12, lineHeight: 1.55 }}>
              This permanently deletes your account and all associated data, including every house you have built. This action cannot be undone.
            </p>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.11em', color: 'var(--ink-subtle)', marginTop: 20, marginBottom: 8 }}>
              Type DELETE to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              style={{ width: '100%', height: 44, border: '1px solid var(--rule)', borderRadius: 9, padding: '0 14px', fontSize: 15, color: 'var(--ink)', background: 'var(--parchment)', outline: 'none' }}
            />
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ height: 42, padding: '0 16px', border: '1px solid var(--ink)', borderRadius: 8, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--white)' }}
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              type="button"
              disabled={!armed}
              onClick={() => setDone(true)}
              style={{
                height: 42,
                padding: '0 16px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                color: '#fff',
                background: 'var(--warning)',
                opacity: armed ? 1 : 0.45,
                cursor: armed ? 'pointer' : 'not-allowed',
              }}
            >
              Delete Account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
