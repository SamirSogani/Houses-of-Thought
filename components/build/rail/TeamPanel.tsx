'use client'

// Right rail — Team tab (Mechanism 1, "Invite", of
// plans/active/persistence/invite-share-panels.md; extended by team-panel-v2
// with share, presence, DMs, and an activity log). Replaces the Team tab that
// was removed in commit 1c49db6 for simulating a feature that didn't exist yet
// (fake collaborators, an inert Invite button). Every control here resolves to
// a real backend call: invite/remove writes go straight to house_collaborators
// under the existing owner/self RLS from migration 0004; share goes through
// app/api/share-link/route.ts (team-panel-v2 item 3/6); presence pings
// house_presence directly (self-only upsert RLS, 0036); DMs read/write
// house_direct_messages directly (0036); the activity log at the bottom reads
// app/api/activity/route.ts, which resolves actor/target display names the
// same way app/api/collaborators/route.ts already does for the roster.
//
// Names + roles + presence come from `roster` (useTeamRoster, fetched once in
// BuildHousePage and shared with ContextBar) rather than a separate fetch here
// — so the Team tab and the top presence bar can never show two different
// answers for "who's on this house."

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { displayNameFor, formatLastActive, type RosterPerson, type TeamRoster } from '../useTeamRoster'
import { PersonHoverCard } from '../PersonHoverCard'
import { TeamShareBlock } from './TeamShareBlock'
import { TeamMessageThread } from './TeamMessageThread'
import { TeamActivityFeed } from './TeamActivityFeed'

type Role = 'viewer' | 'editor'

type InviteState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'error'; message: string }

const PRESENCE_PING_MS = 60_000

