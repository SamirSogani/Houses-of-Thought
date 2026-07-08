# 02 — Findings schema + AiAction (the detection-engine contract)

Phase 1, part 2 of 3. The shared contract between every AI route and the
client: the AI returns **findings**; a finding may carry an **action**; only
the reducer applies actions. One detection engine, two renderings
(decision 007).

## Files

- **Read first:** `lib/build/types.ts`, `lib/build/state.ts`,
  `lib/build/suggestions.ts` (the pattern being replaced).
- **Create:** `lib/ai/findings.ts` (zod schemas + TS types; client-safe —
  no server imports), `lib/build/aiActions.ts` (`applyAiAction`).
- **Modify:** `lib/build/types.ts` (one new `Action` variant),
  `lib/build/state.ts` (one new reducer case).

## `lib/ai/findings.ts`

```ts
export const FINDING_KINDS = [
  'framing',              // question too broad/compound/vague
  'vague_concept',        // term used but not pinned down
  'missing_perspective',  // stakeholder absent
  'weak_perspective',     // perspective has no stance/subQs/counters
  'missing_evidence',     // claim with nothing underneath
  'single_source',        // conclusion-relevant evidence from one source
  'hidden_assumption',    // unstated premise
  'load_bearing',         // assumption the conclusion depends on
  'conclusion_gap',       // conclusion outruns evidence/perspectives
  'unexamined_implication', // consequence or bearer not considered
] as const

export const AiActionSchema = z.discriminatedUnion('kind', [
  add_concept:      { term, definition },
  add_perspective:  { name, summary, stance },
  add_subquestion:  { perspectiveName, q },      // matched by name, case-insensitive
  add_assumption:   { text },
  add_implication:  { ikind: 'pos'|'neg'|'unc', text, horizon: Horizon, who },
  add_watchpoint:   { text },
  add_evidence:     { text, source, url },       // Research Mode ONLY (doc 06)
])   // written as proper z.object literals; all strings min(1), ≤ 300 chars

export const FindingSchema = z.object({
  kind: z.enum(FINDING_KINDS),
  layer: z.number().int().min(1).max(7),
  severity: z.enum(['note', 'important']),
  observation: z.string(),   // what the engine noticed — Decide rendering, line 1
  suggestion: z.string(),    // proposed move — Decide rendering, line 2
  question: z.string(),      // Socratic form — Learn rendering (sole content)
  action: AiActionSchema.nullable(), // null when the move is "think", not "add"
})
export const FindingsResponseSchema = z.object({ findings: z.array(FindingSchema).min(1).max(4) })
```

**Invariant 1 lives here:** there is deliberately no action variant that sets
`conclusion`, `reasoning`, `question`, or `purpose`. Add a comment saying so.
Note the model always produces all three renderings (`observation`,
`suggestion`, `question`); the client picks by mode — so a house can switch
modes without refetching.

## `lib/build/aiActions.ts`

```ts
export function applyAiAction(draft: State, action: AiAction): string | null
```

Pure in-place mutation of an already-cloned draft (mirror `suggestions.ts`
`run()` mechanics — reuse its `nextId` pattern). Returns a toast string, or
null if the action is inapplicable (e.g. `add_subquestion` names an unknown
perspective — then no-op).

Provenance on apply: perspectives/assumptions get `owner: 'ai'`; evidence gets
`owner: 'ai'`, `byAI: true` (types already support this; `people.ts` already
defines the `ai` person). Concepts/implications/watchpoints have no owner
field — accepted gap for v1.

## Reducer

- `types.ts`: add `| { type: 'APPLY_AI_ACTION'; action: AiAction }` (import
  the type from `lib/ai/findings.ts`).
- `state.ts`: new case — clone as the reducer already does, call
  `applyAiAction`, set `toast` from its return value if non-null.

## Deprecate the static bank

Top of `lib/build/suggestions.ts`, add: `// DEPRECATED — replaced by the live
co-pilot (plans/active/ai). Kept for the ACCEPT_SUGGESTION/accepted plumbing;
do not extend.` Do **not** delete the file, the `accepted` field, or the
`ACCEPT_SUGGESTION` action (persisted in DB; cleanup is a separate ask).

## Acceptance

- `npx tsc --noEmit` passes.
- Manual: temporarily dispatch a hardcoded `APPLY_AI_ACTION`
  (`add_assumption`) from a dev button or console; the assumption appears,
  autosaves, and survives reload on `/house`. Remove the test hook after.
