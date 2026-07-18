// Types + helpers for assignments (plan phase 3). Mirrors lib/classroom/classes.ts.
// An assignment is a teacher-posed question scoped to one class; each student
// answers it in their own house (houses.assignment_id links back).

import type { AiMode } from '@/lib/build/types'

// Shape of a public.assignments row (see migrations 0015, 0016).
export interface AssignmentRow {
  id: string
  class_id: string
  question: string
  mode: AiMode
  ai_strawman_enabled: boolean
  strawman_house_id: string | null
  strawman_released: boolean
  due_at: string | null
  course_id: string | null
  position: number
  created_at: string
}

export interface AssignmentSummary {
  id: string
  classId: string
  question: string
  mode: AiMode
  dueAt: string | null
  courseId: string | null // null = ungrouped (not in any course)
  position: number // order within its course
  aiStrawman: boolean // teacher enabled the "attack the strawman" exercise
  strawmanHouseId: string | null // set once the teacher has generated the strawman
  strawmanReleased: boolean // teacher reviewed it and released it to students (0024)
}

export function rowToAssignment(row: AssignmentRow): AssignmentSummary {
  return {
    id: row.id,
    classId: row.class_id,
    question: row.question,
    mode: row.mode,
    dueAt: row.due_at,
    courseId: row.course_id,
    position: row.position,
    aiStrawman: row.ai_strawman_enabled,
    strawmanHouseId: row.strawman_house_id,
    strawmanReleased: row.strawman_released ?? false,
  }
}

// Columns to select for an assignment summary — keep in sync with AssignmentRow.
export const ASSIGNMENT_COLUMNS =
  'id, class_id, question, mode, ai_strawman_enabled, strawman_house_id, strawman_released, due_at, course_id, position, created_at'

// Short human due label, e.g. "Due Jun 6" — or null when no due date is set.
// The year appears whenever it differs from the current one, so "Due Jan 5"
// can't be misread across a winter break.
export function dueLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return `Due ${d.toLocaleString('en-US', opts)}`
}

// Whether the due instant has passed. due_at stores local END of the due day
// (see AssignmentPanel's create handler), so this flips the morning after.
export function isOverdue(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() < Date.now()
}
