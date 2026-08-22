# Additional Traps Found While Reading

These weren't on the original hand-off list of known edge cases — found while
reading the migrations and the code they back. See [edge-cases.md](edge-cases.md)
for the confirmed, previously-known list.

- **`house_activity`'s `authenticated` SELECT policy is unreachable.** 0036
  wrote a `can_access_house` SELECT policy for it, but only ever granted the
  table itself to `service_role` — `authenticated` has no base-table
  privilege, so the policy can never actually run for a normal user session.
  Not a functional bug (the only real reader, `app/api/activity/route.ts`,
  already uses the service-role client), but the policy is dead code that
  could mislead someone into expecting a direct client query to work.
- **A pass-through field needs to match its true source's cap, not the
  generic AI-output cap.** `FramePacketSchema.original_query` reused the
  600-char `str` type meant for constrained model output, but the field is
  the caller's own question, echoed unchanged with no re-validation —
  `RunState.originalQuery` already allowed up to 2000. Any question over 600
  characters generated a frame successfully, then hard-failed on the very
  next request (frame-review) every time, with retry failing identically in
  under 100ms since no AI call was even reached. Fixed 2026-08-20 (commit
  `6baac7f`) with a dedicated `originalQueryStr` cap matching the real
  ceiling. Two sibling fields (`EvidencePopulateSchema`,
  `PerspectiveBundleSchema`) had the same cap-mismatch shape fixed the same
  day — worth checking any new packet field that echoes caller input rather
  than generating fresh text.
- **Migration 0043 is unapplied.** See [index.md](index.md) — code on this
  branch already assumes its columns exist; the file itself says so.
- **"Apply BEFORE deploying the code that ships with it"** is a recurring
  header note (0024, 0026, 0027, 0041) for any migration whose columns the
  client starts reading/writing immediately — an expand-then-deploy ordering,
  not automatic given this repo's single shared database.
- **A cascade delete can race a same-transaction trigger's own foreign key.**
  Deleting a house cascades to `house_collaborators` (FK `on delete cascade`),
  but by the time that cascade fires the `houses` row is already gone — so
  `log_collaborator_activity`'s `DELETE` branch checks
  `exists (select 1 from houses where id = old.house_id)` first and skips
  logging when it's false, or its own insert into `house_activity` (FK to
  `houses`) would violate that constraint and abort the entire house
  deletion. A plain removal/leave (house still exists) logs as before.
