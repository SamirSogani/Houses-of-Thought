-- 0008_house_concept_definitions.sql
-- Frame concepts gain an optional definition. Stored as a parallel ordered
-- array to `houses.concepts` (index i in `concept_definitions` defines the
-- concept at index i in `concepts`), matching the existing text[] style. Rides
-- the existing table grants (0005) and RLS (0006); no new grants/policies.
-- Idempotent.

alter table public.houses
  add column if not exists concept_definitions text[] not null default '{}';
