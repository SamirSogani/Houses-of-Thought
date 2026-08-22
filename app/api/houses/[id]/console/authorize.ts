// Shared authorize() for every route under app/api/houses/[id]/console/,
// including the two chats/ routes added by plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md. Extracted
// verbatim out of route.ts's own copy — same gate, same rationale (owner or
// 'editor' collaborator, checked against the caller's own session, then
// capabilitiesFor(accountType).canAuthorDraft) — this file just lets the
// chats routes reuse it instead of a second pasted copy. Deliberately NOT
// merged with layer-feedback's or reasoning's own authorize() — those routes
// keep their own copies (plan doc 27/28's "deliberately kept independent"
// posture), this extraction is scoped to the console's own route family only.

import { createClient } from '@/lib/supabase/server'
import { getCallerCapabilities } from '@/lib/auth/account'
import { log } from '@/lib/log'

interface HouseAuthzRow {
  id: string
  owner_id: string
}

export async function authorize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated', status: 401 }

  const { data: houseRow, error: houseError } = await supabase
    .from('houses')
    .select('id, owner_id')
    .eq('id', houseId)
    .maybeSingle()
  if (houseError) {
    log.error('houses/console', 'house lookup failed', { error: houseError.message })
    return { ok: false, error: 'server-error', status: 500 }
  }
  if (!houseRow) return { ok: false, error: 'not-found', status: 404 }
  const house = houseRow as HouseAuthzRow

  let canEdit = house.owner_id === user.id
  if (!canEdit) {
    const { data: collabRow, error: collabError } = await supabase
      .from('house_collaborators')
      .select('role')
      .eq('house_id', houseId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (collabError) {
      log.error('houses/console', 'collaborator lookup failed', { error: collabError.message })
      return { ok: false, error: 'server-error', status: 500 }
    }
    canEdit = (collabRow as { role: string } | null)?.role === 'editor'
  }
  if (!canEdit) return { ok: false, error: 'forbidden', status: 403 }

  const caps = await getCallerCapabilities()
  if (!caps.canAuthorDraft) return { ok: false, error: 'draft-not-available', status: 403 }

  return { ok: true }
}
