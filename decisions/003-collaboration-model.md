# Decision 003 — Collaboration Model (DB Foundation)

**Date:** 2026-07-04
**Status:** Decided (foundation only — no app feature wired yet)
**Migration:** `supabase/migrations/0004_collaborators.sql`

## Context

Decision 002 scoped the first persistence cut as single-owner. This lays the
**database foundation** for sharing a house with other users, ahead of building
the feature, so the schema isn't retrofitted once the app grows complex.

## Decisions made

### 1. `house_collaborators` as the sharing primitive
- **Choice:** One row per `(house_id, user_id)` with a `role`. The owner is
  tracked via `houses.owner_id`, never as a collaborator row.
- **Reasoning:** A generic membership table serves both peer collaboration and
  (later) classroom sharing without committing to either yet.

### 2. Two roles: `viewer` / `editor`
- **Choice:** `text` + `CHECK` (not a pg enum) so roles can be added without an
  enum migration. New rows default to `editor`.
- **Access model:**
  - **read** a house + its content → any collaborator (`can_access_house`)
  - **write** content → owner + editors (`can_edit_house`)
  - **delete the house / manage the collaborator list** → owner only
  - a collaborator may remove **themselves** (leave a house)

### 3. `SECURITY DEFINER` access helpers
- **Choice:** `can_access_house()` / `can_edit_house()` are `SECURITY DEFINER`,
  reused by every table policy.
- **Reasoning:** They read `houses`/`house_collaborators` with RLS bypassed,
  which is what prevents infinite RLS recursion between the two tables. Extends
  the `owns_house()` pattern from 0003.

### 4. Foundation is behavior-preserving
- **Choice:** 0004 rewrites the 0003 owner-only policies to be access-aware, but
  with `house_collaborators` empty the helpers reduce to owner-only — so live
  behavior is unchanged until collaborator rows are inserted.

## Deferred

- Per-row authorship (`author_id` on child tables); `owner_key` stays cosmetic.
- Email/pending invites (current table requires an existing `auth.users` id).
- Reconciling with decision 001 (multi-user framed as a *classrooms* concept) —
  settle when the collaboration feature is actually designed.
- Owner-transfer / making `owner_id` immutable to non-owners.
