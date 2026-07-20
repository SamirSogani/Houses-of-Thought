# Database & Data-Model Remediation Plan

Companion to [database-and-data-model.md](database-and-data-model.md) (finding
ids C1…L5 refer there). Ordered by leverage; "Gate" marks what must land
**before school pilots**. Efforts: S ≤ half a day, M ≤ 2 days, L ≤ a week.

## Phase 0 — stop the bleeding (Gate)

### 1. Scope the dashboard query to the owner — fixes C1 (S)
`app/dashboard/page.tsx:52-58`: add `.eq('owner_id', user.id)` (the user is
already fetched at :44). This both removes student houses from teachers'
personal grids and lets the planner use an index. Add the supporting index:

```sql
-- 0023_dashboard_index.sql
create index if not exists houses_owner_updated_idx
  on public.houses (owner_id, updated_at desc)
  where is_strawman = false;
```

Verify with `explain analyze` as an authenticated user (policy short-circuits on
`owner_id = auth.uid()` per row; no definer subplans on the hot path).

### 2. Adopt a real migration workflow — fixes C2 (M)
- `supabase init` + link the project; **baseline** by dumping the live schema
  (`supabase db dump --schema public`) and diffing against the concatenation of
  0001–0022. Resolve every diff explicitly — this retires the "0001 was
  reconstructed" uncertainty in one afternoon.
- Move files under the CLI's `supabase/migrations/<timestamp>_*.sql` convention;
  from now on apply with `supabase db push` (or `migration up`), never the SQL
  editor. The CLI's `schema_migrations` table becomes the applied-state record.
- Add one canonical `policies_houses.sql` (or a doc) stating the *current*
  `houses_select`; edit the ⚠-marked blocks in 0014/0017 to be no-ops
  (`-- superseded, do not re-run`) so a stray re-run can't regress 0020.
- Staging then becomes `supabase db push` against a second project — minutes,
  not 22 pastes.

### 3. Transactional whole-house save RPC — fixes H1 (M)
Replace the nine-request `saveHouse` body with one `security invoker` function
so RLS still applies but the replace is atomic:

```sql
-- 0024_save_house_rpc.sql (sketch)
create or replace function public.save_house(
  hid uuid, parent jsonb, persp jsonb, evid jsonb, assum jsonb, implic jsonb
) returns void language plpgsql security invoker as $$
begin
  update public.houses set
    title = parent->>'title', question = parent->>'question', /* …all cols… */
    updated_at = now()
  where id = hid;                       -- RLS: owner/editor only
  if not found then raise exception 'not-editable'; end if;
  delete from public.house_perspectives where house_id = hid;
  insert into public.house_perspectives (house_id, name, /*…*/ position)
    select hid, x.* from jsonb_to_recordset(persp) as x(name text, /*…*/ position int);
  -- …same for evidence / assumptions / implications…
end $$;
grant execute on function public.save_house(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
```

Client: `supabase.rpc('save_house', …)` once, **check the error** (pairs with
code-quality B1). A failed save now leaves the previous content intact instead
of a half-deleted house. Also cuts autosave traffic ~9× (growth item 2).

### 4. One submission per student per assignment — fixes H3 (S/M)
```sql
-- 0025_submission_unique.sql
-- Merge/inspect duplicates first:
--   select assignment_id, owner_id, count(*) from public.houses
--   where assignment_id is not null and not is_strawman
--   group by 1,2 having count(*) > 1;
create unique index if not exists houses_one_submission_idx
  on public.houses (assignment_id, owner_id)
  where assignment_id is not null and is_strawman = false;
```
Then make `open_assignment` race-proof: `insert … on conflict do nothing`
followed by the select (or catch `unique_violation` and re-select). For
`ensure_strawman_house`, guard the link with
`update … set strawman_house_id = hid where id = aid and strawman_house_id is null`
and re-read; delete the orphan if the update matched zero rows.

### 5. Protect graded/turned-in submissions from hard delete — fixes H2 (M)
Cheapest correct v1: a BEFORE DELETE trigger on `houses` that raises when
`turned_in` or a `submission_feedback` row exists, unless the deleter is the
class teacher. UI: dashboard delete for assignment houses becomes
"remove from dashboard" or is disabled once turned in. Full soft-delete
(`deleted_at timestamptz` + partial indexes + filtered queries) is the better
end state but is L — defer unless pilots demand undo.

### 6. Unblock account deletion — fixes H4 (S)
```sql
-- 0026_deletion_fks.sql
alter table public.submission_feedback
  drop constraint submission_feedback_teacher_id_fkey,
  add constraint submission_feedback_teacher_id_fkey
    foreign key (teacher_id) references auth.users (id) on delete cascade;
alter table public.house_collaborators
  drop constraint house_collaborators_invited_by_fkey,
  add constraint house_collaborators_invited_by_fkey
    foreign key (invited_by) references auth.users (id) on delete set null;
```
(Constraint names: verify with `\d` first — they were auto-named.) Then build
the actual server-side deletion route (service-role `auth.admin.deleteUser`)
behind the existing modal; test that a graded teacher and a grading teacher can
both be deleted end-to-end on staging.

## Phase 1 — before/while pilots scale (weeks, not launch-blocking)

7. **Join-code generation RPC with retry** — M4 (S): `create_class(name)` RPC
   that loops on `unique_violation` (≤5 tries) using an A–Z/0–9 alphabet
   (skip 0/O/1/I for read-aloud friendliness); client stops inserting directly.
8. **Email sync** — M3 (S): `after update of email on auth.users` trigger
   mirroring into `profiles.email` (same definer pattern as `handle_new_user`).
9. **jsonb shape CHECKs** — M7 (S):
   `check (jsonb_typeof(sub_questions) = 'array')` etc. on the 0009 columns;
   `draft`/`ai_context` allow null or object.
10. **Centralize house read policy** — M5 (M): fold the OR-chain into one
    `can_read_house(house public.houses)`-style helper (taking the row, so the
    owner check needs no self-query) used by `houses_select` and all four child
    policies; one definition, five call sites, RETURNING trap structurally gone.
11. **Server-derived status** — M6 (M): compute `layers_complete`/`status`
    inside the `save_house` RPC (step 3) from the submitted payload instead of
    trusting a second client codepath.

## Phase 2 — durability / hygiene (opportunistic)

12. **`accepted` keying** — M1 (L): move accepted-suggestion state onto stable
    ids (persist child uuids into the reducer instead of positional ints).
    Real fix touches the reducer boundary; batch with any builder refactor.
13. **Replace parallel concept arrays** — M2 (M): `concepts jsonb`
    (`[{term,definition}]`) + backfill + drop `concept_definitions`;
    `toConcepts` in `lib/build/persistence.ts:12-19` already tolerates both shapes.
14. **`ai_usage` retention** (S): scheduled
    `delete from public.ai_usage where day < current_date - 90` (pg_cron or a
    Vercel cron hitting a service-role route).
15. Drop vestigial `house_perspectives.questions` (L4), batch position updates
    into one RPC (L5), document the NULL-vs-'' convention (L3) — all S.

## Sequencing summary

Gate for first school pilot: **steps 1–6** (≈ 1.5–2 weeks solo). Step 2 first —
every later step ships as a tracked migration and needs staging to test against.
Then 3 (data loss) and 1 (the C1 correctness bug is teacher-visible on day one),
then 4, 5, 6. Steps 7–11 during the pilot; Phase 2 as maintenance.
