# App-Level Shapes

Not every important shape is a table. This doc covers the TypeScript state
that gets serialized into rows, the reasoning pipeline's single-JSONB-column
run state, and the client-safe contracts shared between AI routes and the UI.

## The house `State` shape

`lib/build/types.ts`'s `State` is the builder reducer's full in-memory shape —
seven layers' worth of content plus ephemeral view state (`step`, `toast`,
`activePerspective`). Not all of it is persisted: `lib/build/persistence.ts`'s
`PERSISTED_KEYS` is **the single list** of which `State` fields round-trip to
the database — mode, aiContext, draft, title, purpose, question, conclusion,
reasoning, concepts, perspectives, evidence, assumptions, pos, neg, unc,
watchpoints. Adding a persisted field means adding it to this one list (plus
wiring the DB column in `loadHouse`/`saveHouse`) — the round-trip test fails
until all three agree.

`serializeContent(state)` — `JSON.stringify` of just `PERSISTED_KEYS` — is
used two ways: as the local (no-login) `/house` builder's entire
`localStorage` payload (`LOCAL_HOUSE_KEY`), and as the autosave effect's
dependency, so ephemeral UI changes never trigger a save.

### `save_house` RPC

`saveHouse()` doesn't write child tables directly — it calls the `save_house`
Postgres function (migration 0027) with the whole persisted payload as one
jsonb argument. The function is one transaction: it UPDATEs the parent row
(conditioned on an optimistic-concurrency `p_expected_rev` = the `updated_at`
the client loaded), then deletes and re-inserts all four child tables from the
jsonb arrays. This replaced up to nine separate client round trips that were
individually checked but not atomic — a crash between a child DELETE and its
INSERT used to leave that layer permanently empty. A stale `p_expected_rev`
makes the UPDATE match zero rows, so the function raises before touching any
child table — no partial writes are possible even under a lost race.
`SECURITY INVOKER` (stated explicitly, though it's Postgres's default): the
function runs as the caller, so ordinary owner/editor RLS is still what
decides whether the write is allowed — the RPC grants no new access.

### Invariant: the AI never writes conclusion/reasoning/question/purpose

Enforced at the type level, not just in prompts: `AiAction` (`lib/ai/findings.ts`)
has no variant that targets those four fields. `lib/ai/reasoning/houseMapping.ts`
— which flattens a finished pipeline run into an `AiAction` batch — deliberately
does not produce them even though the underlying packets contain plausible
values; the question is set from the human's own typed prompt, and a
conclusion/reasoning suggestion is offered as an explicit one-click "Use as my
conclusion" action the person must accept. House Chat's admin-only conclusion
candidates (decision 018) are the one narrow, fenced exception.

## `RunState` — one pipeline run, one JSONB column

`app/api/admin/reasoning/route-schema.ts`'s `RunState` (zod-validated) is
*the entire state of a reasoning-pipeline run* — every packet, every review
verdict, every context-gather answer, accumulated field by field as the
pipeline advances step by step. It is not decomposed into separate
packet/verdict tables; the whole thing is written into `reasoning_runs.run_state`
as one blob per row (see [ai-and-console-tables.md](ai-and-console-tables.md)).
This was a deliberate choice (`plans/active/reasoning-pipeline/15-persistence.md`)
— no query yet needs to slice one packet type across runs, so normalizing it
bought nothing.

The pipeline is **client-driven**: `useReasoningPipelineRunner` POSTs to the
reasoning route once per step, each time resending the full `run` object plus
which `step` to run next; the route computes the next patch, merges it into
`RunState`, and persists. There is no server-side orchestration loop holding
state between requests — the client's next POST *is* the continuation.

`consoleGuidance` is the newest field: free-text correction from a console
chat message, folded into every downstream generate call the same way
`contextGatherPost` answers already were, because Perspectives has no
`masterReview` channel of its own to carry a targeted correction through.

## Client-safe contracts (`lib/ai/*.ts`)

A family of modules that are deliberately import-clean of any server-only
code (no Supabase client, no `next/server`), so the same zod schema and pure
helper functions validate a route's output *and* type the UI that renders it:

- **`findings.ts`** — `AiAction`, the one vocabulary every AI surface uses to
  propose a change. A finding is never applied automatically; only the
  reducer's `applyAiAction` path does, and only on a click.
- **`draft.ts`** — Draft Mode's `DraftStage`/`DraftState` and which
  `AiAction` kinds each of the five stages may return.
- **`chat.ts`** — House Chat's intake contract; the clamps here are what
  makes "the AI never writes question/purpose" hold in code, not just prompt
  wording — a non-verbatim extraction falls back to the person's literal
  message, never to model text.
- **`layerFeedback.ts`** — the per-layer Q&A contract backing
  `house_layer_feedback`, reusing `DraftStage`/`AiAction` rather than
  inventing a parallel vocabulary.
- **`console.ts`** — the whole-house console's contract (695 lines, by far
  the largest of these): request/response schemas for chats, revisions
  (Loop A), the single-flight rerun lock (Loop B), and candidate diffing
  (Loop C), plus every pure helper `lib/ai/console.test.ts` covers without a
  database — `messagesToFork`, `reparentChildren`, `toChronological`,
  `runLockBlocks`, `cascadeStages`, `diffCandidateStages`. See
  [edge-cases.md](edge-cases.md) for what several of these fix.
- **`serialize.ts`** — house → compact plaintext outline, what every AI route
  actually sends the model as context.

None of these modules know about Postgres row shapes; routes map DB rows into
these types before validating.
