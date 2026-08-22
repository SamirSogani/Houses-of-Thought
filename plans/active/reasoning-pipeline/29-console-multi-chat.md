# 29 — Console: multiple chats, branching, deletion

Samir's ask (2026-08-22): the post-pipeline console (plan doc
[28](28-post-pipeline-console.md)) should hold **more than one conversation** —
spin up several chats inside it, **delete** them, and **branch off** an
existing one. Subagent loops are planned separately in
[30](30-console-subagent-loops.md).

## What exists today — verified in code, 2026-08-22

- `/build/[id]/console` renders one implicit transcript per house
  (`components/build/console/ConsolePage.tsx`, 493 lines).
- `house_console_messages` (0040) has no chat/thread column — every row is
  keyed by `house_id` alone, so "the console" and "the house" are the same
  conversation by construction. `GET/POST /api/houses/[id]/console` read the
  whole house's rows, capped at `TRANSCRIPT_LIMIT = 30`.
- A confirmed rerun goes through `useReasoningPipelineRunner.rerunFrom()`,
  which mints a fresh `runId`, resumes the pipeline's own dispatcher, and
  writes into the single `houses` row via `APPLY_RERUN_RESULT` + `saveHouse`.

## Confirmed with Samir before planning (2026-08-22)

- **Branch = fork at a message**, with a lighter "seed a fresh chat" option.
- **Delete = soft delete; branches survive** (re-parented, not cascaded).
- **Loops may re-run real pipeline layers**, bounded — see doc 30.

## The tension this feature has to resolve

Chats fork. **The house does not.** A fork is a cheap copy of a transcript; a
house is a single `houses` row that every chat is talking about. Two branches
that each apply actions — or each confirm a rerun — write to the same place
and silently overwrite each other.

Three ways out:

1. **Chats fork, house stays singular** *(recommended for v1)*. Branching is
   transcript-only. Every write is house-global and labelled as such. Cheap,
   honest, no new invariants.
2. **A branch forks the house too** — a sandbox copy, later merged or
   discarded. Matches the product's own metaphor best, but needs house
   duplication, a diff/merge surface, and dashboard/quota consequences: a
   feature of its own size, not a sub-feature of "multiple chats."
3. Chats fork; some are marked read-only "exploratory" and cannot propose
   writes. Simpler than 2, but arbitrary from the person's side.

**Take 1 now; keep 2 as the phase-3 story** (doc 30's Loop C is its entry
point). What 1 owes the person in exchange for the shared house:

- every apply/rerun button says it changes the house **for every chat**;
- a rerun is **single-flight per house** (doc 30, Loop B);
- a finished rerun **posts a marker into every chat**, so a branch that was
  mid-conversation says so rather than quietly going stale.

## Data model — migration 0041

New `public.house_console_chats`:

| column | notes |
|---|---|
| `id` | uuid pk |
| `house_id` | → `houses(id)` on delete cascade |
| `title` | derived from the first user message, renameable |
| `parent_chat_id` | → `house_console_chats(id)` on delete set null — provenance only |
| `branched_from_message_id` | → `house_console_messages(id)` on delete set null — provenance only |
| `origin` | `'root'` \| `'fork'` \| `'seed'` |
| `deleted_at` | null = active — the repo's first soft delete, no precedent to match |
| `run_id_at_last_reply` | which `reasoning_runs` row was current; drives the "stale" badge |
| `created_by`, `created_at`, `updated_at`, `last_message_at` | |

`house_console_messages` gains:

- `chat_id uuid references house_console_chats(id) on delete cascade`
- `origin_message_id uuid` — set on rows copied into a fork
- `role` CHECK widened to include `'system'` (rerun markers, doc 30)

Backfill in the same migration: one `origin: 'root'` chat per house that
already has console rows, then `update ... set chat_id = <that chat>`. The
column stays nullable for exactly one deploy, then a follow-up sets NOT NULL.
**Local dev and production share one Supabase database**, so this migration
runs against real data and must be additive and idempotent throughout.

RLS/grants mirror 0039/0040 — `can_access_house` for select/insert — plus an
**update** policy (rename, soft delete, restore) and
`grant select, insert, update ... to authenticated` **in the same file**. That
grant line is the exact bug 0029/0031/0034/0035/0037/0039 each shipped without.

