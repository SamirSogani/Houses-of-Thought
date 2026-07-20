'use client'

// Shared focus management for overlays (a11y audit C2 — WCAG 2.4.3, 2.1.2).
//
// Every overlay in the app previously rendered `aria-modal="true"` without
// trapping focus, so Tab walked into the page behind the dialog while screen
// readers were told that content did not exist. This hook is the one place that
// dance lives:
//   • moves focus into the dialog on open (respecting an existing autoFocus),
//   • keeps Tab/Shift+Tab cycling inside it,
//   • restores focus to whatever opened it on close.
//
// Escape handling stays with the caller — several overlays already have their
// own Escape behavior and some need to confirm before closing.

import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    // Remember what to give focus back to when the overlay closes.
    const previous = document.activeElement as HTMLElement | null

    // Don't fight an element that already claimed focus via autoFocus.
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>(FOCUSABLE)
      // Fall back to the container so focus at least lands inside the dialog.
      if (first) first.focus()
      else {
        node.setAttribute('tabindex', '-1')
        node.focus()
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement as HTMLElement | null

      if (e.shiftKey && (current === first || !node.contains(current))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // The opener may itself have unmounted (e.g. a menu item that closed the
      // menu) — only restore if it is still in the document.
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [active])

  return ref
}
