'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BuildHousePage } from '@/components/build/BuildHousePage'
import { loadHouse, saveHouse } from '@/lib/build/persistence'
import { capabilitiesFor } from '@/lib/auth/capabilities'
import type { AccountType } from '@/lib/profile/data'
import type { State } from '@/lib/build/types'

const centerNotice: React.CSSProperties = {
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
}

export default function BuildHouseRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ draft?: string }>
}) {
  const { id } = use(params)
  const { draft: draftParam } = use(searchParams)
  const router = useRouter()
  const [loaded, setLoaded] = useState<State | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  // Students are pinned to Learn mode (capabilities.ts); this locks the toggle.
  const [modeLocked, setModeLocked] = useState(false)
  // A teacher opening a student's house (via can_view_student_house RLS) can read
  // but not write — surface it and disable autosave so no edit silently fails.
  const [readOnly, setReadOnly] = useState(false)
  // A strawman house holds an AI-written flawed argument to attack, not edit.
  const [strawman, setStrawman] = useState(false)
  // Draft Mode (decision 016): cosmetic gate; the /api/ai/draft route re-checks
  // canAuthorDraft server-side.
  const [draftEligible, setDraftEligible] = useState(false)

  // Route protection is handled by middleware.ts; here we load the house. A null
  // result means not-found or not-yours (RLS makes both look empty) → dashboard.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return

      const [{ data: profile }, { data: houseRow }, state] = await Promise.all([
        supabase.from('profiles').select('account_type').eq('id', user.id).single(),
        supabase.from('houses').select('owner_id, is_strawman').eq('id', id).single(),
        loadHouse(supabase, id),
      ])
      if (!active) return
      if (!state) {
        router.replace('/dashboard')
        return
      }
      // Apply the account type's forced mode (students → 'learn') before first
      // render so the house never briefly shows Decide-mode help.
      const caps = capabilitiesFor((profile?.account_type as AccountType) ?? 'standard')
      if (caps.forcedMode) state.mode = caps.forcedMode
      setModeLocked(caps.forcedMode !== null)
      setDraftEligible(caps.canAuthorDraft)
      // Read-only whenever you're not the owner: a teacher viewing a student's
      // house, or a student attacking the teacher's strawman. The teacher owns
      // their strawman, so they can still review/revise it.
      const isStrawman = houseRow?.is_strawman === true
      const notOwner = houseRow?.owner_id != null && houseRow.owner_id !== user.id
      setStrawman(isStrawman)
      setReadOnly(notOwner)
      setUserEmail(user.email ?? null)
      setLoaded(state)
    })()
    return () => {
      active = false
    }
  }, [id, router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loaded === null) {
    return <main style={centerNotice}>Loading your house…</main>
  }

  return (
    <BuildHousePage
      initialState={loaded}
      userEmail={userEmail}
      houseId={id}
      modeLocked={modeLocked || readOnly}
      readOnly={readOnly}
      strawman={strawman}
      // Teacher assessing a student submission → editable feedback; the owner
      // (student) sees it read-only; strawman houses aren't graded.
      feedback={strawman ? null : readOnly ? 'edit' : 'view'}
      draftEligible={draftEligible}
      draftEntry={draftParam === '1'}
      onSignOut={handleSignOut}
      // Read-only view: skip persistence so a teacher's stray edit never fails a
      // write it was never allowed to make.
      onSave={readOnly ? () => {} : (s) => saveHouse(createClient(), id, s)}
    />
  )
}
