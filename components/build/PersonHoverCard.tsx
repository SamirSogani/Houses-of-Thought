'use client'

// A real person's avatar (owner or collaborator), Google Docs/Word-style:
// full color when recently active, faded when not — readable at a glance,
// no hover needed to tell the two apart — and clicking/hovering opens a
// small card right under the avatar with name, email, and activity, rather
// than a plain browser title tooltip (which is what RealAvatar alone gives
// you, and what this replaces everywhere a real person's avatar appears —
// ContextBar's presence stack and TeamPanel's membership rows).
//
// Hover *or* click opens it (click makes it reachable on touch, where hover
// doesn't exist); Escape or clicking away closes it. Keyboard-focusable via
// the underlying button, so it's reachable without a mouse too (a11y).

import { useEffect, useRef, useState } from 'react'
import { RealAvatar } from './Avatar'
import { formatLastActive, isRecentlyActive } from './useTeamRoster'

export function PersonHoverCard({
  id,
  name,
  email,
  roleLabel,
  lastSeenIso,
  isSelf = false,
  size = 26,
  ring = false,
  style,
}: {
  id: string
  name: string
  email: string | null
  // "Owner" / "Editor" / "Viewer" — whatever TeamPanel/ContextBar already
  // compute; kept as a plain label so this component doesn't need to know
  // the role union type.
  roleLabel: string
  lastSeenIso: string | null | undefined
  isSelf?: boolean
  size?: number
  ring?: boolean
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = isRecentlyActive(lastSeenIso)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${name} — ${active ? 'active now' : formatLastActive(lastSeenIso)}`}
        style={{
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          borderRadius: '50%',
          // The at-a-glance signal: full color when recently active, clearly
          // muted when not (Google Docs/Word convention) — same info the
          // card's text repeats for anyone who does look closer.
          opacity: active ? 1 : 0.32,
          filter: active ? 'none' : 'grayscale(65%)',
          transition: 'opacity 0.15s ease, filter 0.15s ease',
        }}
      >
        {/* Empty title, not omitted — RealAvatar defaults to the plain name
            tooltip otherwise, which would show alongside this card. */}
        <RealAvatar id={id} name={name} size={size} ring={ring} title="" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${name}'s activity`}
          className="fade-in"
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 8,
            zIndex: 40,
            width: 220,
            background: 'var(--white)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(20,33,58,0.16)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <RealAvatar id={id} name={name} size={30} style={{ opacity: active ? 1 : 0.32, filter: active ? 'none' : 'grayscale(65%)' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
                {isSelf && <span style={{ color: 'var(--ink-subtle)', fontWeight: 500 }}> · you</span>}
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', textTransform: 'uppercase', marginTop: 1 }}>
                {roleLabel}
              </div>
            </div>
          </div>

          {email && (
            <div style={{ fontSize: 12, color: 'var(--ink-mid)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: active ? 'var(--green-strong)' : 'var(--ink-subtle)',
                flex: '0 0 auto',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{formatLastActive(lastSeenIso)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
