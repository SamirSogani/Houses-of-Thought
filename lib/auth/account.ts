// Server-side loader for the caller's account type + capabilities. This is the
// AUTHORITATIVE gate: client-side hiding is cosmetic, this is what actually
// decides what a request may do. Mirrors the server-only pattern in lib/ai/limits.ts.
//
// Anonymous callers (the open /house front door, decision 001 §6) resolve to
// 'standard' — they keep full AI posture; the student clamp only applies to a
// signed-in student profile.

import { createClient } from '@/lib/supabase/server'
import type { AccountType } from '@/lib/profile/data'
import { capabilitiesFor, type Capabilities } from './capabilities'

if (typeof window !== 'undefined') {
  throw new Error('lib/auth/account.ts is server-only and must not run in the browser')
}

export async function getCallerAccountType(): Promise<AccountType> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 'standard'
    const { data } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single()
    return (data?.account_type as AccountType) ?? 'standard'
  } catch {
    // Any lookup failure resolves to the safe default rather than blocking.
    return 'standard'
  }
}

export async function getCallerCapabilities(): Promise<Capabilities> {
  return capabilitiesFor(await getCallerAccountType())
}
