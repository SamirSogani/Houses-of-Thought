// Mechanism 1 ("Invite") of plans/active/persistence/invite-share-panels.md.
// The client cannot query auth.users directly, and public.profiles' SELECT RLS
// is owner-only (0001: `auth.uid() = id`) — a collaborator can't read anyone
// else's profile row to resolve an email or to show a name/avatar next to a
// membership row (the same problem 0014's get_class_roster RPC solves for
// classroom rosters). Both endpoints here use the service-role key to read
// public.profiles across users, but only after checking the caller's OWN
// session first — this route grants no new access, it only bridges a read
// profiles RLS was never opened up for.
//
// house_collaborators itself is never written here: inviting (INSERT) and
// removing (DELETE) go straight from the client through the existing
// owner/self RLS on that table (migration 0004) — no server route needed for
// those, they're plain authorized writes.

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

// ── Resolve-by-email rate limit ─────────────────────────────────────────────
// Per-user, in-memory, best-effort. NOT durable (resets on every cold start /
// deploy, and is per-serverless-instance rather than global — same caveat
// lib/ai/limits.ts documents for its routeCounts monitor), so this is a soft
// deterrent against a casual scraping loop, not a hard guarantee. A durable,
// cross-instance limiter would need its own table (like ai_usage, 0011), which
// is exactly the schema change the plan doc rules out for this mechanism —
// flagged in the implementation report rather than added silently.
const RESOLVE_WINDOW_MS = 10 * 60 * 1000
const RESOLVE_MAX_PER_WINDOW = 20
const resolveHits = new Map<string, number[]>()

function rateLimited(subject: string): boolean {
  const now = Date.now()
  const hits = (resolveHits.get(subject) ?? []).filter((t) => now - t < RESOLVE_WINDOW_MS)
  hits.push(now)
  resolveHits.set(subject, hits)
  return hits.length > RESOLVE_MAX_PER_WINDOW
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ProfileRow {
  id: string
  username: string | null
  email: string | null
}

interface CollaboratorRow {
  user_id: string
  role: string
  created_at: string
}

// GET /api/collaborators?houseId=<uuid> — the membership list for a house
// (Mechanism 1 step 3): current collaborators, joined with the display info
// (username/email) their own profiles RLS would otherwise hide from everyone
// but themselves.
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

  // Authorize with the CALLER's own session — houses_select RLS (0004/0006/
  // 0020) already resolves to "owner or collaborator (or a teacher's read
  // path)", so a row coming back here means this caller may legitimately see
  // who else is on the house. No row (RLS-empty or truly missing) means no.
  const { data: house } = await userClient
    .from('houses')
    .select('id, owner_id')
    .eq('id', houseId)
    .maybeSingle()
  if (!house) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }

  const client = serviceClient()
  if (!client) {
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }

  const { data: collabData, error: collabError } = await client
    .from('house_collaborators')
    .select('user_id, role, created_at')
    .eq('house_id', houseId)
    .order('created_at')
  if (collabError) {
    console.error(
      `GET /api/collaborators — membership query failed: code=${collabError.code} message=${collabError.message}`
    )
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  const collaborators = (collabData ?? []) as CollaboratorRow[]

  const ids = collaborators.map((c) => c.user_id)
  let profiles: ProfileRow[] = []
  if (ids.length > 0) {
    const { data: profileData, error: profileError } = await client
      .from('profiles')
      .select('id, username, email')
      .in('id', ids)
    if (profileError) {
      return NextResponse.json({ error: 'server-error' }, { status: 500 })
    }
    profiles = (profileData ?? []) as ProfileRow[]
  }
  const byId = new Map(profiles.map((p) => [p.id, p]))

  return NextResponse.json({
    ownerId: (house as { owner_id: string }).owner_id,
    collaborators: collaborators.map((c) => ({
      userId: c.user_id,
      role: c.role,
      username: byId.get(c.user_id)?.username ?? null,
      email: byId.get(c.user_id)?.email ?? null,
    })),
  })
}

// POST /api/collaborators { email } — resolve an email to a user id
// (Mechanism 1 step 1). Never reveals anything beyond found/not-found — no
// pending/email invite for an email that isn't an existing account.
export async function POST(req: NextRequest) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'signed-out' }, { status: 401 })
  }

  if (rateLimited(user.id)) {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 })
  }

  const client = serviceClient()
  if (!client) {
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }

  const { data, error } = await client
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()
  if (error) {
    console.error(
      `POST /api/collaborators — email lookup failed: code=${error.code} message=${error.message} details=${error.details ?? ''} hint=${error.hint ?? ''}`
    )
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }

  return NextResponse.json({ userId: (data as { id: string }).id })
}