export function TeamPanel({
  houseId,
  currentUserId,
  isOwner,
  roster,
}: {
  houseId: string
  currentUserId: string
  isOwner: boolean
  roster: TeamRoster | null
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [invite, setInvite] = useState<InviteState>({ status: 'idle' })
  const [removing, setRemoving] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  // Set while a DM thread with one teammate is open — replaces the rest of
  // the panel (share/invite/membership/activity) with just that thread, same
  // pattern the mobile drawer uses for its own single-purpose views.
  const [thread, setThread] = useState<{ userId: string; name: string } | null>(null)

  const reload = useCallback(() => roster?.reload(), [roster])

  // team-panel-v2 item 4: ping own presence on mount + every ~60s while this
  // panel (the Team tab) is actually open — NOT whenever the house is open,
  // which is what ContextBar's read-only presence display does instead.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    async function ping() {
      if (!active) return
      const { error } = await supabase
        .from('house_presence')
        .upsert({ house_id: houseId, user_id: currentUserId, last_seen_at: new Date().toISOString() }, { onConflict: 'house_id,user_id' })
      if (error) console.error(`TeamPanel — presence ping failed: code=${error.code} message=${error.message}`)
    }
    ping()
    const id = setInterval(ping, PRESENCE_PING_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [houseId, currentUserId])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setInvite({ status: 'busy' })
    try {
      const res = await fetch('/api/collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const body = (await res.json().catch(() => ({}))) as { userId?: string; error?: string }
      if (!res.ok || !body.userId) {
        const message =
          body.error === 'not-found'
            ? "No account with that email. They'll need to sign up first."
            : body.error === 'rate-limited'
              ? 'Too many lookups — try again in a few minutes.'
              : "Couldn't find that account. Check the email and try again."
        setInvite({ status: 'error', message })
        return
      }
      if (body.userId === currentUserId) {
        setInvite({ status: 'error', message: "That's your own account — you already have full access." })
        return
      }
      const supabase = createClient()
      const { error } = await supabase.from('house_collaborators').insert({
        house_id: houseId,
        user_id: body.userId,
        role,
        invited_by: currentUserId,
      })
      if (error) {
        setInvite({
          status: 'error',
          message: error.code === '23505' ? 'That person already has access.' : "Couldn't add them — try again.",
        })
        return
      }
      setInvite({ status: 'idle' })
      setEmail('')
      reload()
    } catch {
      setInvite({ status: 'error', message: 'Network error — try again.' })
    }
  }

  // Owner-only, never self (a collaborator can't promote/demote themselves —
  // matches house_collaborators_update's RLS, which is owner-gated the same
  // way the insert/delete calls above already are).
  async function handleRoleChange(userId: string, newRole: Role) {
    setChangingRole(userId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('house_collaborators')
        .update({ role: newRole })
        .eq('house_id', houseId)
        .eq('user_id', userId)
      if (!error) reload()
    } finally {
      setChangingRole(null)
    }
  }

  async function handleRemove(userId: string) {
    setRemoving(userId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('house_collaborators')
        .delete()
        .eq('house_id', houseId)
        .eq('user_id', userId)
      if (!error) reload()
    } finally {
      setRemoving(null)
    }
  }

  if (thread) {
    return (
      <TeamMessageThread
        houseId={houseId}
        currentUserId={currentUserId}
        otherUserId={thread.userId}
        otherName={thread.name}
        onBack={() => setThread(null)}
      />
    )
  }

  const rows: RosterPerson[] = [...(roster?.owner ? [roster.owner] : []), ...(roster?.collaborators ?? [])]
  const loading = roster === null || (roster.loading && rows.length === 0)

  return (
    <div className="fade-in">
      {isOwner && <TeamShareBlock houseId={houseId} />}

      <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 11, padding: 13, marginTop: isOwner ? 16 : 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Team</div>
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
          {isOwner
            ? 'Invite someone with an account to reason on this house with you.'
            : 'Everyone with access to this house.'}
        </div>
      </div>

      {isOwner && (
        <form onSubmit={handleInvite} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Their email address"
            aria-label="Email to invite"
            style={{ height: 38, padding: '0 12px', fontSize: 14, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 8, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <div role="group" aria-label="Role" style={{ display: 'inline-flex', border: '1px solid var(--rule)', borderRadius: 8, overflow: 'hidden', background: 'var(--white)', flex: '0 0 auto' }}>
              {(['editor', 'viewer'] as Role[]).map((r) => {
                const active = role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    aria-pressed={active}
                    className="mono"
                    style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', padding: '0 12px', height: 36, border: 'none', color: active ? 'var(--ink)' : 'var(--ink-subtle)', background: active ? 'var(--amber-tint)' : 'transparent', fontWeight: active ? 700 : 500 }}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
            <button
              type="submit"
              disabled={invite.status === 'busy' || email.trim().length === 0}
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center', opacity: invite.status === 'busy' ? 0.6 : 1 }}
            >
              {invite.status === 'busy' ? 'Inviting…' : 'Invite'}
            </button>
          </div>
          {invite.status === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--warning-text)', lineHeight: 1.45 }}>{invite.message}</div>
          )}
        </form>
      )}

      <div style={{ marginTop: 20, marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)' }}>Who has access</span>
      </div>

      {roster?.error && (
        <div style={{ fontSize: 12, color: 'var(--warning-text)', lineHeight: 1.45 }}>{roster.error}</div>
      )}

      {loading && !roster?.error && <div style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>Loading…</div>}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45 }}>
              No one else has access yet.
            </div>
          )}
          {rows.map((m) => {
            const isSelf = m.userId === currentUserId
            const isOwnerRow = m.role === 'owner'
            const canRemove = !isOwnerRow && (isOwner || isSelf)
            const name = displayNameFor(m)
            const roleLabel = isOwnerRow ? 'Owner' : m.role === 'editor' ? 'Editor' : 'Viewer'
            return (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--rule)', borderRadius: 10, padding: '9px 11px' }}>
                <PersonHoverCard
                  id={m.userId}
                  name={name}
                  email={m.email}
                  roleLabel={roleLabel}
                  lastSeenIso={roster?.presence[m.userId]}
                  isSelf={isSelf}
                  size={26}
                />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--ink)' }}>
                  {name}
                  {isSelf && <span style={{ color: 'var(--ink-subtle)' }}> · you</span>}
                </span>
                {isOwnerRow ? (
                  <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', flex: '0 0 auto' }}>Owner</span>
                ) : isOwner && !isSelf ? (
                  <RoleToggle
                    role={m.role as Role}
                    busy={changingRole === m.userId}
                    onChange={(r) => handleRoleChange(m.userId, r)}
                    label={`Role for ${name}`}
                  />
                ) : (
                  <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', flex: '0 0 auto' }}>{m.role}</span>
                )}
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => setThread({ userId: m.userId, name })}
                    aria-label={`Message ${name}`}
                    title="Send a message"
                    style={{ flex: '0 0 auto', fontSize: 11, color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  >
                    Message
                  </button>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId)}
                    disabled={removing === m.userId}
                    aria-label={isSelf ? 'Leave this house' : `Remove ${name}`}
                    title={isSelf ? 'Leave this house' : 'Remove access'}
                    style={{ flex: '0 0 auto', fontSize: 11, color: 'var(--warning-text)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  >
                    {isSelf ? 'Leave' : 'Remove'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <TeamActivityFeed houseId={houseId} currentUserId={currentUserId} />
    </div>
  )
}

function RoleToggle({
  role,
  busy,
  onChange,
  label,
}: {
  role: Role
  busy: boolean
  onChange: (r: Role) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden', flex: '0 0 auto', opacity: busy ? 0.6 : 1 }}>
      {(['editor', 'viewer'] as Role[]).map((r) => {
        const active = role === r
        return (
          <button
            key={r}
            type="button"
            onClick={() => !active && onChange(r)}
            disabled={busy}
            aria-pressed={active}
            className="mono"
            style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.02em', padding: '3px 8px', border: 'none', color: active ? 'var(--ink)' : 'var(--ink-subtle)', background: active ? 'var(--amber-tint)' : 'transparent', fontWeight: active ? 700 : 500, cursor: active ? 'default' : 'pointer' }}
          >
            {r}
          </button>
        )
      })}
    </div>
  )
}
