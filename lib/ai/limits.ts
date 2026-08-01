// Per-subject daily rate limit shared across all AI routes (pooled). The dial is
// quota, not login (decision 007): anonymous users keep AI access — /house and
// /try are the open door — but at a lower cap. Server-only.
//
// Anonymous subject: a random, httpOnly, first-party cookie minted on first
// touch (`hot_aid`). It exists solely to rate-limit/abuse-prevent — never read
// by client JS, never used for analytics, never merged with an identity unless
// the visitor later logs in (at which point we switch to `user:<id>` and stop
// reading it). That narrow purpose is what keeps it out of "needs a cookie
// banner" territory: it's the same strictly-necessary carve-out session/CSRF
// cookies rely on, not a tracking/marketing cookie. (Not legal advice — worth
// one disclosure line in the Privacy Policy, no banner needed.)
//
// Falls back to a hashed IP (the old sole behavior) only if the cookie can't be
// read/set. A cookie-only cap has a hole: a scripted client that ignores
// Set-Cookie mints a fresh anon subject every request and the per-browser cap
// never binds. So a SECOND, IP-keyed ceiling (ANON_IP_DAILY_CAP) is always
// layered on top for non-signed-in traffic — high enough that several browsers
// behind one school NAT stay usable, low enough that a curl loop dies for the
// day. Rotating IPs still dodges it; that residual risk is accepted (the goal is
// killing cheap loops, not adversarial proofing).
//
// This is the repo's first server-side service-role use; the service-role client
// is created inline and kept private to this module. The service key bypasses RLS
// so it can touch ai_usage, whose deny-all RLS blocks every other caller.

import { createHash, randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { log } from '@/lib/log'
import { AiError } from './router'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/limits.ts is server-only and must not run in the browser')
}

// Daily caps, all AI routes pooled. Tune freely.
export const ANON_DAILY_CAP = 25
export const USER_DAILY_CAP = 250
// Per-IP ceiling layered on top of the per-browser cookie cap for anonymous
// traffic (see module comment). Bounds a cookieless loop at ~$1.30/day of
// mini-house; raise it if an anonymous classroom demo behind one NAT matters.
export const ANON_IP_DAILY_CAP = 100

const ANON_ID_COOKIE = 'hot_aid'
const ANON_ID_MAX_AGE = 60 * 60 * 24 * 400 // ~13 months

let service: SupabaseClient | null = null
function serviceClient(): SupabaseClient {
  if (!service) {
    service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return service
}

// Hash the caller's IP so no raw IPs are stored. Fallback only — see module
// comment for why the cookie is the primary anonymous subject.
function ipSubject(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  const ip = xff ? xff.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? 'unknown')
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  return `ip:${hash}`
}

// Reads the anon-id cookie, minting one on first touch. httpOnly (never
// readable/writable from client JS) and unguessable (crypto.randomUUID).
async function anonCookieSubject(): Promise<string> {
  const jar = await cookies()
  let id = jar.get(ANON_ID_COOKIE)?.value
  if (!id) {
    id = randomUUID()
    jar.set(ANON_ID_COOKIE, id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: ANON_ID_MAX_AGE,
      path: '/',
    })
  }
  return `anon:${id}`
}

// Per-route call counter for the admin monitor. Module-global, i.e. PER
// SERVERLESS INSTANCE (same caveat as the router's health maps) — a cheap
// activity signal, not accounting; the ai_usage table is the durable record.
const routeCounts = new Map<string, number>()
export function getRouteCounts(): { route: string; count: number }[] {
  return [...routeCounts.entries()]
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
}

// Throws AiError(429) when the caller is over their daily cap. Fails OPEN on any
// limiter outage — an infrastructure problem here must not take down the co-pilot.
export async function enforceAiLimit(req: Request): Promise<void> {
  try {
    const path = new URL(req.url).pathname
    routeCounts.set(path, (routeCounts.get(path) ?? 0) + 1)
  } catch {
    // Counting must never block the request.
  }

  let subject: string
  let cap: number
  try {
    const supabase = await createUserClient()
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      subject = `user:${data.user.id}`
      cap = USER_DAILY_CAP
    } else {
      cap = ANON_DAILY_CAP
      try {
        subject = await anonCookieSubject()
      } catch {
        subject = ipSubject(req)
      }
    }
  } catch {
    // Auth lookup failed — treat as anonymous rather than blocking.
    cap = ANON_DAILY_CAP
    try {
      subject = await anonCookieSubject()
    } catch {
      subject = ipSubject(req)
    }
  }

  try {
    const { data, error } = await serviceClient().rpc('increment_ai_usage', { sub: subject })
    if (error) {
      log.error('ai/limits', 'increment failed, failing open', { error: error.message })
      return
    }
    if (typeof data === 'number' && data > cap) {
      throw new AiError(429, 'rate-limited')
    }

    // Layered IP ceiling for all non-signed-in traffic (skipped when the IP hash
    // already was the primary subject — no point double-counting one subject).
    if (!subject.startsWith('user:')) {
      const ipSub = ipSubject(req)
      if (ipSub !== subject) {
        const { data: ipCount, error: ipError } = await serviceClient().rpc(
          'increment_ai_usage',
          { sub: ipSub }
        )
        if (ipError) {
          log.error('ai/limits', 'ip ceiling failed, failing open', { error: ipError.message })
        } else if (typeof ipCount === 'number' && ipCount > ANON_IP_DAILY_CAP) {
          throw new AiError(429, 'rate-limited')
        }
      }
    }
  } catch (err) {
    if (err instanceof AiError) throw err
    log.error('ai/limits', 'failing open', { error: (err as Error)?.message })
  }
}

export interface AiUsageSummary {
  day: string
  totalCalls: number
  userCalls: number
  anonCalls: number
  ipCalls: number
  subjects: number
  topSubjects: { subject: string; count: number }[]
}

// Today's ai_usage totals for the admin monitor — the durable, all-instances
// counterpart to the router's per-instance health. Service-role read (deny-all
// RLS blocks everyone else); called only from the admin status route, which is
// itself admin-gated. Returns null instead of throwing: the monitor must render
// even when the usage read is down.
export async function getAiUsageSummary(): Promise<AiUsageSummary | null> {
  const day = new Date().toISOString().slice(0, 10) // UTC, matches current_date
  try {
    const { data, error } = await serviceClient()
      .from('ai_usage')
      .select('subject, count')
      .eq('day', day)
    if (error || !data) return null
    const rows = data as { subject: string; count: number }[]
    const sumWhere = (prefix: string) =>
      rows.filter((r) => r.subject.startsWith(prefix)).reduce((n, r) => n + r.count, 0)
    return {
      day,
      totalCalls: rows.reduce((n, r) => n + r.count, 0),
      userCalls: sumWhere('user:'),
      anonCalls: sumWhere('anon:'),
      ipCalls: sumWhere('ip:'),
      subjects: rows.length,
      topSubjects: rows
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map(({ subject, count }) => ({ subject, count })),
    }
  } catch {
    return null
  }
}
