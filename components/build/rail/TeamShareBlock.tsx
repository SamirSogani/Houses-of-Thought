'use client'

// team-panel-v2 item 3: "Get/Copy/Revoke share link" moved into TeamPanel,
// owner-only, at the top — the dashboard's HouseCard kebab menu keeps the
// same actions too (app/dashboard/page.tsx), both calling the same
// app/api/share-link/route.ts so houses.share_token and its house_activity
// logging stay correct no matter which surface triggered it.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LinkChainIcon } from '../buildIcons'

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string } | { kind: 'notice'; message: string }

export function TeamShareBlock({ houseId }: { houseId: string }) {
  const [shareToken, setShareToken] = useState<string | null | undefined>(undefined) // undefined = loading
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('houses').select('share_token').eq('id', houseId).single()
      if (!active) return
      if (error) {
        console.error(`TeamShareBlock — share_token lookup failed: code=${error.code} message=${error.message}`)
        setShareToken(null)
        return
      }
      setShareToken((data as { share_token: string | null }).share_token)
    })()
    return () => {
      active = false
    }
  }, [houseId])

  async function call(action: 'create' | 'revoke') {
    setStatus({ kind: 'busy' })
    try {
      const res = await fetch('/api/share-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ houseId, action }),
      })
      const body = (await res.json().catch(() => ({}))) as { shareToken?: string | null; error?: string }
      if (!res.ok) {
        setStatus({ kind: 'error', message: 'Could not update the share link — try again.' })
        return
      }
      setShareToken(body.shareToken ?? null)
      if (action === 'revoke') {
        setStatus({ kind: 'notice', message: 'Share link revoked.' })
        return
      }
      const url = `${window.location.origin}/shared/${body.shareToken}`
      try {
        await navigator.clipboard.writeText(url)
        setStatus({ kind: 'notice', message: 'Share link copied to clipboard.' })
      } catch {
        setStatus({ kind: 'notice', message: `Share link: ${url}` })
      }
    } catch {
      setStatus({ kind: 'error', message: 'Network error — try again.' })
    }
  }

  const busy = status.kind === 'busy'

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <LinkChainIcon size={14} />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Share link</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
        Anyone with the link gets a read-only view — no account needed.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => call('create')}
          disabled={busy || shareToken === undefined}
          className="btn-primary"
          style={{ flex: 1, justifyContent: 'center', fontSize: 12, opacity: busy ? 0.6 : 1 }}
        >
          {shareToken ? 'Copy share link' : 'Get share link'}
        </button>
        {shareToken && (
          <button
            type="button"
            onClick={() => call('revoke')}
            disabled={busy}
            style={{ fontSize: 12, color: 'var(--warning-text)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 8, padding: '0 12px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            Revoke
          </button>
        )}
      </div>
      {(status.kind === 'error' || status.kind === 'notice') && (
        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45, color: status.kind === 'error' ? 'var(--warning-text)' : 'var(--green-text)' }}>
          {status.message}
        </div>
      )}
    </div>
  )
}
