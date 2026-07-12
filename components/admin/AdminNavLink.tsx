'use client'

// Navbar entry for the AI monitor. Self-gating: asks /api/admin/whoami once on
// mount and renders nothing unless the signed-in account is the admin. The real
// gate lives on the server (the /admin page + API routes 403 non-admins); this is
// only cosmetic hiding, matching the capabilities.ts pattern.

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

function PulseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1 8h3l2-5 3 10 2-5h4"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AdminNavLink({ active = false }: { active?: boolean }) {
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/whoami')
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((d) => {
        if (alive) setAdmin(Boolean(d?.admin))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!admin) return null

  const activeStyle: React.CSSProperties = active
    ? { color: 'var(--ink)', borderBottom: '2px solid var(--amber)', paddingBottom: 3 }
    : {}

  return (
    <Link
      href="/admin"
      style={{ ...monoLink, ...activeStyle }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = active ? 'var(--ink)' : 'var(--ink-subtle)')}
    >
      <PulseIcon />
      Admin
    </Link>
  )
}
