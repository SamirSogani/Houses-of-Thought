'use client'

// Shared by ContextBar (real presence avatars) and RightRail/TeamPanel (the
// same names + last-active data, so hovering a name in either place agrees
// with the other) — fetched ONCE here, at the BuildHousePage level, and
// threaded down as props (team-panel-v2 item 1/4). Without this, ContextBar
// and TeamPanel would each run their own independent /api/collaborators call
// and their own independent house_presence poll for the exact same house.
//
// Presence is READ here (poll every ~60s) for both consumers; it is only ever
// WRITTEN (pinged) by TeamPanel itself while the Team tab is actually open
// (team-panel-v2 item 4) — ContextBar never pings, it only displays.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TeamContext } from './RightRail'

export type MemberRole = 'owner' | 'viewer' | 'editor'

export interface RosterPerson {
  userId: string
  role: MemberRole
  username: string | null
  email: string | null
}

export interface TeamRoster {
  owner: RosterPerson | null
  collaborators: RosterPerson[]
  // user_id -> house_presence.last_seen_at (ISO), for whoever has ever pinged.
  presence: Record<string, string>
  loading: boolean
  error: string | null
  // Re-fetch names/roles now (after an invite/remove/role-change mutation).
  reload: () => void
}

const PRESENCE_POLL_MS = 60_000

export function displayNameFor(p: Pick<RosterPerson, 'username' | 'email'>): string {
  return p.username || p.email || 'Unknown'
}

// "active now" / "active 12m ago" / "active 3d ago" — team-panel-v2 item 4's
// exact wording. Mirrors lib/dashboard/houses.ts's editedLabel shape.
export function formatLastActive(iso: string | null | undefined): string {
  if (!iso) return 'never active here'
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr
  if (diffMs < 2 * min) return 'active now'
  if (diffMs < hr) return `active ${Math.max(1, Math.floor(diffMs / min))}m ago`
  if (diffMs < day) return `active ${Math.floor(diffMs / hr)}h ago`
  return `active ${Math.floor(diffMs / day)}d ago`
}

// Google Docs/Word-style presence: an avatar reads as "here" (full color) or
// "away" (faded) at a glance, no hover needed to tell the two apart. 5 minutes
// is more generous than formatLastActive's 2-minute "active now" wording,
// since TeamPanel only pings every ~60s while open — a still-present
// collaborator can otherwise flicker to "away" between pings.
const ACTIVE_THRESHOLD_MS = 5 * 60_000
export function isRecentlyActive(iso: string | null | undefined): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < ACTIVE_THRESHOLD_MS
}

export function useTeamRoster(team: TeamContext | null): TeamRoster {
  const [owner, setOwner] = useState<RosterPerson | null>(null)
  const [collaborators, setCollaborators] = useState<RosterPerson[]>([])
  const [presence, setPresence] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRoster = useCallback(async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/collaborators?houseId=${encodeURIComponent(team.houseId)}`)
      if (!res.ok) {
        setError("Couldn't load who has access to this house.")
        setLoading(false)
        return
      }
      const body = (await res.json()) as {
        owner: { userId: string; username: string | null; email: string | null } | null
        collaborators: { userId: string; role: string; username: string | null; email: string | null }[]
      }
      setError(null)
      setOwner(body.owner ? { ...body.owner, role: 'owner' } : null)
      setCollaborators(
        body.collaborators.map((c) => ({ ...c, role: c.role as MemberRole }))
      )
    } catch {
      setError("Couldn't load who has access to this house.")
    } finally {
      setLoading(false)
    }
  }, [team])

  const loadPresence = useCallback(async () => {
    if (!team) return
    const supabase = createClient()
    const { data } = await supabase
      .from('house_presence')
      .select('user_id, last_seen_at')
      .eq('house_id', team.houseId)
    if (data) {
      setPresence(
        Object.fromEntries((data as { user_id: string; last_seen_at: string }[]).map((r) => [r.user_id, r.last_seen_at]))
      )
    }
  }, [team])

  useEffect(() => {
    loadRoster()
    loadPresence()
  }, [loadRoster, loadPresence])

  useEffect(() => {
    if (!team) return
    const id = setInterval(loadPresence, PRESENCE_POLL_MS)
    return () => clearInterval(id)
  }, [team, loadPresence])

  return { owner, collaborators, presence, loading, error, reload: loadRoster }
}
