'use client'

// Controls bar for the dashboard: search, status filter pills, sort toggle,
// and a "Select" button for bulk operations. Lives above the house grid;
// the "Continue where you left off" banner sits above this component.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { HouseSummary, HouseStatus } from '@/lib/dashboard/houses'

type SortMode = 'updated' | 'title'

const STATUS_OPTIONS: { label: string; value: HouseStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Empty', value: 'empty' },
  { label: 'Complete', value: 'complete' },
]

export function DashboardFilters({
  houses,
  continueHouseId,
  selectable,
  onToggleSelectable,
  onFiltered,
}: {
  houses: HouseSummary[]
  /** The id of the "continue where you left off" house — excluded from select mode. */
  continueHouseId: string | null
  selectable: boolean
  onToggleSelectable: () => void
  /** Called whenever the filtered/sorted subset changes. */
  onFiltered: (filtered: HouseSummary[]) => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<HouseStatus | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('updated')

  // Debounce search at 200ms — the list is small, but it keeps the UI snappy
  // and avoids re-renders on every keystroke when React strict-mode double-fires.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 200)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [search])

  const filtered = useMemo(() => {
    let result = houses

    // Status filter
    if (status !== 'all') {
      result = result.filter((h) => h.status === status)
    }

    // Search filter (case-insensitive substring against title + question)
    const q = debouncedSearch.trim().toLowerCase()
    if (q) {
      result = result.filter((h) => {
        const title = (h.title ?? 'Untitled House').toLowerCase()
        const question = (h.question ?? '').toLowerCase()
        return title.includes(q) || question.includes(q)
      })
    }

    // Sort
    if (sort === 'title') {
      result = [...result].sort((a, b) => {
        const at = (a.title ?? 'Untitled House').toLowerCase()
        const bt = (b.title ?? 'Untitled House').toLowerCase()
        return at.localeCompare(bt)
      })
    }
    // 'updated' keeps the original order (already sorted by updated_at desc from the query)

    return result
  }, [houses, status, debouncedSearch, sort])

  // Push filtered results to parent whenever they change.
  useEffect(() => {
    onFiltered(filtered)
  }, [filtered, onFiltered])

  const hasHouses = houses.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 'clamp(20px, 2.5vw, 28px)' }}>
      {/* Row 1: Search + Select toggle */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', maxWidth: 360, position: 'relative' }}>
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search houses…"
            aria-label="Search houses"
            style={{
              width: '100%',
              height: 40,
              paddingLeft: 36,
              paddingRight: 12,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--ink)',
              background: 'var(--parchment)',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius-btn)',
              outline: 'none',
            }}
          />
        </div>

        {hasHouses && (
          <button
            type="button"
            onClick={onToggleSelectable}
            className="mono"
            style={{
              height: 40,
              padding: '0 14px',
              fontSize: 11,
              letterSpacing: '0.04em',
              color: selectable ? 'var(--white)' : 'var(--ink)',
              background: selectable ? 'var(--ink)' : 'transparent',
              border: `1px solid ${selectable ? 'var(--ink)' : 'var(--rule)'}`,
              borderRadius: 'var(--radius-btn)',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {selectable ? 'Cancel' : 'Select'}
          </button>
        )}
      </div>

      {/* Row 2: Status pills + Sort toggle */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((opt) => {
            const active = status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                className="mono"
                onClick={() => setStatus(opt.value)}
                aria-pressed={active}
                style={{
                  height: 30,
                  padding: '0 12px',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: active ? 'var(--amber-text)' : 'var(--ink-subtle)',
                  background: active ? 'var(--amber-tint)' : 'transparent',
                  border: `1px solid ${active ? 'var(--amber)' : 'var(--rule)'}`,
                  borderRadius: 'var(--radius-chip)',
                  transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Sort toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)', letterSpacing: '0.06em' }}>
            Sort:
          </span>
          <button
            type="button"
            className="mono"
            onClick={() => setSort((s) => (s === 'updated' ? 'title' : 'updated'))}
            style={{
              fontSize: 10,
              color: 'var(--ink)',
              background: 'transparent',
              border: 'none',
              padding: '4px 6px',
              borderRadius: 'var(--radius-chip)',
              letterSpacing: '0.04em',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--parchment)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {sort === 'updated' ? 'Last edited ↓' : 'Title A–Z'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-subtle)' }}
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
