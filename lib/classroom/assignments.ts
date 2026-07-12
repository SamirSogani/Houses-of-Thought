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
  }
}

// Columns to select for an assignment summary — keep in sync with AssignmentRow.
export const ASSIGNMENT_COLUMNS =
  'id, class_id, question, mode, ai_strawman_enabled, strawman_house_id, due_at, course_id, position, created_at'

// Short human due label, e.g. "Due Jun 6" — or null when no due date is set.
export function dueLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return `Due ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`
}
