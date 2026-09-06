'use client'

import Link from 'next/link'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { useAuthedPage } from '@/components/useAuthedPage'

const options = [
  {
    href: '/build',
    label: 'Build a house from scratch',
    desc: 'Start with a blank canvas and add rooms, layers, and reasoning as you go.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3L3 10h2v9h5v-5h4v5h5v-9h2L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/build?draft=1',
    label: 'Start with an AI draft',
    desc: 'Describe your topic and get a structured house generated for you to refine.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.15 2.15m8.5 8.5l2.15 2.15M18.4 5.6l-2.15 2.15m-8.5 8.5L5.6 18.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/examples',
    label: 'Explore an example first',
    desc: 'Browse published houses to see how layers and reasoning work in practice.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

function WelcomeContent() {
  return (
    <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
      {/* Eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
        <span className="eyebrow">Welcome</span>
        <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(32px, 5vw, 44px)',
          lineHeight: 1.08,
          letterSpacing: '-0.015em',
          color: 'var(--ink)',
        }}
      >
        Your account is ready.
      </h1>

      {/* Orientation blurb */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          lineHeight: 1.6,
          color: 'var(--ink-mid)',
          marginTop: 16,
          maxWidth: 440,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        Houses of Thought turns complex topics into structured, visual
        reasoning. Each house is made of layers — foundations hold your core
        premises, upper floors develop arguments, and the roof captures your
        conclusions. You can build one from scratch, let AI draft a starting
        point, or browse examples to see how it works.
      </p>

      {/* Three option cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 32,
          textAlign: 'left',
        }}
      >
        {options.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 18px',
              borderRadius: 12,
              border: '1px solid var(--rule)',
              background: 'var(--white)',
              textDecoration: 'none',
              color: 'var(--ink)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--ink)'
              e.currentTarget.style.background = 'var(--amber-tint)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--rule)'
              e.currentTarget.style.background = 'var(--white)'
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 2, color: 'var(--ink-mid)' }}>{o.icon}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15 }}>{o.label}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{o.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function WelcomePage() {
  const { signOut } = useAuthedPage()
  return (
    <>
      <DashboardHeader onSignOut={signOut} />

      {/* acct-vh-header = dvh-safe `calc(100vh - 73px)` (account-responsive.css). */}
      <main
        id="main"
        className="acct-vh-header"
        style={{
          background: 'var(--parchment)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(32px, 6vw, 80px) var(--px)',
        }}
      >
        <WelcomeContent />
      </main>
    </>
  )
}
