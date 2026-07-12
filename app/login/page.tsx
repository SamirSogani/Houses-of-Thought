'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { LogoMark } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
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

  // Open on the signup tab when arriving from a conversion CTA (e.g. the /try
  // "Create free account" button links to /login?mode=signup). Read once on mount
  // to avoid an SSR/hydration mismatch.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode')
    if (m === 'signup') setMode('signup')
  }, [])

  const isLogin = mode === 'login'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    // account_type is passed in signup metadata AND (below) written explicitly:
    // the signup trigger (0013) reads the metadata, but GoTrue's user-creation
    // timing can leave it at the default, so we set it deterministically from the
    // client — which now has a session — right after signing up.
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

    if (!isLogin && result.data.user) {
      await supabase.from('profiles').update({ account_type: accountType }).eq('id', result.data.user.id)
    }

    setLoading(false)
    router.push(nextPath())
    router.refresh()
  }

  return (
    <>
      <Header />

      <main
        style={{
          minHeight: 'calc(100vh - 73px)',
          background: 'var(--parchment)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(32px, 6vw, 80px) var(--px)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
            <span className="eyebrow">{isLogin ? 'Welcome back' : 'Get started'}</span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(32px, 5vw, 44px)',
              lineHeight: 1.08,
              letterSpacing: '-0.015em',
              color: 'var(--ink)',
              marginBottom: 32,
            }}
          >
            {isLogin ? 'Log in to your\nhouse.' : 'Create your\naccount.'}
          </h1>

          {/* Card */}
          <div
            style={{
              background: 'var(--white)',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(24px, 4vw, 36px)',
            }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="email"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-subtle)',
                  }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    height: 48,
                    padding: '0 14px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 16,
                    color: 'var(--ink)',
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="password"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-subtle)',
                  }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  minLength={isLogin ? undefined : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
                  style={{
                    height: 48,
                    padding: '0 14px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 16,
                    color: 'var(--ink)',
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
                />
              </div>

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

              {error && (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: 'var(--warning)',
                  }}
                >
                  {error}
                </p>
              )}

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

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '24px 0',
              }}
            >
              <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  color: 'var(--ink-subtle)',
                  textTransform: 'uppercase',
                }}
              >
                or
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
            </div>

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
                  e.currentTarget.style.color = 'var(--amber-hover)'
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
          </div>

          {/* Footer note */}
          <p
            style={{
              marginTop: 20,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--rule)',
            }}
          >
            Your reasoning stays yours
          </p>
        </div>
      </main>
    </>
  )
}
