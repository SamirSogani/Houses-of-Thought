'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// The id-less /build route no longer renders a house. It creates a fresh blank
// house for the signed-in user and redirects into /build/[id], where load +
// autosave live. This keeps entry points that link to bare /build working.
// ?draft=1 (Draft Mode, decision 016) is carried through to the workspace.
// ?q=… (from the /try conversion CTA → login → build redirect) pre-fills the
// house's Frame-layer question so the user picks up where they left off.
export default function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; q?: string }>
}) {
  const router = useRouter()
  const { draft, q } = use(searchParams)
  const draftRequested = draft === '1'
  const prefillQuestion = q?.trim() || null

  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return

      const insert: Record<string, unknown> = { owner_id: user.id }
      if (prefillQuestion) insert.question = prefillQuestion

      const { data, error } = await supabase
        .from('houses')
        .insert(insert)
        .select('id')
        .single()
      if (!active) return
      if (error || !data) {
        console.error('Failed to create house:', error)
        router.replace('/dashboard')
        return
      }
      router.replace(`/build/${data.id}${draftRequested ? '?draft=1' : ''}`)
    })()
    return () => {
      active = false
    }
  }, [router, draftRequested, prefillQuestion])

  return (
    <main
      id="main"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--parchment)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        color: 'var(--ink-subtle)',
      }}
    >
      Creating your house…
    </main>
  )
}
