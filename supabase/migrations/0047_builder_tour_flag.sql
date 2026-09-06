-- 0047_builder_tour_flag.sql
-- Add a has_seen_builder_tour boolean to profiles so the onboarding tooltip
-- tour is shown exactly once per user (UX audit September 2026, item 1).
-- Defaults to false; set to true after the user completes or skips the tour.

alter table public.profiles
  add column if not exists has_seen_builder_tour boolean not null default false;
