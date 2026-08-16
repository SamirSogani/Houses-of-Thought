'use client'

// A real person's avatar (owner or collaborator), Google Docs/Word-style:
// full color when recently active, faded when not — readable at a glance,
// no hover needed to tell the two apart — and clicking/hovering opens a
// small card right under the avatar with name, email, and activity, rather
// than a plain browser title tooltip (which is what RealAvatar alone gives
// you, and what this replaces everywhere a real person's avatar appears —
// ContextBar's presence stack and TeamPanel's membership rows).
//
// The card renders through a portal into document.body, positioned with
// `position: fixed` computed from the anchor's real screen position and
// clamped to stay inside the viewport. Plain CSS centering (`left: 50%` +
// `translateX(-50%)`, relative to the anchor) put the card off-screen for
// avatars near the left edge — TeamPanel's own avatars sit right against
// the rail's left edge, and the rail's scrolling container clips overflow
// besides, so a portal is the actual fix, not just re-tuned offsets: it
// escapes any clipping ancestor entirely, the same reason tooltip/popover
// libraries (Radix, Floating UI) always portal.
//
// Hover *or* click opens it (click makes it reachable on touch, where hover
// doesn't exist); Escape, clicking away, or scrolling closes it. Keyboard-
// focusable via the underlying button (a11y).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RealAvatar } from './Avatar'
import { formatLastActive, isRecentlyActive } from './useTeamRoster'

const CARD_WIDTH = 220
const VIEWPORT_MARGIN = 8

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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  // Grace-period timer for the button<->card hover handoff: the card is
  // portaled outside the button's DOM subtree (deliberately, so it can
  // escape a clipping/scrolling ancestor — see module comment), so there's
  // a real screen gap between them the mouse has to cross. Closing on plain
  // mouseleave would fire the instant the cursor left the button, before it
  // ever reaches the card 8px below. A short delay, cancelled if the mouse
  // lands on either element in time, is the standard fix (same pattern any
  // hover-menu library uses).
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = isRecentlyActive(lastSeenIso)

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }
  function scheduleClose() {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setOpen(false), 150)
  }

  useEffect(() => () => cancelClose(), [])

  // Compute a viewport-clamped position from the anchor's real screen rect
  // every time the card opens — not once at mount, since the avatar's
  // position depends on layout (panel width, scroll offset, expand toggle)
  // that can change between opens.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const idealLeft = rect.left + rect.width / 2 - CARD_WIDTH / 2
    const clampedLeft = Math.min(
      Math.max(idealLeft, VIEWPORT_MARGIN),
      window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN
    )
    setPos({ top: rect.bottom + 8, left: clampedLeft })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (cardRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    // Capture phase: a scroll inside a nested scrollable rail doesn't bubble
    // to window in every browser, but it always fires during capture.
    function onScroll() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => {
          cancelClose()
          setOpen(true)
        }}
        onMouseLeave={scheduleClose}
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
          ...style,
        }}
      >
        {/* Empty title, not omitted — RealAvatar defaults to the plain name
            tooltip otherwise, which would show alongside this card. */}
        <RealAvatar id={id} name={name} size={size} ring={ring} title="" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={cardRef}
            role="dialog"
            aria-label={`${name}'s activity`}
            className="fade-in"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 1000,
              width: CARD_WIDTH,
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
          </div>,
          document.body
        )}
    </>
  )
}
