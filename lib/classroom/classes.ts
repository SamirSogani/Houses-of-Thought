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
// Shape returned by the get_class_roster(cid) RPC (0014, extended by 0024).
export interface RosterMemberRow {
  user_id: string
  username: string | null
  email: string | null
  // Absent until migration 0024 is applied — map tolerantly.
  account_type?: string | null
  joined_at: string
}

export interface RosterMember {
  userId: string
  // Best available display name: username, else the email local-part, else a
  // short id fallback so the row is never blank.
  label: string
  // The member's self-selected account type (bl-H5): the student AI clamp binds
  // to it, so a teacher needs to SEE the one 'standard' member whose co-pilot
  // is not clamped and ask them to switch. Null before 0024.
  accountType: string | null
}

export function rowToRosterMember(row: RosterMemberRow): RosterMember {
  const label =
    row.username?.trim() ||
    row.email?.split('@')[0] ||
    `Student ${row.user_id.slice(0, 6)}`
  return { userId: row.user_id, label, accountType: row.account_type ?? null }
}
