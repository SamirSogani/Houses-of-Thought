-- 0027_save_house_rpc.sql
-- One transactional whole-house save (DB plan Phase-0 §3; performance audit H3,
-- code-quality B2). Idempotent. ⚠ Apply BEFORE deploying the code that ships
-- with it — lib/build/persistence.ts switches saveHouse() over to this RPC.
--
-- What it replaces: the client used to issue up to NINE sequential PostgREST
-- round trips per save (1 parent UPDATE + 4 DELETEs + up to 4 bulk INSERTs).
-- Every statement was checked, but they were not one transaction: a failure
-- after a DELETE and before its INSERT left that layer permanently empty, and
-- two concurrent writers could interleave their delete/insert pairs. A function
-- body is a single transaction, so the whole replace now commits or rolls back
-- as a unit, in one round trip.
--
-- SECURITY INVOKER (the default, stated explicitly): the body runs as the
-- caller, so the existing owner-only RLS on houses and the four child tables is
-- what decides whether the write is allowed. This function grants no new access.
--
-- Concurrency: p_expected_rev is the updated_at the caller loaded. The parent
-- UPDATE is conditioned on it, so a stale writer matches zero rows and the
-- function raises BEFORE deleting anything. Passing null skips the check (first
-- save of a freshly created house).

create or replace function public.save_house(
  p_id uuid,
  p_expected_rev timestamptz,
  p_content jsonb
) returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rev timestamptz;
begin
  update public.houses set
    title               = nullif(p_content ->> 'title', ''),
    question            = nullif(p_content ->> 'question', ''),
    purpose             = nullif(p_content ->> 'purpose', ''),
    conclusion          = nullif(p_content ->> 'conclusion', ''),
    reasoning           = nullif(p_content ->> 'reasoning', ''),
    concepts            = coalesce(
                            array(select jsonb_array_elements_text(p_content -> 'concepts')),
                            '{}'::text[]),
    concept_definitions = coalesce(
                            array(select jsonb_array_elements_text(p_content -> 'conceptDefinitions')),
                            '{}'::text[]),
    watchpoints         = coalesce(
                            array(select jsonb_array_elements_text(p_content -> 'watchpoints')),
                            '{}'::text[]),
    mode                = coalesce(p_content ->> 'mode', 'decide'),
    -- jsonb 'null' is a value, not SQL NULL — normalize so a cleared context or
    -- draft stores as SQL NULL exactly like the old client payload did.
    ai_context          = case when jsonb_typeof(p_content -> 'aiContext') in ('null', 'undefined')
                                 or p_content -> 'aiContext' is null
                            then null else p_content -> 'aiContext' end,
    draft               = case when jsonb_typeof(p_content -> 'draft') in ('null', 'undefined')
                                 or p_content -> 'draft' is null
                            then null else p_content -> 'draft' end,
    layers_complete     = coalesce((p_content ->> 'layersComplete')::int, 0),
    status              = coalesce(p_content ->> 'status', 'empty'),
    -- The 0003 BEFORE UPDATE trigger also bumps this; set it explicitly so the
    -- token still advances if that trigger is ever dropped.
    updated_at          = now()
  where id = p_id
    and (p_expected_rev is null or updated_at = p_expected_rev)
  returning updated_at into v_rev;

  -- Zero rows: the row is gone, not ours (RLS), or changed since load. Mirrors
  -- the classification lib/build/persistence.ts used before this RPC existed.
  if v_rev is null then
    if p_expected_rev is null then
      raise exception 'save-failed' using errcode = 'P0001';
    else
      raise exception 'stale-write' using errcode = 'P0001';
    end if;
  end if;

  -- ── Perspectives ──────────────────────────────────────────────────────────
  delete from public.house_perspectives where house_id = p_id;
  insert into public.house_perspectives
    (house_id, name, summary, questions, stance, sub_questions,
     supporting_evidence, counters, strength, owner_key, position)
  select
    p_id,
    coalesce(e ->> 'name', ''),
    e ->> 'summary',
    jsonb_array_length(coalesce(e -> 'subQuestions', '[]'::jsonb)),
    e ->> 'stance',
    coalesce(e -> 'subQuestions', '[]'::jsonb),
    coalesce(e -> 'supportingEvidence', '[]'::jsonb),
    coalesce(e -> 'counters', '[]'::jsonb),
    coalesce((e ->> 'strength')::int, 0),
    coalesce(e ->> 'owner', 'you'),
    (ord - 1)::int
  from jsonb_array_elements(coalesce(p_content -> 'perspectives', '[]'::jsonb))
       with ordinality as t(e, ord);

  -- ── Evidence ──────────────────────────────────────────────────────────────
  delete from public.house_evidence where house_id = p_id;
  insert into public.house_evidence
    (house_id, text, source, url, owner_key, by_ai, position)
  select
    p_id,
    coalesce(e ->> 'text', ''),
    e ->> 'source',
    e ->> 'url',
    coalesce(e ->> 'owner', 'you'),
    coalesce((e ->> 'byAI')::boolean, false),
    (ord - 1)::int
  from jsonb_array_elements(coalesce(p_content -> 'evidence', '[]'::jsonb))
       with ordinality as t(e, ord);

  -- ── Assumptions ───────────────────────────────────────────────────────────
  delete from public.house_assumptions where house_id = p_id;
  insert into public.house_assumptions (house_id, text, owner_key, position)
  select
    p_id,
    coalesce(e ->> 'text', ''),
    coalesce(e ->> 'owner', 'you'),
    (ord - 1)::int
  from jsonb_array_elements(coalesce(p_content -> 'assumptions', '[]'::jsonb))
       with ordinality as t(e, ord);

  -- ── Implications ──────────────────────────────────────────────────────────
  -- Three reducer lists collapse into one table via `kind`. The lateral join
  -- restarts ordinality per kind, so each list round-trips in its own order.
  delete from public.house_implications where house_id = p_id;
  insert into public.house_implications (house_id, kind, text, horizon, who, position)
  select
    p_id,
    k.kind,
    coalesce(e ->> 'text', ''),
    nullif(e ->> 'horizon', ''),
    e ->> 'who',
    (ord - 1)::int
  from (values ('pos'), ('neg'), ('unc')) as k(kind)
  cross join lateral jsonb_array_elements(coalesce(p_content -> k.kind, '[]'::jsonb))
       with ordinality as t(e, ord);

  return v_rev;
end;
$$;

grant execute on function public.save_house(uuid, timestamptz, jsonb) to authenticated;
