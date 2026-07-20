import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Shared auth-link landing route. Emailed links (password recovery today, and
// any future email confirmations) bounce here to be turned into a session, then
// forward to `next`. Handles both link shapes Supabase can produce:
//   • token_hash + type  → verifyOtp   (works cross-device; recommended)
//   • code               → exchangeCodeForSession (PKCE, same-browser only)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  // Only ever redirect to internal paths, mirroring the login page's open-redirect
  // guard, so a crafted `next` can't bounce a freshly-authed session off-site.
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  const supabase = await createClient()

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, origin))
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  // Missing, expired, or already-used link. Send the user back to request a
  // fresh one rather than dropping them on a dead page.
  return NextResponse.redirect(new URL('/forgot-password?error=link_invalid', origin))
}
