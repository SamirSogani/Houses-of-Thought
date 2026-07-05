# Phase 3 — Profile read/write (execution handoff)

Wire `/profile` to persist to the `profiles` row. Small, self-contained — do
this first to re-prove the round-trip before the builder. Mirror the dashboard
pattern (`app/dashboard/page.tsx`, committed in `70a528e`).

## Read first
`lib/profile/data.ts` (types + `usernameError`), `components/profile/ProfileForm.tsx`
(holds edits; has a **fake** debounced save at lines ~42–53), `app/profile/page.tsx`,
and `supabase/migrations/0002_profiles_extend.sql` (the columns).

## Ground rules
- RLS scopes the row to the user; still `.eq('id', user.id)`. Set nothing you
  don't own. Middleware already guards the route — drop the client `getUser`
  redirect while you're in the file (dashboard did this).
- Keep the client-component pattern and the existing `SaveIndicator` UX.

## Steps
1. **Load.** In `app/profile/page.tsx`, after `getUser`, query the row:
   `supabase.from('profiles').select('username, account_type, about_me, current_project, role, location, perspectives').eq('id', user.id).maybeSingle()`.
   Map it to `ProfileData` and pass as a full `initial` prop to `ProfileForm`
   (replace today's `username?: string` prop).
2. **Mapper.** Add `rowToProfile(row)` + `profileToRow(p)` in `lib/profile/data.ts`.
   snake↔camel: `account_type↔accountType`, `about_me↔aboutMe`,
   `current_project↔currentProject`; `perspectives` (jsonb) passes through.
3. **Save.** Replace the fake timer in `ProfileForm.tsx` with a real debounced
   `update(profileToRow(profile)).eq('id', user.id)`. `SaveIndicator` → `saving`
   while in flight, `saved` on success. **Do not write while `usernameError` is
   non-null.** On a unique-violation (Postgres code `23505`) show "That username
   is taken" under the field.
4. **New-user case.** The `0001` trigger created the row, but new columns are
   defaults (`username` null, `perspectives` an empty-string map). Keep the
   existing behavior of seeding `username` from the email local-part **only when
   the DB value is null**.

## Verify (needs a signed-in session)
Load shows saved values → edit a field → indicator `saving`→`saved` → refresh
persists. Invalid username blocks save; a taken username shows the field error.
`npx tsc --noEmit` clean; preview console/network free of errors.

## Out of scope
**Delete Account** stays a UI stub (`DeleteAccountModal`). Deleting an auth user
needs the **service-role key server-side** (a route/edge function) — the browser
client cannot do it. Flag it; build only if asked. See the builder handoff for
the rest of Phase 3.
