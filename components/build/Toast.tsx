// Bottom-center ink pill with a green check. See handoff 05 §16 / 04 §13.

import { CheckIcon } from '@/components/icons'

export function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="pop"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 80,
        background: 'var(--ink)',
        color: 'var(--parchment)',
        borderRadius: 10,
        padding: '12px 20px',
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 12px 32px rgba(20,33,58,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <CheckIcon size={16} />
      {message}
    </div>
  )
}
