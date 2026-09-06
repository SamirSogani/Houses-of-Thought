'use client'

// Confirmation modal for bulk-deleting houses. Mirrors the overlay + dialog +
// confirm/cancel structure of DeleteAccountModal, but scoped to house cleanup.
// Traps focus (a11y) and closes on Escape or backdrop click.

import { useEffect, useState } from 'react'
import { XIcon } from '@/components/icons'
import { useFocusTrap } from '@/components/useFocusTrap'

export function BulkDeleteModal({
  count,
  onConfirm,
  onClose,
}: {
  count: number
  onConfirm: () => void
  onClose: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const dialogRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleConfirm() {
    setDeleting(true)
    onConfirm()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(20,33,58,0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Delete houses"
        className="acct-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '100%',
          background: 'var(--white)',
          borderRadius: 16,
          padding: 26,
          boxShadow: '0 24px 60px rgba(20,33,58,0.28)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--warning-text)' }}>
            Delete {count} {count === 1 ? 'house' : 'houses'}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              border: '1px solid var(--rule)',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginTop: 12, lineHeight: 1.55 }}>
          This will permanently delete {count === 1 ? 'this house' : `these ${count} houses`} and
          all of {count === 1 ? 'its' : 'their'} content. This action cannot be undone.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 42,
              padding: '0 16px',
              border: '1px solid var(--ink)',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--ink)',
              background: 'var(--white)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleConfirm}
            style={{
              height: 42,
              padding: '0 16px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              color: '#fff',
              background: 'var(--warning)',
              opacity: deleting ? 0.55 : 1,
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            {deleting ? 'Deleting…' : `Delete ${count === 1 ? 'house' : 'houses'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
