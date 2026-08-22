-- 0043_console_backfill_repair.sql
-- Repairs console messages that 0041's backfill never adopted.
--
-- 0041 added house_console_messages.chat_id and, at the end of the same
-- file, created one 'root' chat per house that already had console rows and
-- pointed those rows at it. Reported live (2026-08-22): conversations from
-- before multi-chat load nowhere AND don't appear under "Recently deleted."
-- That pair of symptoms is what an un-adopted row looks like — it is not
-- deleted, it is ORPHANED. GET /api/houses/[id]/console filters
-- `.eq('chat_id', chatId)`, so a row whose chat_id is still null belongs to
-- no chat and renders in no list; "Recently deleted" reads
-- house_console_chats, where no row was ever created for it either.
--
-- The most likely cause is 0041 not having been applied end-to-end (the
-- backfill is its last statement, so anything that aborts the script earlier
-- takes the backfill with it while leaving the table and columns in place —
-- which is exactly the state that looks "applied" from the app's side).
-- This file re-runs ONLY that final step. It is deliberately a separate
-- migration rather than an edit to 0041: 0041 may already be recorded as
-- applied, and a repair that has to run on its own belongs in its own file.
--
-- Safe to run whether or not the problem exists: scoped entirely to rows
-- whose chat_id is still null, so on a healthy database it matches nothing
-- and both statements are no-ops. Safe to re-run for the same reason.
--
-- One deliberate difference from 0041's version: the recovered chat is
-- TITLED. 0041 inserted title '' (the app derives a title from the first
-- message on send, which never happens for a chat nobody has posted to
-- since), so a recovered conversation would come back as yet another
-- "Untitled chat" among the new ones. Naming it says what it is.

with recovered_chats as (
  insert into public.house_console_chats (house_id, title, origin, created_at, updated_at, last_message_at)
  select house_id, 'Earlier conversation', 'root', min(created_at), now(), max(created_at)
  from public.house_console_messages
  where chat_id is null
  group by house_id
  returning id, house_id
)
update public.house_console_messages m
set chat_id = rc.id
from recovered_chats rc
where m.house_id = rc.house_id and m.chat_id is null;
