// Types + helpers for the teacher classroom (plan phase 2). Mirrors the shape of
// lib/dashboard/houses.ts: DB rows come from Supabase (see app/classroom/*), and
// this module maps them to the camelCase view models the UI renders.

// ── Classes ─────────────────────────────────────────────────────────────────
// Shape of a public.classes row (see migration 0014).
export interface ClassRow {
  id: string
  name: string
  join_code: string
  created_at: string
}

export interface ClassSummary {
  id: string
  name: string
  joinCode: string
}

export function rowToClass(row: ClassRow): ClassSummary {
  return { id: row.id, name: row.name, joinCode: row.join_code }
}

// Absolute invite link a teacher shares with students. Browser-only (reads
// window.location.origin); call from client components / event handlers.
export function inviteUrl(joinCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/join/${joinCode}`
}

// ── Roster ──────────────────────────────────────────────────────────────────
// Shape returned by the get_class_roster(cid) RPC (see 0014).
export interface RosterMemberRow {
  user_id: string
  username: string | null
  email: string | null
  joined_at: string
}

export interface RosterMember {
  userId: string
  // Best available display name: username, else the email local-part, else a
  // short id fallback so the row is never blank.
  label: string
}

export function rowToRosterMember(row: RosterMemberRow): RosterMember {
  const label =
    row.username?.trim() ||
    row.email?.split('@')[0] ||
    `Student ${row.user_id.slice(0, 6)}`
  return { userId: row.user_id, label }
}
