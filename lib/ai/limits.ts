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
// read/set. Note this trades one imprecision for another: a scripted abuser who
// never stores cookies can dodge the per-browser cap this way, same as IP
// hashing always could be dodged by rotating IPs. A second IP-based ceiling
// layered on top is a reasonable follow-up if that turns out to matter.
//
// This is the repo's first server-side service-role use; the service-role client
// is created inline and kept private to this module. The service key bypasses RLS
// so it can touch ai_usage, whose deny-all RLS blocks every other caller.

import { createHash, randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { AiError } from './groq'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/limits.ts is server-only and must not run in the browser')
}

// Daily caps, all AI routes pooled. Tune freely.
export const ANON_DAILY_CAP = 25
export const USER_DAILY_CAP = 250

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

// Throws AiError(429) when the caller is over their daily cap. Fails OPEN on any
// limiter outage — an infrastructure problem here must not take down the co-pilot.
export async function enforceAiLimit(req: Request): Promise<void> {
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
      console.error('[ai/limits] increment failed, failing open:', error.message)
      return
    }
    if (typeof data === 'number' && data > cap) {
      throw new AiError(429, 'rate-limited')
    }
  } catch (err) {
    if (err instanceof AiError) throw err
    console.error('[ai/limits] failing open:', (err as Error)?.message)
  }
}
