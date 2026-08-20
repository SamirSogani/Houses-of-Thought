// Mechanism 2 ("Share") of plans/active/persistence/invite-share-panels.md,
// extended by plans/active/persistence/team-panel-v2.md items 3 and 6: the
// single place both the dashboard's HouseCard kebab menu (app/dashboard/
// page.tsx) and TeamPanel's owner-only share block (components/build/rail/
// TeamShareBlock.tsx) call to create/revoke a houses.share_token — so
// house_activity logging can never be skipped no matter which UI surface
// triggered it. A plain column UPDATE has no natural trigger hook the way
// house_collaborators/house_direct_messages inserts do (0036), which is why
// this needs an explicit application-level insert instead.
//
// The share_token UPDATE itself runs on the CALLER's OWN session (cookies),
// not service role — the existing owner-gated houses_update RLS (0004/0006/
// 0020) already allows it, so this route grants no new table access for that
// half. Only the house_activity insert needs service role: authenticated
// callers have no INSERT policy on that table by design (0036) — only
// SECURITY DEFINER triggers and this route write to it.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

let service: SupabaseClient | null = null
function serviceClient(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!service) {
    service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return service
}

interface HouseRow {
  id: string
  owner_id: string
  share_token: string | null
}

export async function POST(req: NextRequest) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'signed-out' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { houseId?: string; action?: string } | null
  const houseId = body?.houseId
  const action = body?.action
  if (!houseId || (action !== 'create' && action !== 'revoke')) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 })
  }

  // The caller's OWN session: houses_select/houses_update RLS (0004/0006/
  // 0020) is owner-gated for update, so a non-owner never reaches the
  // owner_id check below with a row that isn't theirs to act on anyway — this
  // read just lets us distinguish "not found" from "not yours" cleanly and
  // fetch the current token without a second round trip.
  const { data: house, error: readError } = await userClient
    .from('houses')
    .select('id, owner_id, share_token')
    .eq('id', houseId)
    .maybeSingle()
  if (readError) {
    console.error(`POST /api/share-link — house lookup failed: code=${readError.code} message=${readError.message}`)
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!house) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
  const houseRow = house as HouseRow
  if (houseRow.owner_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Idempotent both ways: creating when a token already exists just returns
  // it (no new token, no duplicate activity row); revoking when already null
  // is a no-op response, not an error.
  if (action === 'create' && houseRow.share_token) {
    return NextResponse.json({ shareToken: houseRow.share_token })
  }
  if (action === 'revoke' && !houseRow.share_token) {
    return NextResponse.json({ shareToken: null })
  }

  const nextToken = action === 'create' ? crypto.randomUUID() : null
  const { error: updateError } = await userClient.from('houses').update({ share_token: nextToken }).eq('id', houseId)
  if (updateError) {
    console.error(`POST /api/share-link — share_token update failed: code=${updateError.code} message=${updateError.message}`)
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }

  const client = serviceClient()
  if (!client) {
    console.error('POST /api/share-link — service role unavailable, activity not logged')
  } else {
    const { error: activityError } = await client.from('house_activity').insert({
      house_id: houseId,
      actor_id: user.id,
      kind: action === 'create' ? 'share_link_created' : 'share_link_revoked',
    })
    if (activityError) {
      // Non-fatal: the share link itself is already saved above — losing the
      // activity-log entry is a worse debugging experience, not a broken
      // feature, so this logs and continues rather than failing a write that
      // already succeeded.
      console.error(
        `POST /api/share-link — activity log insert failed: code=${activityError.code} message=${activityError.message}`
      )
    }
  }

  return NextResponse.json({ shareToken: nextToken })
}
