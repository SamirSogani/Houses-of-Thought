'use client'

// Student join-by-code (plan phase 2). The invite link is /join/<code>; this
// page redeems it via the join_class() RPC (which inserts the membership under
// SECURITY DEFINER) and sends the student to their dashboard. Auth is enforced
// by the proxy, so by here the user is signed in.

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const centerNotice: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  background: 'var(--parchment)',
  padding: '0 24px',
  textAlign: 'center',
}

export default function JoinClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    // Guard against React strict-mode double-invoke redeeming twice.
    if (ran.current) return
    ran.current = true

    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=/join/${code}`)
        return
      }
      // Normalize the URL segment (bl-L6): a code copied out of a chat app
      // often arrives with an encoded trailing space ("%20") — the RPC only
      // uppercases, so the raw segment failed with the generic error.
      let cleaned = code
      try {
        cleaned = decodeURIComponent(code).trim()
      } catch {
        // Malformed percent-encoding: fall through with the raw segment.
      }
      const { error } = await supabase.rpc('join_class', { code: cleaned })
      if (error) {
        setError('That join code is not valid. Check it with your teacher and try again.')
        return
      }
      // Land on /classes, not /dashboard (ux M5): the dashboard shows houses,
      // so joining a class used to produce no visible confirmation anywhere.
      // ?joined=1 lets that page acknowledge the join.
      router.replace('/classes?joined=1')
    })()
  }, [code, router])

  return (
    <main id="main" style={centerNotice}>
      {error ? (
        <>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink)', maxWidth: 420 }}>{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/dashboard')}
            className="btn-primary"
            style={{ justifyContent: 'center' }}
          >
            Go to your dashboard
          </button>
        </>
      ) : (
        <p className="mono" style={{ fontSize: 11, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--ink-subtle)' }}>
          Joining class…
        </p>
      )}
    </main>
  )
}
