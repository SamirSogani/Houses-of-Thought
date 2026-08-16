'use client'

// team-panel-v2 item 6: scrollable activity log at the bottom of TeamPanel.
// Reads app/api/activity/route.ts, which resolves house_activity's bare
// actor_id/detail user ids into display names via service role (profiles
// RLS is owner-only — same problem app/api/collaborators/route.ts already
// solves for the membership list). Poll-based, no realtime.

import { useCallback, useEffect, useState } from 'react'

interface ActivityRow {
  id: string
  kind: string
  createdAt: string
  actorId: string | null
  actorName: string | null
  targetId: string | null
  targetName: string | null
  detail: Record<string, unknown> | null
}

const POLL_MS = 20_000

function who(id: string | null, name: string | null, currentUserId: string): string {
  if (id && id === currentUserId) return 'You'
  return name ?? 'Someone'
}

function describe(row: ActivityRow, currentUserId: string): string {
  const actor = who(row.actorId, row.actorName, currentUserId)
  const target = who(row.targetId, row.targetName, currentUserId)
  switch (row.kind) {
    case 'invited':
      return `${actor} invited ${target} as ${String(row.detail?.role ?? 'a collaborator')}`
    case 'role_changed':
      return `${actor} changed ${target}'s role to ${String(row.detail?.new_role ?? '')}`
    case 'removed':
      return `${actor} removed ${target}`
    case 'left':
      return `${actor} left the house`
    case 'share_link_created':
      return `${actor} created a share link`
    case 'share_link_revoked':
      return `${actor} revoked the share link`
    case 'message_sent':
      return `${actor} messaged ${target}`
    default:
      return `${actor} — ${row.kind}`
  }
}

export function TeamActivityFeed({ houseId, currentUserId }: { houseId: string; currentUserId: string }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/activity?houseId=${encodeURIComponent(houseId)}`)
      if (!res.ok) {
        setError("Couldn't load recent activity.")
        return
      }
      const body = (await res.json()) as { activity: ActivityRow[] }
      setError(null)
      setRows(body.activity)
    } catch {
      setError("Couldn't load recent activity.")
    }
  }, [houseId])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>Recent activity</span>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--warning-text)' }}>{error}</div>}
      {rows === null && !error && <div style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>Loading…</div>}
      {rows !== null && rows.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45 }}>Nothing yet.</div>
      )}
      {rows !== null && rows.length > 0 && (
        <div className="build-scroll" style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.4, borderBottom: '1px solid var(--rule-soft)', paddingBottom: 7 }}>
              {describe(r, currentUserId)}
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', marginTop: 2 }}>
                {new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
