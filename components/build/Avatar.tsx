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

// ── Real-person avatars (team-panel-v2) ─────────────────────────────────────
// The house owner and collaborators are real accounts, not lib/build/types.ts
// PersonKeys — they have no fixed color the way 'you'/'ai' do (and giving them
// one would mean touching PersonKey/owner_key attribution, which is
// explicitly out of scope). Each user's avatar color is instead derived
// deterministically from their id, so it's stable across renders/sessions
// without a lookup table. Palette reuses 'you'/'maya'/'devan''s swatches plus
// two more so five distinct colors rotate before any repeat.
const REAL_PERSON_PALETTE: { bg: string; fg: string }[] = [
  { bg: '#14213A', fg: '#F7F6F2' },
  { bg: '#3F8F5B', fg: '#FFFFFF' },
  { bg: '#3E5C8A', fg: '#FFFFFF' },
  { bg: '#A5453A', fg: '#FFFFFF' },
  { bg: '#6B4E9B', fg: '#FFFFFF' },
]

function hashToIndex(id: string, mod: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % mod
}

export function initialsForName(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '??'
}

// Avatar for a real person (house owner or collaborator) — same visual shape
// as Avatar's human case above, but colored/initialed from real profile data
// (id, display name) instead of the fixed lib/build/people.ts palette.
export function RealAvatar({
  id,
  name,
  size = 26,
  ring = false,
  title,
  style,
}: {
  id: string
  name: string
  size?: number
  ring?: boolean
  title?: string
  style?: React.CSSProperties
}) {
  const { bg, fg } = REAL_PERSON_PALETTE[hashToIndex(id, REAL_PERSON_PALETTE.length)]
  return (
    <span
      title={title ?? name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        fontFamily: 'var(--font-mono)',
        fontSize: Math.max(8, Math.round(size * 0.34)),
        fontWeight: 500,
        flex: '0 0 auto',
        ...(ring ? { border: '2px solid var(--parchment)' } : {}),
        ...style,
      }}
    >
      {initialsForName(name)}
    </span>
  )
}
