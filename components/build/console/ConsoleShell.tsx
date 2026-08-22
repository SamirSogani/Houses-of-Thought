'use client'

// The console page's chrome: the top bar, and the chat pane in each of its
// three forms — the full desktop sidebar, the collapsed desktop rail, and
// the mobile drawer. Split out of ConsolePage.tsx once that file passed the
// repo's ~600-line guideline.
//
// It owns no state. Which form the pane takes is decided by the caller
// (useIsMobile + useSidebarCollapsed both live in ConsolePage, where the
// rest of that page's state does), and the pane's contents arrive as
// renderSidebar so this file never has to know what a chat is. Everything
// below the bar is `children` — the transcript column stays in ConsolePage
// with the state it reads.

import Link from 'next/link'
import type { ReactNode } from 'react'

export function ConsoleShell({
  houseId,
  isMobile,
  sidebarCollapsed,
  onToggleSidebar,
  chatCount,
  mobileDrawerOpen,
  onOpenMobileDrawer,
  onCloseMobileDrawer,
  renderSidebar,
  children,
}: {
  houseId: string
  isMobile: boolean
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  chatCount: number
  mobileDrawerOpen: boolean
  onOpenMobileDrawer: () => void
  onCloseMobileDrawer: () => void
  // Called with a collapse handler for the desktop pane, and with none for
  // the mobile drawer (which has its own dismiss) — ChatSidebar renders its
  // collapse control only when it gets one.
  renderSidebar: (onCollapse?: () => void) => ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--rule)',
          background: 'var(--white)',
        }}
      >
        <Link href={`/build/${houseId}`} style={{ fontSize: 13, color: 'var(--blueprint)', textDecoration: 'none', fontWeight: 600 }}>
          ‹ Back to house
        </Link>
        <span style={{ color: 'var(--rule)' }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>Full console</span>
        {isMobile && (
          <button
            type="button"
            onClick={() => onOpenMobileDrawer()}
            style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}
          >
            Chats
          </button>
        )}
      </header>

      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        {!isMobile && !sidebarCollapsed && (
          <aside style={{ flex: '0 0 240px', borderRight: '1px solid var(--rule)', background: 'var(--white)', minHeight: 0 }}>
            {renderSidebar(onToggleSidebar)}
          </aside>
        )}

        {!isMobile && sidebarCollapsed && (
          <aside
            style={{
              flex: '0 0 44px',
              borderRight: '1px solid var(--rule)',
              background: 'var(--white)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 12,
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Expand chat list"
              title={`Chats · ${chatCount}`}
              style={{ width: 26, height: 26, color: 'var(--ink-subtle)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              ››
            </button>
            <span
              className="mono"
              aria-hidden="true"
              style={{ fontSize: 10, color: 'var(--ink-subtle)', writingMode: 'vertical-rl', letterSpacing: '0.08em' }}
            >
              Chats · {chatCount}
            </span>
          </aside>
        )}

        {isMobile && mobileDrawerOpen && (
          <div onClick={() => onCloseMobileDrawer()} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(20,33,58,0.42)' }}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="fade-in"
              role="dialog"
              aria-modal="true"
              aria-label="Chats"
              style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(85vw, 300px)', background: 'var(--white)', boxShadow: '24px 0 60px rgba(20,33,58,0.24)' }}
            >
              {renderSidebar()}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
