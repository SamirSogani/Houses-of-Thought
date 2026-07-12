// Types + helpers for the "Your Houses" dashboard. House rows come from Supabase
// (see app/dashboard/page.tsx); this module maps a DB row to the HouseSummary the
// grid renders. Progress is measured against the 7 layers of the Build a House flow
// (see lib/build), so the dashboard and the workspace stay coherent.

export type HouseStatus = 'empty' | 'in-progress' | 'complete'

export interface HouseSummary {
  id: string
  title: string | null // null = untitled
  question: string | null // null = no question set yet
  layersComplete: number // 0..7
  status: HouseStatus
  editedLabel: string
  assignmentId: string | null // set = this house answers an assignment
  turnedIn: boolean // student marked the submission as turned in
}

export const TOTAL_LAYERS = 7

export function housePercent(h: HouseSummary): number {
  return Math.round((h.layersComplete / TOTAL_LAYERS) * 100)
}

export const statusMeta: Record<HouseStatus, { label: string; color: string; bg: string }> = {
  empty: { label: 'Empty', color: 'var(--ink-subtle)', bg: 'var(--parchment)' },
  'in-progress': { label: 'In progress', color: 'var(--amber-hover)', bg: 'var(--amber-tint)' },
  complete: { label: 'Complete', color: 'var(--green-strong)', bg: 'rgba(63,143,91,0.12)' },
}

// Shape of a public.houses row as selected for the dashboard grid (see 0003).
// assignment_id/turned_in are optional so rows from selects that omit them (e.g.
// the roster view) still map cleanly.
export interface HouseRow {
  id: string
  title: string | null
  question: string | null
  status: HouseStatus
  layers_complete: number
  updated_at: string
  assignment_id?: string | null
  turned_in?: boolean
}

export function rowToSummary(row: HouseRow): HouseSummary {
  return {
    id: row.id,
    title: row.title,
    question: row.question,
    layersComplete: row.layers_complete,
    status: row.status,
    editedLabel: editedLabel(row.updated_at),
    assignmentId: row.assignment_id ?? null,
    turnedIn: row.turned_in ?? false,
  }
}

// Relative "Edited …" label matching the reference wording (e.g. "Edited 2d ago",
// falling back to "Edited Jun 6" past a week).
export function editedLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr

  if (diffMs < min) return 'Edited just now'
  if (diffMs < hr) return `Edited ${Math.floor(diffMs / min)}m ago`
  if (diffMs < day) return `Edited ${Math.floor(diffMs / hr)}h ago`
  if (diffMs < 7 * day) return `Edited ${Math.floor(diffMs / day)}d ago`

  const d = new Date(iso)
  return `Edited ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`
}
