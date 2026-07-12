// Types + helpers for courses (plan phase 4): ordered units that group a class's
// assignments. Mirrors lib/classroom/classes.ts. A course is class-scoped (see
// migration 0016).

// Shape of a public.courses row.
export interface CourseRow {
  id: string
  class_id: string
  title: string
  description: string
  position: number
  created_at: string
}

export interface CourseSummary {
  id: string
  classId: string
  title: string
  description: string
  position: number
}

export function rowToCourse(row: CourseRow): CourseSummary {
  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    description: row.description,
    position: row.position,
  }
}

// Sort by explicit position, ties broken by insertion order (stable input).
export function byPosition<T extends { position: number }>(a: T, b: T): number {
  return a.position - b.position
}
