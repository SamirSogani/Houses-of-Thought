// Per-layer contextual empty states (September 2026 UX audit, item 2).
// Renders a muted, centered hint when a layer has no content yet. Disappears
// as soon as the user starts typing — the parent checks content and simply
// stops rendering this component.

const HINTS: Record<number, { icon: string; text: string }> = {
  1: {
    icon: '🏗',
    text: 'Set the scope — describe the question or decision you’re reasoning through.',
  },
  2: {
    icon: '👥',
    text: 'Add 2–3 independent viewpoints on your question.',
  },
  3: {
    icon: '📎',
    text: 'What facts, data, or sources support each perspective?',
  },
  4: {
    icon: '🧱',
    text: 'What are you taking for granted? Surface the hidden premises.',
  },
  5: {
    icon: '⚖️',
    text: 'Weigh the perspectives and reach your conclusion.',
  },
  6: {
    icon: '🔀',
    text: 'If each perspective is right, what follows?',
  },
  7: {
    icon: '🔍',
    text: 'Look back — what did you learn? What would you do differently?',
  },
}

export function LayerEmptyState({ step }: { step: number }) {
  const hint = HINTS[step]
  if (!hint) return null
  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '28px 20px',
        marginTop: 14,
        border: '1px dashed var(--rule)',
        borderRadius: 12,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 24 }} aria-hidden="true">
        {hint.icon}
      </span>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--ink-subtle)',
          maxWidth: '40ch',
          margin: 0,
        }}
      >
        {hint.text}
      </p>
    </div>
  )
}
