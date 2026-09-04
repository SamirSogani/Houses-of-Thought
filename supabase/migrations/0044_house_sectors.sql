-- Sector deep-dive analyses: one row per (house, sector_type). Each sector
-- stores a JSONB analysis blob and a JSONB findings array that bubbles up to
-- the house view. Sectors are generated on demand and can be regenerated.

create table if not exists house_sectors (
  id          uuid primary key default gen_random_uuid(),
  house_id    uuid not null references houses(id) on delete cascade,
  sector_type text not null check (sector_type in ('implications', 'perspectives')),
  status      text not null default 'generating' check (status in ('generating', 'complete', 'failed')),
  analysis    jsonb,
  findings    jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One analysis per sector type per house; regeneration replaces the row.
  unique (house_id, sector_type)
);

-- RLS: same access as the parent house (owner + collaborators).
alter table house_sectors enable row level security;

create policy "Owner can manage sectors"
  on house_sectors for all
  using (
    house_id in (select id from houses where owner_id = auth.uid())
  );

create policy "Collaborators can read sectors"
  on house_sectors for select
  using (
    house_id in (
      select house_id from house_collaborators where user_id = auth.uid()
    )
  );

-- Bump updated_at on every update (same trigger pattern as houses).
create or replace function update_house_sectors_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger house_sectors_updated_at
  before update on house_sectors
  for each row
  execute function update_house_sectors_updated_at();
