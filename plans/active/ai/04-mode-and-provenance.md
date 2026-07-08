# 04 — Learn/Decide mode, provenance polish, migration 0010

Phase 2. Adds the posture switch from decision 007 and the DB columns every
later phase needs (one migration, all forward columns).

## Files

- **Read first:** `lib/build/types.ts`, `lib/build/persistence.ts`,
  `lib/build/state.ts`, `components/build/ContextBar.tsx`,
  `supabase/migrations/0003_houses.sql` (verify `owner_key` CHECKs include
  `'ai'`; `lib/build/people.ts` defines the `ai` person, so they should),
  `supabase/migrations/README.md`.
- **Create:** `supabase/migrations/0010_ai_columns.sql`.
- **Modify:** `types.ts`, `state.ts`, `persistence.ts`, `ContextBar.tsx`,
  `components/build/rail/CopilotPanel.tsx`,
  `components/build/layers/EvidenceLayer.tsx`,
  `supabase/migrations/README.md` (row for 0010).

## State model

```ts
export type AiMode = 'learn' | 'decide'
export interface AiContext { summary: string; facts: string[] }   // filled in doc 05

interface State {
  mode: AiMode                 // persistable; default 'decide'
  aiContext: AiContext | null  // persistable; written by the interviewer
  …
}
interface Evidence { …; url?: string }   // real citation link (doc 06)
```

New actions: `SET_MODE { mode }`, `SET_AI_CONTEXT { context }` (plain reducer
cases). Default `mode: 'decide'`: today's real users are adults building for
themselves (007 — individuals through the open door); classroom provisioning
will flip defaults to `learn` when classrooms exist.

## Persistence

- `serializeContent`: add `mode`, `aiContext`; evidence items now carry `url`.
- `blankState`: `mode: 'decide'`, `aiContext: null`.
- `loadLocalHouse`: normalize — missing `mode` → `'decide'`, missing
  `aiContext` → `null` (older drafts keep loading).
- `loadHouse`/`saveHouse`: map `houses.mode`, `houses.ai_context`,
  `house_evidence.url`.

## Migration `0010_ai_columns.sql` (idempotent, like 0007–0009)

```sql
alter table public.houses
  add column if not exists mode text not null default 'decide',
  add column if not exists ai_context jsonb;
alter table public.houses drop constraint if exists houses_mode_check;
alter table public.houses add constraint houses_mode_check
  check (mode in ('learn', 'decide'));
alter table public.house_evidence
  add column if not exists url text;
```

If the 0003 `owner_key` CHECKs turn out not to include `'ai'`, extend them
here the same drop/add way. Apply to the live DB as 0007–0009 were (see
`supabase/migrations/README.md` for the procedure); column access rides the
existing grants (0005) and RLS (0003/0004/0006) — no policy changes.

## Mode toggle UI

Segmented two-option control in `ContextBar`, near the strength meter:
**Learn | Decide** (mono, small — match existing chrome). Clicking dispatches
`SET_MODE`; a toast explains the switch once: Learn → "Co-pilot will ask
questions, not give answers."; Decide → "Co-pilot will make concrete
suggestions." Tooltip on the control: "How much help the co-pilot gives."

## Mode behavior (wired here)

- `CopilotPanel` sends `state.mode` to `/api/ai/suggest`; renders the learn
  card (question only, no Add) vs decide card per doc 03. Mode switch re-renders
  from cache — findings carry all renderings, so no refetch.
- `EvidenceLayer`: Research Mode button stays disabled in learn mode after
  doc 06 enables it (`title="Research runs in Decide mode"`) — Decide-only
  capability per 007.
- Evidence cards: when `url` exists, the source chip becomes a link
  (`target="_blank" rel="noreferrer"`).

## Provenance display

Items with `owner === 'ai'` already render the AI avatar via `people.ts`;
verify that's true for perspectives/assumptions/evidence lists and leave the
existing `byAI` "via Research Mode" tag as-is. No new badge system in v1.

## Acceptance

- Toggle persists: flip to Learn on `/house`, reload → still Learn; same on
  `/build/[id]` (row shows `mode='learn'`).
- Learn mode: co-pilot cards show only questions, no Add buttons; Decide
  shows observation + suggestion + Add. Switching modes swaps instantly
  (no network call).
- Older localStorage draft (pre-0010 shape) still loads.
- `npx tsc --noEmit`, `npm run build`, migration applied without error.
