// Per-subject daily rate limit shared across all AI routes (pooled). The dial is
// quota, not login (decision 007): anonymous users keep AI access — /house is the
// open door — but at a lower cap. Server-only.
//
// This is the repo's first server-side service-role use; the service-role client
// is created inline and kept private to this module. The service key bypasses RLS
// so it can touch ai_usage, whose deny-all RLS blocks every other caller.

import { createHash } from 'crypto'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { AiError } from './groq'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/limits.ts is server-only and must not run in the browser')
}

// Daily caps, all AI routes pooled. Tune freely.
export const ANON_DAILY_CAP = 25
export const USER_DAILY_CAP = 250

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

// Hash the caller's IP so no raw IPs are stored. First forwarded hop, else
// x-real-ip, else 'unknown'.
function ipSubject(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  const ip = xff ? xff.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? 'unknown')
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  return `ip:${hash}`
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
      subject = ipSubject(req)
      cap = ANON_DAILY_CAP
    }
  } catch {
    // Auth lookup failed — treat as anonymous rather than blocking.
    subject = ipSubject(req)
    cap = ANON_DAILY_CAP
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
