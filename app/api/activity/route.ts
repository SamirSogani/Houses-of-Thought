// team-panel-v2 item 6: house_activity's rows carry bare actor_id/detail user
// ids, not names — public.profiles' SELECT RLS is owner-only (0001), so a
// collaborator reading their own can_access_house-scoped house_activity rows
// still can't resolve anyone else's id to a display name. Same problem
// app/api/collaborators/route.ts already solves for the membership list;
// this route does the same thing for the activity feed, via service role,
// after checking the caller's OWN session first.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ACTIVITY_LIMIT = 50

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

interface ActivityRowDb {
  id: string
  actor_id: string | null
  kind: string
  detail: Record<string, unknown> | null
  created_at: string
}

interface ProfileRow {
  id: string
  username: string | null
  email: string | null
}

// The other person's id referenced by an activity row's detail, if any — the
// user being invited/removed/re-roled, or the DM recipient. share_link_*
// events have no target.
function targetIdFor(kind: string, detail: Record<string, unknown> | null): string | null {
  if (!detail) return null
  const raw = kind === 'message_sent' ? detail.recipient_id : detail.user_id
  return typeof raw === 'string' ? raw : null
}

export async function GET(req: NextRequest) {
  const houseId = req.nextUrl.searchParams.get('houseId')
  if (!houseId) {
    return NextResponse.json({ error: 'missing-house-id' }, { status: 400 })
  }

  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'signed-out' }, { status: 401 })
  }

  // Authorize with the CALLER's own session — houses_select RLS already
  // resolves to "owner or collaborator", matching house_activity_select's own
  // can_access_house policy (0036); a row coming back here means this caller
  // may legitimately read this house's activity.
  const { data: house } = await userClient.from('houses').select('id').eq('id', houseId).maybeSingle()
  if (!house) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }

  const client = serviceClient()
  if (!client) {
    console.error('GET /api/activity — service role unavailable')
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }

  const { data: activityData, error: activityError } = await client
    .from('house_activity')
    .select('id, actor_id, kind, detail, created_at')
    .eq('house_id', houseId)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LIMIT)
  if (activityError) {
    console.error(
      `GET /api/activity — activity query failed: code=${activityError.code} message=${activityError.message}`
    )
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  const rows = (activityData ?? []) as ActivityRowDb[]

  const ids = new Set<string>()
  for (const r of rows) {
    if (r.actor_id) ids.add(r.actor_id)
    const target = targetIdFor(r.kind, r.detail)
    if (target) ids.add(target)
  }

  let profiles: ProfileRow[] = []
  if (ids.size > 0) {
    const { data: profileData, error: profileError } = await client
      .from('profiles')
      .select('id, username, email')
      .in('id', Array.from(ids))
    if (profileError) {
      console.error(
        `GET /api/activity — profile lookup failed: code=${profileError.code} message=${profileError.message}`
      )
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }
    profiles = (profileData ?? []) as ProfileRow[]
  }
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const nameFor = (id: string | null) => {
    if (!id) return null
    const p = byId.get(id)
    return p?.username ?? p?.email ?? null
  }

  return NextResponse.json({
    activity: rows.map((r) => {
      const targetId = targetIdFor(r.kind, r.detail)
      return {
        id: r.id,
        kind: r.kind,
        createdAt: r.created_at,
        actorId: r.actor_id,
        actorName: nameFor(r.actor_id),
        targetId,
        targetName: nameFor(targetId),
        detail: r.detail,
      }
    }),
  })
}
