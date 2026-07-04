// Right rail — Team tab. People + presence + activity feed + inline Invite.
// See handoff 05 §13 / 06.

import type { PersonKey } from '@/lib/build/types'
import { people, seededPresence, activityFeed } from '@/lib/build/people'
import { layerKey } from '@/lib/build/content'
import { Avatar } from '../Avatar'

const order: PersonKey[] = ['you', 'maya', 'devan', 'ai']

export function TeamPanel({ step, onInvite }: { step: number; onInvite: () => void }) {
  const humanCount = order.filter((k) => k !== 'ai').length

  function presenceFor(k: PersonKey): { text: string; dot: string } {
    if (k === 'you') return { text: `On ${layerKey(step)}`, dot: 'var(--green-strong)' }
    return seededPresence[k as Exclude<PersonKey, 'you'>]
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>{humanCount} people · 1 co-pilot</span>
        <button type="button" onClick={onInvite} className="mono" style={{ fontSize: 10, color: 'var(--ink)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--amber-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        >
          + Invite
        </button>
      </div>

      {/* People list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        {order.map((k) => {
          const p = people[k]
          const pres = presenceFor(k)
          return (
            <div key={k} style={{ display: 'flex', gap: 11, alignItems: 'center', border: '1px solid var(--rule)', borderRadius: 11, padding: '11px 13px' }}>
              <Avatar who={k} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{p.name}</span>
                  <span className="mono" style={{ fontSize: 8, color: 'var(--ink-subtle)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>{p.role}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: pres.dot, flex: '0 0 auto' }} />
                  <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{pres.text}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Activity feed */}
      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', margin: '20px 0 10px' }}>Recent activity</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activityFeed.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Avatar who={a.owner} size={20} />
            <div style={{ fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--ink)' }}>{a.who}</strong> {a.what}{' '}
              <span className="mono" style={{ fontSize: 8, color: 'var(--ink-subtle)' }}>{a.when}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
