'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthCard, AuthDivider, AuthError, AuthField } from '@/components/auth/AuthCard'
import { AccountTypeSelector } from '@/components/profile/AccountTypeSelector'
import type { AccountType } from '@/lib/profile/data'

// Post-auth destination. Honors a ?next= param (e.g. a /join/<code> invite link
// that bounced through login) but only for internal paths, to avoid an open
// redirect. Read from window at click time so we don't need a Suspense boundary.
function nextPath(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const p = new URLSearchParams(window.location.search).get('next')
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/dashboard'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('standard')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Set when signUp returns no session (Supabase email confirmation is on):
  // the profile write and redirect can't proceed until the email is verified.
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  // Open on the signup tab when arriving from a conversion CTA (e.g. the /try
  // "Create free account" button links to /login?mode=signup). A role param
  // (educator CTAs link /login?mode=signup&role=educator) preselects the
  // Teacher account type. Read once on mount to avoid a hydration mismatch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') === 'signup') setMode('signup')
    if (params.get('role') === 'educator') setAccountType('teacher')
  }, [])

  const isLogin = mode === 'login'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    // account_type is chosen once here at signup. The signup trigger (0013)
    // reads it from metadata; reconcile_signup_role() (0026) then fixes the rare
    // case where GoTrue's timing left the metadata unread. account_type is
    // otherwise immutable to the client (0026 pins it via RLS), so this is the
    // only moment a role is set.
    const result = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { data: { account_type: accountType } },
        })

    if (result.error) {
      setLoading(false)
      setError(result.error.message)
      return
    }

    // Email confirmation on: signUp returns a user but no session. The profile
    // write would fail under RLS and the redirect would bounce straight back
    // here, so show an explicit "check your email" state instead (audit B8).
    if (!isLogin && !result.data.session) {
      setLoading(false)
      setConfirmEmail(email)
      return
    }

    if (!isLogin && result.data.user) {
      // SECURITY DEFINER RPC, not a direct UPDATE: the profiles RLS now forbids
      // the client from changing account_type. This only promotes a just-created
      // account still on the trigger's 'standard' fallback to the chosen role.
      await supabase.rpc('reconcile_signup_role', { p_type: accountType })
    }

    setLoading(false)
    router.push(nextPath())
    router.refresh()
  }

  if (confirmEmail) {
    return (
      <AuthCard eyebrow="One more step" heading={'Check your\nemail.'}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-mid)' }} role="status">
          We sent a confirmation link to <strong style={{ color: 'var(--ink)' }}>{confirmEmail}</strong>.
          Open it to activate your account, then log in.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
          onClick={() => {
            setConfirmEmail(null)
            setMode('login')
          }}
        >
          Back to log in
        </button>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      eyebrow={isLogin ? 'Welcome back' : 'Get started'}
      heading={isLogin ? 'Log in to your\nhouse.' : 'Create your\naccount.'}
      belowCard={
        <p
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--dusk-ink-subtle)',
          }}
        >
          Your reasoning stays yours
        </p>
      }
    >
      {/* Mode tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 28,
          border: '1px solid var(--rule)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            // Selected tab was background/color only, with no state exposed to
            // assistive tech (a11y S4).
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            style={{
              flex: 1,
              height: 40,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 14,
              color: mode === m ? 'var(--ink)' : 'var(--ink-subtle)',
              background: mode === m ? 'var(--parchment)' : 'transparent',
              borderRight: m === 'login' ? '1px solid var(--rule)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {m === 'login' ? 'Log in' : 'Sign up'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
          minLength={isLogin ? undefined : 8}
          value={password}
          onChange={setPassword}
          placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
        />

        {!isLogin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-subtle)',
              }}
            >
              Account type
            </span>
            <AccountTypeSelector value={accountType} onChange={setAccountType} />
          </div>
        )}

        {isLogin && (
          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <Link
              href="/forgot-password"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--ink-subtle)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}
            >
              Forgot password?
            </Link>
          </div>
        )}

        {error && <AuthError>{error}</AuthError>}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{
            width: '100%',
            justifyContent: 'center',
            marginTop: 8,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>

      <AuthDivider />

      {/* Switch mode */}
      <p
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--ink-subtle)',
        }}
      >
        {isLogin ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => setMode(isLogin ? 'signup' : 'login')}
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--ink)',
            borderBottom: '1px solid var(--ink)',
            paddingBottom: 1,
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--amber-text)'
            e.currentTarget.style.borderColor = 'var(--amber-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink)'
            e.currentTarget.style.borderColor = 'var(--ink)'
          }}
        >
          {isLogin ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </AuthCard>
  )
}
