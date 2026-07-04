'use client'

// Authenticated app bar for the dashboard. Matches the reference layout
// (logo + blueprint subtitle · Framework · Collab · Profile · Sign Out) in brand style.

import Link from 'next/link'
import { LogoMark } from '@/components/icons'
import { SparkIcon } from '@/components/build/buildIcons'

const monoLink: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--ink-subtle)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  transition: 'color 0.15s',
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 2.5H3.5A1.5 1.5 0 002 4v8a1.5 1.5 0 001.5 1.5H6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M9.5 11l3-3-3-3M12.5 8H6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DashboardHeader({
  onSignOut,
  active,
}: {
  onSignOut: () => void
  active?: 'framework' | 'collab' | 'profile'
}) {
  const hover = (c: string) => (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.color = c)
  const activeStyle: React.CSSProperties = { color: 'var(--ink)', borderBottom: '2px solid var(--amber)', paddingBottom: 3 }

  return (
    <header style={{ background: 'var(--white)', borderBottom: '1px solid var(--rule)' }}>
      <div
        className="container"
        style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', paddingBlock: 14, gap: 20 }}
      >
        {/* Left: brand */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'start' }}>
          <LogoMark />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              Houses of Thought
            </span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', marginTop: 2 }}>
              Intellectual Blueprint · Est. 2026
            </span>
          </span>
        </Link>

        {/* Center: Framework */}
        <Link
          href="/framework"
          style={{ ...monoLink, justifySelf: 'center', ...(active === 'framework' ? activeStyle : {}) }}
          onMouseEnter={hover('var(--ink)')}
          onMouseLeave={hover(active === 'framework' ? 'var(--ink)' : 'var(--ink-subtle)')}
        >
          Framework
        </Link>

        {/* Right: Collab · Profile · Sign Out */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 22, justifySelf: 'end' }}>
          <Link href="/build" style={{ ...monoLink, color: 'var(--ink)', ...(active === 'collab' ? activeStyle : {}) }} onMouseEnter={hover('var(--amber-hover)')} onMouseLeave={hover('var(--ink)')}>
            <SparkIcon size={13} fill="var(--amber-hover)" />
            Collab
          </Link>
          <Link
            href="/profile"
            style={{ ...monoLink, ...(active === 'profile' ? activeStyle : {}) }}
            onMouseEnter={hover('var(--ink)')}
            onMouseLeave={hover(active === 'profile' ? 'var(--ink)' : 'var(--ink-subtle)')}
          >
            <GearIcon />
            Profile
          </Link>
          <button type="button" onClick={onSignOut} style={monoLink} onMouseEnter={hover('var(--ink)')} onMouseLeave={hover('var(--ink-subtle)')}>
            <SignOutIcon />
            Sign Out
          </button>
        </nav>
      </div>
    </header>
  )
}
