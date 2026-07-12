// Admin identity gate (server-only). The single admin is whoever signs in with
// the account named by ADMIN_EMAIL_001 — the admin logs in through the normal
// Supabase flow (email/password in .env), and we simply recognise that email.
// This is intentionally separate from account_type/capabilities: admin is an
// operator role for the AI monitor, not a product capability.

import { createClient } from '@/lib/supabase/server'

if (typeof window !== 'undefined') {
  throw new Error('lib/auth/admin.ts is server-only and must not run in the browser')
}

function adminEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL_001?.trim().toLowerCase()
  return raw && raw.length > 0 ? raw : null
}

// True only when there is a configured admin email AND the signed-in user's email
// matches it. Fails closed on any lookup error.
export async function isCallerAdmin(): Promise<boolean> {
  const admin = adminEmail()
  if (!admin) return false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const email = user?.email?.trim().toLowerCase()
    return Boolean(email && email === admin)
  } catch {
    return false
  }
}
