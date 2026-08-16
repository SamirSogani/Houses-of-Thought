'use client'

// Right rail — Team tab (Mechanism 1, "Invite", of
// plans/active/persistence/invite-share-panels.md). Replaces the Team tab that
// was removed in commit 1c49db6 for simulating a feature that didn't exist yet
// (fake collaborators, an inert Invite button). Every control here resolves to
// a real backend call: email resolution and the membership list go through
// app/api/collaborators/route.ts (service-role reads, gated by the caller's own
// session); invite/remove writes go straight to house_collaborators under the
// existing owner/self RLS from migration 0004 — no fake state, no toast that
// isn't backed by a persisted change.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Role = 'viewer' | 'editor'

interface Member {
  userId: string
  role: string
  username: string | null
  email: string | null
}

type InviteState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'error'; message: string }

function displayName(m: Member): string {
  return m.username || m.email || 'Unknown'
}

function initialsFor(m: Member): string {
  const name = displayName(m)
  return name.slice(0, 2).toUpperCase()
}

export function TeamPanel({
  houseId,
  currentUserId,
  isOwner,
}: {
  houseId: string
  currentUserId: string
  isOwner: boolean
}) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [invite, setInvite] = useState<InviteState>({ status: 'idle' })
  const [removing, setRemoving] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/collaborators?houseId=${encodeURIComponent(houseId)}`)
      if (!res.ok) {
        setListError("Couldn't load who has access to this house.")
        return
      }
      const body = (await res.json()) as { collaborators: Member[] }
      setListError(null)
      setMembers(body.collaborators)
    } catch {
      setListError("Couldn't load who has access to this house.")
    }
  }, [houseId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

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
      loadMembers()
    } catch {
      setInvite({ status: 'error', message: 'Network error — try again.' })
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
      if (!error) {
        setMembers((ms) => (ms ?? []).filter((m) => m.userId !== userId))
      }
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="fade-in">
      <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 11, padding: 13 }}>
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

      {listError && (
        <div style={{ fontSize: 12, color: 'var(--warning-text)', lineHeight: 1.45 }}>{listError}</div>
      )}

      {members === null && !listError && (
        <div style={{ fontSize: 12, color: 'var(--ink-subtle)' }}>Loading…</div>
      )}

      {members !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.45 }}>
              No one else has access yet.
            </div>
          )}
          {members.map((m) => {
            const isSelf = m.userId === currentUserId
            const canRemove = isOwner || isSelf
            return (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--rule)', borderRadius: 10, padding: '9px 11px' }}>
                <span
                  style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--parchment)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, flex: '0 0 auto' }}
                >
                  {initialsFor(m)}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--ink)' }}>
                  {displayName(m)}
                  {isSelf && <span style={{ color: 'var(--ink-subtle)' }}> · you</span>}
                </span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', flex: '0 0 auto' }}>{m.role}</span>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId)}
                    disabled={removing === m.userId}
                    aria-label={isSelf ? 'Leave this house' : `Remove ${displayName(m)}`}
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
    </div>
  )
}
