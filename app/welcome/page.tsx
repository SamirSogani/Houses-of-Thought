'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/Header'

function WelcomeMessage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const heading = mode === 'signup' ? 'Account created.' : 'Successfully logged in.'

  return (
    <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ display: 'block', width: 24, height: 1, background: 'var(--amber)' }} />
        <span className="eyebrow">Placeholder</span>
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
        {heading}
      </h1>
    </div>
  )
}

export default function WelcomePage() {
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
        <Suspense fallback={null}>
          <WelcomeMessage />
        </Suspense>
      </main>
    </>
  )
}
