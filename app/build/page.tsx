'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// The id-less /build route no longer renders a house. It creates a fresh blank
// house for the signed-in user and redirects into /build/[id], where load +
// autosave live. This keeps entry points that link to bare /build working.
// ?draft=1 (Draft Mode, decision 016) is carried through to the workspace.
export default function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>
}) {
  const router = useRouter()
  const { draft } = use(searchParams)
  const draftRequested = draft === '1'

  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return

      const { data, error } = await supabase
        .from('houses')
        .insert({ owner_id: user.id })
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
  }, [router, draftRequested])

  return (
    <main
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
