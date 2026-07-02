'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMark } from './icons'

const navLinks = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'For Educators', href: '/educators' },
  { label: 'Examples', href: '/examples' },
  { label: 'FAQ', href: '/faq' },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const header = document.getElementById('site-header')
    if (!header) return
    const onScroll = () => {
      const past = window.scrollY > 24
      header.style.paddingBlock = past ? '11px' : '18px'
      header.style.borderBottom = past
        ? '1px solid #AEB8C7'
        : '1px solid transparent'
      header.style.background = past
        ? 'rgba(247,246,242,0.95)'
        : 'rgba(247,246,242,0.82)'
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    if (mobileOpen) window.addEventListener('keydown', onEsc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onEsc)
    }
  }, [mobileOpen])

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <header id="site-header" className="site-header">
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoMark />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 18,
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
              }}
            >
              Houses of Thought
            </span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28, marginLeft: 'auto' }} className="desktop-only">
            {navLinks.map((l) => {
              const active = pathname === l.href
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 15,
                    color: active ? 'var(--ink)' : 'var(--ink-mid)',
                    borderBottom: active ? '2px solid var(--amber)' : '2px solid transparent',
                    paddingBottom: 4,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--ink)'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--ink-mid)'
                  }}
                >
                  {l.label}
                </Link>
              )
            })}
            <Link
              href="/login"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 15,
                color: 'var(--ink-mid)',
              }}
            >
              Log in
            </Link>
            <Link
              href="/try"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 44,
                padding: '0 20px',
                background: 'var(--amber)',
                color: 'var(--ink)',
                fontWeight: 600,
                fontSize: 15,
                borderRadius: 8,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--amber-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--amber)')}
            >
              Try it free
            </Link>
          </nav>

          {/* Mobile controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }} className="mobile-only">
            <Link
              href="/try"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 40,
                padding: '0 16px',
                background: 'var(--amber)',
                color: 'var(--ink)',
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 8,
              }}
            >
              Try it free
            </Link>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              style={{
                width: 42,
                height: 42,
                border: '1px solid var(--rule)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <line x1="2" y1="5" x2="16" y2="5" stroke="var(--ink)" strokeWidth="1.6" />
                <line x1="2" y1="13" x2="16" y2="13" stroke="var(--ink)" strokeWidth="1.6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Responsive display styles */}
      <style>{`
        .desktop-only { display: none !important; }
        .mobile-only { display: flex !important; }
        @media (min-width: 1024px) {
          .desktop-only { display: flex !important; }
          .mobile-only { display: none !important; }
        }
      `}</style>

      {/* Mobile nav sheet */}
      {mobileOpen && (
        <div className="mobile-nav-overlay">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--rule)',
              }}
            >
              MENU
            </span>
            <button
              onClick={closeMobile}
              aria-label="Close menu"
              style={{
                width: 42,
                height: 42,
                border: '1px solid var(--ink-mid)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--parchment)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 3l10 10M13 3l-10 10" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 40 }}>
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={closeMobile}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 34,
                  color: 'var(--parchment)',
                  padding: '10px 0',
                }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link
              href="/try"
              onClick={closeMobile}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 52,
                background: 'var(--amber)',
                color: 'var(--ink)',
                fontWeight: 600,
                fontSize: 16,
                borderRadius: 8,
              }}
            >
              Try it free
            </Link>
            <Link
              href="/login"
              onClick={closeMobile}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 52,
                border: '1px solid var(--ink-mid)',
                color: 'var(--parchment)',
                fontWeight: 600,
                fontSize: 16,
                borderRadius: 8,
              }}
            >
              Log in
            </Link>
            <div
              style={{
                display: 'flex',
                gap: 20,
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--rule)',
              }}
            >
              <Link href="/framework" onClick={closeMobile}>Framework</Link>
              <Link href="/story" onClick={closeMobile}>Our story</Link>
              <Link href="/contact" onClick={closeMobile}>Contact</Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