### Fork copies rows; it does not reference them

On fork, insert copies of every message up to and including the fork point,
each carrying `origin_message_id`. The alternative — a recursive walk up
`parent_chat_id` at read time — is more elegant and worse here: every
transcript read becomes a recursive CTE, and soft-deleting a parent turns into
a read-path problem instead of a list-path one. Copying keeps `GET` a single
flat select and makes "branches survive deletion" literally true; the cost is
duplicated text rows, the cheapest thing in this schema. `parent_chat_id` /
`branched_from_message_id` therefore exist **only** to render "branched from
*Chat 2*" and to indent the sidebar — nothing reads them to build a
transcript.

## API

| route | verb | does |
|---|---|---|
| `/api/houses/[id]/console/chats` | GET | active chats: id, title, origin, parentChatId, lastMessageAt, turnCount, stale |
| | POST | `{ mode: 'new' \| 'fork' \| 'seed', fromChatId?, fromMessageId? }` |
| `/api/houses/[id]/console/chats/[chatId]` | PATCH | rename, or restore (`deletedAt: null`) |
| | DELETE | soft delete, then re-parent children to the deleted chat's own parent |
| `/api/houses/[id]/console` | GET | `?chatId=` — one chat's transcript |
| | POST | body gains `chatId` |

Every one reuses `authorize()` from the existing console route verbatim
(owner or `editor`, then `canAuthorDraft`) — no new auth surface.

## UI

- Two-pane at `/build/[id]/console?chat=<id>`: chat list left, the existing
  transcript right. The `?chat=` param rather than React state, so
  back/forward and reload behave — the same reasoning doc 28 used to justify a
  route over a modal.
- Branch children indent one level under their parent regardless of real
  depth; deeper chains show "branched from …" instead of nesting further.
- Per-message hover action **Branch from here** → POST `mode: 'fork'`.
- Chat row menu: Rename · Branch · Delete. A **Recently deleted** disclosure
  at the bottom restores.
- A stale chat (its `run_id_at_last_reply` ≠ the house's current run) shows a
  one-line note above the composer, not a blocking modal.
- Mobile: the list collapses into a drawer behind a "Chats" button.

## Caps

20 active chats per house; branch depth 5; `TRANSCRIPT_LIMIT` unchanged at 30.
Forks inherit history, so unbounded branching is unbounded token spend on a
product with no revenue until ~2028 — the cap is a cost control first and a UI
control second.

## Two bugs found while planning

1. **The transcript window returns the wrong 30 turns.** Both the GET and the
   POST context reload use `.order('created_at', { ascending: true }).limit(30)`
   — that is the *oldest* 30 rows. Past 30 turns in a house the console stops
   seeing recent conversation and keeps re-sending the beginning. Fix with
   `ascending: false` plus a reverse in JS. Forks make this bite sooner, since
   a fork starts life with its parent's history already in it.
2. **Applied-action state is React-only** — `added: Set<string>` in
   `ConsolePage` is lost on reload, and a fork shows the parent's chips as
   un-applied. No schema needed: render each chip's state from
   `aiActionApplicable(state, action)`, which already knows, and keep `added`
   purely for the optimistic flash.

## File splits this forces

`ConsolePage.tsx` is at 493 lines before any of this. Split it as part of the
work, per the ~600-line rule:

- `console/ConsolePage.tsx` — layout shell and data orchestration
- `console/ChatSidebar.tsx` — list, tree, rename/delete/restore
- `console/ConsoleTranscript.tsx` — turns, action chips, branch-from-here
- `console/RerunPanel.tsx` — the confirm card plus `ReasoningStagesList`,
  lifted unchanged out of today's file
- `console/useConsoleChats.ts` — chat list state and CRUD
- `lib/ai/console.ts` — chat contract types, caps, fork/seed modes

## Tests

New `lib/ai/console.test.ts`: fork copy semantics, soft-delete re-parenting,
depth/count caps, and the transcript-window fix. `cascadeStages` already
covers what reruns depend on and does not change.
