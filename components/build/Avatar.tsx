// Collaborator avatar. Humans render as circles; the AI renders as a rounded square
// holding a spark glyph. See handoff 01 §4.4 and 06 §1.

import type { PersonKey } from '@/lib/build/types'
import { people } from '@/lib/build/people'
import { SparkIcon } from './buildIcons'

export function Avatar({
  who,
  size = 26,
  ring = false,
  showSparkForAI = true,
  title,
  style,
}: {
  who: PersonKey
  size?: number
  ring?: boolean
  showSparkForAI?: boolean
  title?: string
  style?: React.CSSProperties
}) {
  const p = people[who]
  const isAI = who === 'ai'
  return (
    <span
      title={title ?? `${p.name} · ${p.role}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: isAI ? Math.round(size * 0.3) : '50%',
        background: p.bg,
        color: p.fg,
        fontFamily: 'var(--font-mono)',
        fontSize: Math.max(8, Math.round(size * 0.34)),
        fontWeight: 500,
        flex: '0 0 auto',
        ...(ring ? { border: '2px solid var(--parchment)' } : {}),
        ...style,
      }}
    >
      {isAI && showSparkForAI ? <SparkIcon size={Math.round(size * 0.55)} fill={p.fg} /> : p.initials}
    </span>
  )
}
