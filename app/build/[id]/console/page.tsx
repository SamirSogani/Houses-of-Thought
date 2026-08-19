'use client'

// Post-pipeline console route (plan doc
// plans/active/reasoning-pipeline/28-post-pipeline-console.md). A dedicated
// page, not a modal inside /build/[id] — "opens up a new window," per
// Samir's own framing of the ask, reads as real web-app navigation (its own
// URL, survives a reload, revisitable) rather than a literal OS popup.
//
// Auth here mirrors app/build/[id]/page.tsx's own load, trimmed to what this
// page actually needs: owner or 'editor' collaborator, with real authoring
// capability — the same gate every API route this page calls
// (console/layer-feedback/reasoning) already enforces server-side. A caller
// who wouldn't pass that gate is sent back to the house itself rather than
// shown a console that would just 403 on every action.

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadHouse } from '@/lib/build/persistence'
import { capabilitiesFor } from '@/lib/auth/capabilities'
import { CenterNotice } from '@/components/useAuthedPage'
import type { AccountType } from '@/lib/profile/data'
import type { State } from '@/lib/build/types'
import { ConsolePage } from '@/components/build/console/ConsolePage'

export default function ConsoleRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loaded, setLoaded] = useState<State | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return

      const [{ data: profile }, { data: houseRow }, { data: collabRow }, loadedHouse] = await Promise.all([
        supabase.from('profiles').select('account_type').eq('id', user.id).single(),
        supabase.from('houses').select('owner_id').eq('id', id).maybeSingle(),
        supabase.from('house_collaborators').select('role').eq('house_id', id).eq('user_id', user.id).maybeSingle(),
        loadHouse(supabase, id),
      ])
      if (!active) return
      if (!loadedHouse) {
        router.replace('/dashboard')
        return
      }

      const caps = capabilitiesFor((profile?.account_type as AccountType) ?? 'standard')
      const notOwner = houseRow?.owner_id != null && houseRow.owner_id !== user.id
      const isEditor = (collabRow?.role as string | undefined) === 'editor'
      const canEdit = !notOwner || isEditor
      if (!canEdit || !caps.canAuthorDraft) {
        router.replace(`/build/${id}`)
        return
      }

      setLoaded(loadedHouse.state)
    })()
    return () => {
      active = false
    }
  }, [id, router])

  if (loaded === null) {
    return <CenterNotice>Loading the console…</CenterNotice>
  }

  return <ConsolePage houseId={id} initialState={loaded} />
}
