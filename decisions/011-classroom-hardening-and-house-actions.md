# Decision 011 — Classroom E2E hardening & dashboard house actions

**Date:** 2026-07-10
**Status:** Implemented & verified end-to-end (live Supabase + Groq)
**Migrations:** `0019_profiles_grants`, `0020_fix_houses_select_returning`, `0021_houses_turned_in`

## Context

After building the classroom model ([decision 010](010-classroom-model.md), phases 1–6), a full
end-to-end pass against the live project surfaced latent bugs and gaps. This records the fixes
and the small feature added on top (house-card actions). The classroom *design* stays in 010;
this is the follow-up hardening.

## Fixes surfaced by E2E testing

### 1. `profiles` had no table GRANT (0019)
`profiles` has had RLS + policies since 0001 but never a base-table grant to `authenticated`.
Postgres checks table privilege *before* RLS, so every authenticated read/write to `profiles`
returned `42501` (403 over PostgREST). This silently broke **teacher detection**, capability
gating, and **every profile save**. Same class of bug 0005 fixed for `houses`. Fix: `0019`
grants select/insert/update/delete on `profiles` to `authenticated`.

### 2. Signup role didn't persist (GoTrue timing)
The 0013 trigger reads `account_type` from `raw_user_meta_data`, but GoTrue can create the
`auth.users` row *before* the metadata commits, so the trigger read it as absent and defaulted
to `standard`. Fix: [app/login/page.tsx](../app/login/page.tsx) now writes `account_type` to the
profile from the client immediately after `signUp` (it has a session then) — the authoritative
path. The trigger stays as a best-effort default (noted in 0013).

### 3. `houses_select` re-broke `INSERT ... RETURNING` (0020)
0014/0017 rewrote `houses_select` to lead with `can_access_house(id)`, which self-queries
`houses` — the exact [decision 004](004-houses-rls-create-house.md) trap. Creating a house
failed with `42501 new row violates row-level security policy`. Fix: `0020` restores a direct
`owner_id = auth.uid()` owner check (no self-query) while keeping the collaborator + classroom
read branches. Rule (again): an RLS policy must never sub-query its own table to authorize a row.

### 4. Silent save failures + lost autosaves (robustness)
- **Errors swallowed:** [ProfileForm](../components/profile/ProfileForm.tsx) and
  [SubmissionFeedback](../components/build/SubmissionFeedback.tsx) surfaced only `23505` and
  otherwise showed "All changes saved" — which is what hid the 403 above for an hour. Both now
  show an explicit **"Couldn't save"** state.
- **Autosave dropped on fast navigation:** the profile (650 ms) and builder (800 ms) debounced
  saves lost an edit if the user navigated away inside the debounce window. Both now **flush the
  pending write on unmount** (covers client-side route changes; a full-page unload is still
  out of scope — needs `beforeunload` + `sendBeacon`).

## Dashboard house actions (kebab menu)

Each house card on the dashboard gained a ⋮ menu ([HouseCard.tsx](../components/dashboard/HouseCard.tsx)):
- **Rename** — inline overlay editing `houses.title`.
- **Share** — copies the house link to the clipboard.
- **Delete** — two-step confirm → deletes the house (owner-only RLS).
- **Turn in** — only on assignment submissions (`houses.assignment_id` set); toggles
  `houses.turned_in` (migration `0021`), the card shows a "Turned in" chip, and the teacher's
  assignment-detail submissions show it too — closing the submit→grade loop.

The menu only renders where its callbacks are supplied (the owner's dashboard). Read-only
usages — the teacher roster grid — pass none, so no menu appears there.

**Deferred — Share is copy-link only.** Houses are private (owner + collaborators), and
collaboration invites aren't wired ([decision 003](003-collaboration-model.md)), so a recipient
can't open the link yet. Making Share actually grant access (a `house_collaborators` row, or a
public/published view) is a follow-up.

## Verification

The full loop was exercised in-browser against live Supabase + Groq: teacher / student /
standard signups with the correct persisted roles; class + join code; assignment + strawman
generate → teacher review → student attack (read-only); student submission (Learn-locked) +
turn-in; teacher critic (Groq) → grade → feedback; student sees feedback; and create / rename /
delete / share of houses. All confirmed against the live database.

## Migration index (this initiative)

`0013`–`0018` — classroom model (see [decision 010](010-classroom-model.md)).
`0019` profiles grant · `0020` houses_select fix · `0021` houses.turned_in — this document.
