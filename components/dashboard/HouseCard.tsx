'use client'

// A single house card + the "Create New House" tile for the dashboard grid.
// Brand-styled: white card, rule border, mono meta labels, amber progress bar,
// semantic status chip. The card links into the Build a House flow; a kebab menu
// (top-right) offers rename / share / delete, plus turn-in for assignment
// submissions. The menu only renders when its callbacks are supplied (i.e. on the
// owner's dashboard) — read-only usages like the teacher roster pass none.

import { useState } from 'react'
import Link from 'next/link'
import type { HouseSummary } from '@/lib/dashboard/houses'
import { housePercent, statusMeta } from '@/lib/dashboard/houses'
import { PlusIcon } from '@/components/build/buildIcons'

export function HouseCard({
  house,
  href,
  graded = false,
  onRename,
  onDelete,
  onTurnIn,
}: {
  house: HouseSummary
  href: string
  // Teacher feedback exists: undo-turn-in is hidden (the dashboard blocks it
  // server-side too — bl-H2) and a "Graded" chip renders.
  graded?: boolean
  onRename?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onTurnIn?: (id: string, turnedIn: boolean) => void
}) {
  const percent = housePercent(house)
  const meta = statusMeta[house.status]
  const hasMenu = !!(onRename || onDelete || onTurnIn)
  // Turn-in applies to assignment submissions — and to a still-turned-in house
  // whose assignment was deleted (bl-L7: the chip must stay clearable).
  const isSubmission = house.assignmentId !== null || house.turnedIn

  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(house.title ?? '')
  const [copied, setCopied] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
    setConfirmDelete(false)
  }
  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  async function share(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(window.location.origin + href)
      // Keep the menu open so the "Link copied" confirmation is visible; it
      // resets after a moment and an outside click dismisses the menu.
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      closeMenu()
    }
  }
  function startRename(e: React.MouseEvent) {
    stop(e)
    setRenameValue(house.title ?? '')
    setRenaming(true)
    closeMenu()
  }
  function submitRename() {
    onRename?.(house.id, renameValue)
    setRenaming(false)
  }
  function turnIn(e: React.MouseEvent) {
    stop(e)
    onTurnIn?.(house.id, !house.turnedIn)
    closeMenu()
  }
  function doDelete(e: React.MouseEvent) {
    stop(e)
    onDelete?.(house.id)
    closeMenu()
  }

  return (
    <div style={{ position: 'relative' }}>
      <Link
        href={href}
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--white)',
          border: '1px solid var(--rule)',
          borderRadius: 'var(--radius-card)',
          padding: 20,
          minHeight: 190,
          transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--ink)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(20,33,58,0.08)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--rule)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'none'
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 20,
            letterSpacing: '-0.01em',
            color: house.title ? 'var(--ink)' : 'var(--ink-subtle)',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: hasMenu ? 28 : 0,
          }}
        >
          {house.title ?? 'Untitled House'}
        </h3>

        {/* Progress line */}
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginTop: 10 }}>
          {house.layersComplete}/7 layers complete · {percent}%
        </div>
        <div style={{ height: 5, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
          <div
            className="build-bar-fill"
            style={{
              height: '100%',
              width: `${percent}%`,
              background: house.status === 'complete' ? 'var(--green-strong)' : 'var(--amber)',
              borderRadius: 3,
              transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)',
            }}
          />
        </div>

        {/* Question preview */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: house.question ? 'var(--ink-mid)' : 'var(--ink-subtle)',
            fontStyle: house.question ? 'normal' : 'italic',
            lineHeight: 1.45,
            marginTop: 14,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {house.question ?? 'No question set yet'}
        </p>

        {/* Footer meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 16, flexWrap: 'wrap' }}>
          <span
            className="mono"
            style={{ fontSize: 9, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}`, borderRadius: 5, padding: '2px 8px' }}
          >
            {meta.label}
          </span>
          {house.turnedIn && (
            <span className="mono" style={{ fontSize: 9, color: 'var(--green-strong)', border: '1px solid var(--green-strong)', borderRadius: 5, padding: '2px 8px' }}>
              {graded ? 'Turned in · Graded' : 'Turned in'}
            </span>
          )}
          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{house.editedLabel}</span>
        </div>
      </Link>

      {/* Kebab menu */}
      {hasMenu && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 6 }}>
          {/* tap-target extends the 28px button to a 44×44 touch hit-area. */}
          <button
            type="button"
            aria-label="House options"
            className="tap-target"
            onClick={(e) => {
              stop(e)
              setMenuOpen((o) => !o)
              setConfirmDelete(false)
            }}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'transparent', color: 'var(--ink-subtle)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--parchment)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop closes the menu on any outside click. */}
              <div onClick={(e) => { stop(e); closeMenu() }} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
              <div
                style={{
                  position: 'absolute',
                  top: 32,
                  right: 0,
                  minWidth: 168,
                  background: 'var(--white)',
                  border: '1px solid var(--rule)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(20,33,58,0.12)',
                  overflow: 'hidden',
                  zIndex: 2,
                }}
              >
                {onRename && <MenuItem onClick={startRename}>Rename</MenuItem>}
                <MenuItem onClick={share}>{copied ? 'Link copied' : 'Share (copy link)'}</MenuItem>
                {isSubmission && onTurnIn && !(house.turnedIn && graded) && (
                  <MenuItem onClick={turnIn}>{house.turnedIn ? 'Undo turn in' : 'Turn in'}</MenuItem>
                )}
                {onDelete &&
                  (confirmDelete ? (
                    <MenuItem danger onClick={doDelete}>Confirm delete</MenuItem>
                  ) : (
                    <MenuItem danger onClick={(e) => { stop(e); setConfirmDelete(true) }}>Delete</MenuItem>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Rename overlay */}
      {renaming && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 7,
            background: 'var(--white)',
            border: '1px solid var(--ink)',
            borderRadius: 'var(--radius-card)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rename house</span>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            placeholder="House title"
            style={{ height: 42, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 8, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
            <button type="button" onClick={submitRename} className="btn-primary" style={{ justifyContent: 'center' }}>Save</button>
            <button type="button" onClick={() => setRenaming(false)} style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', border: '1px solid var(--rule)', borderRadius: 8, padding: '0 16px', background: 'var(--white)' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        color: danger ? 'var(--warning)' : 'var(--ink)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--parchment)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function CreateHouseCard({
  onClick,
  disabled,
  label = 'Create New House',
}: {
  onClick: () => void
  disabled?: boolean
  // Overridden by the Draft Mode entry card ("Start with an AI draft").
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        minHeight: 190,
        width: '100%',
        border: '1.5px dashed var(--rule)',
        borderRadius: 'var(--radius-card)',
        color: 'var(--ink)',
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.borderColor = 'var(--ink)'
        e.currentTarget.style.background = 'rgba(20,33,58,0.02)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--rule)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--amber-tint)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink)',
        }}
      >
        <PlusIcon size={22} />
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>
        {disabled ? 'Creating…' : label}
      </span>
    </button>
  )
}
