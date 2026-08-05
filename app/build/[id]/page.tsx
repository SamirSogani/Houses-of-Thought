'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BuildHousePage } from '@/components/build/BuildHousePage'
import { loadHouse, saveHouse } from '@/lib/build/persistence'
import { capabilitiesFor } from '@/lib/auth/capabilities'
import { CenterNotice, useSignOut } from '@/components/useAuthedPage'
import type { AccountType } from '@/lib/profile/data'
import type { State } from '@/lib/build/types'

export default function BuildHouseRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ draft?: string; fromReasoningRun?: string }>
}) {
  const { id } = use(params)
  const { draft: draftParam, fromReasoningRun } = use(searchParams)
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
  // Owner's turned-in submission: read-only until they undo turn-in (bl-H2).
  const [turnedInLock, setTurnedInLock] = useState(false)
  const [feedback, setFeedback] = useState<'edit' | 'view' | null>(null)
  // Draft Mode (decision 016): cosmetic gate; the /api/ai/draft route re-checks
  // canAuthorDraft server-side.
  const [draftEligible, setDraftEligible] = useState(false)
  // Optimistic-concurrency token: the parent row's updated_at at load, advanced
  // on every successful save. A save presenting a stale token aborts with
  // 'stale-write' before touching any child rows (see saveHouse).
  const revRef = useRef<string | null>(null)

  // Route protection is handled by proxy.ts; here we load the house. A null
  // result means not-found or not-yours (RLS makes both look empty) → dashboard.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return

      const [{ data: profile }, { data: houseRow }, loadedHouse] = await Promise.all([
        supabase.from('profiles').select('account_type').eq('id', user.id).single(),
        supabase.from('houses').select('owner_id, is_strawman, assignment_id, turned_in').eq('id', id).single(),
        loadHouse(supabase, id),
      ])
      if (!active) return
      if (!loadedHouse) {
        router.replace('/dashboard')
        return
      }
      const { state, rev } = loadedHouse
      revRef.current = rev
      const caps = capabilitiesFor((profile?.account_type as AccountType) ?? 'standard')
      const isStrawman = houseRow?.is_strawman === true
      const notOwner = houseRow?.owner_id != null && houseRow.owner_id !== user.id
      // An assignment submission (strawmen also carry assignment_id but are the
      // teacher's artifact, not student work).
      const isAssignment = houseRow?.assignment_id != null && !isStrawman
      const turnedIn = !notOwner && !isStrawman && houseRow?.turned_in === true

      // Apply the forced mode before first render so the house never briefly
      // shows Decide-mode help. Assignment submissions are student work by
      // definition (bl-H5): they run in Learn mode regardless of the owner's
      // self-selected account type — one "Standard" signup in a class no longer
      // gets Decide-mode answers on graded work. (/api/ai/draft re-checks
      // server-side via houseId.)
      if (caps.forcedMode) state.mode = caps.forcedMode
      else if (isAssignment && !notOwner) state.mode = 'learn'
      setModeLocked(caps.forcedMode !== null || (isAssignment && !notOwner))
      setDraftEligible(caps.canAuthorDraft && !isAssignment)
      // Read-only whenever you're not the owner (teacher on a student's house,
      // student attacking a strawman) — and for the owner's own turned-in
      // submission until they undo turn-in (bl-H2). Teachers own their
      // strawmen, so they can still review/revise those.
      setStrawman(isStrawman)
      setReadOnly(notOwner || turnedIn)
      setTurnedInLock(turnedIn)
      // Grading surfaces exist only on assignment submissions (bl-M4): a
      // teacher reaching a student's PERSONAL house from the roster gets a
      // plain read-only view, not the grade panel.
      setFeedback(isStrawman || !isAssignment ? null : notOwner ? 'edit' : 'view')
      setUserEmail(user.email ?? null)
      setLoaded(state)
    })()
    return () => {
      active = false
    }
  }, [id, router])

  const signOut = useSignOut()

  if (loaded === null) {
    return <CenterNotice>Loading your house…</CenterNotice>
  }

  return (
    <BuildHousePage
      initialState={loaded}
      userEmail={userEmail}
      houseId={id}
      modeLocked={modeLocked || readOnly}
      readOnly={readOnly}
      strawman={strawman}
      turnedIn={turnedInLock}
      feedback={feedback}
      draftEligible={draftEligible}
      draftEntry={draftParam === '1'}
      fromReasoningRun={fromReasoningRun}
      onSignOut={() => void signOut()}
      // Read-only view: skip persistence so a teacher's stray edit never fails a
      // write it was never allowed to make. Otherwise: guarded save presenting
      // the rev token; a rejection propagates to BuildHousePage's save
      // controller (status UI, retry, conflict handling).
      onSave={
        readOnly
          ? () => {}
          : async (s) => {
              revRef.current = await saveHouse(
                createClient(),
                id,
                s,
                revRef.current ?? undefined
              )
            }
      }
    />
  )
}
