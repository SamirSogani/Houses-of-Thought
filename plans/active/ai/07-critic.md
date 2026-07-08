# 07 — The Critic: Socratic review on the Review layer

Phase 5. Decision 007's second build-sequence item: at Review, the AI stops
suggesting and starts challenging. Commentary only — the deterministic House
Strength score is untouched (invariant 6).

## Files

- **Read first:** `components/build/layers/ReviewLayer.tsx`,
  `lib/build/strength.ts` (do not modify), `lib/ai/prompts.ts`,
  `lib/ai/findings.ts`.
- **Create:** `app/api/ai/critique/route.ts`,
  `components/build/layers/CritiqueSection.tsx`.
- **Modify:** `ReviewLayer.tsx` (mount the section), `lib/ai/prompts.ts`.

## Route: `POST /api/ai/critique`

Request `{ "house": { … } }` — no mode param; like `/suggest`, the response
carries both renderings and the client picks. Response schema:

```ts
const STANDARDS = ['clarity','accuracy','depth','breadth','logic','fairness'] as const
// Paul–Elder standards, trimmed to the six that map cleanly onto the house.

{ headline: z.string(),                    // one sentence, the critic's overall read
  standards: z.array(z.object({
    standard: z.enum(STANDARDS),
    grade: z.enum(['strong','mixed','weak']),
    note: z.string(),      // Decide rendering: what specifically earns the grade
    question: z.string(),  // Learn rendering: the challenge as a question
  })).length(6),
  weakestLink: z.object({
    layer: z.number().int().min(1).max(7),
    why: z.string(),
    question: z.string(),
  }) }
```

`effort: 'high'`, `maxTokens: 1600`, body cap 100 KB, `maxDuration = 30`.

Critique block essence:

> Review the WHOLE house as a firm, fair critic. For each standard, grade
> what is actually on the page — quote fragments; an empty layer is evidence
> of a gap, not neutral. `note` states the specific weakness or strength;
> `question` is the challenge that would make the person see it themselves.
> `weakestLink` is the single point where the house most likely fails —
> prefer load-bearing assumptions and conclusion–evidence gaps. Do not
> propose conclusion text. Do not soften: "mixed" must mean something real.

## UI — `CritiqueSection` in `ReviewLayer`

- Placed beside/below the existing strength readout with a clear seam: the
  score is computed; this is the co-pilot's read. Button: **"Inspect the
  house"** (SparkIcon, amber accent, matching chrome). Not auto-run —
  a critique is a deliberate act (and an expensive call).
- Loading: "Walking the house…" skeleton. Result:
  - `headline` on top;
  - six standard rows: name (mono), grade chip (strong = green tint,
    mixed = amber tint, weak = coral/red tint — reuse existing palette
    vars), then per mode: **Decide** → `note`; **Learn** → `question`;
  - **Weakest link** card, visually distinct (ink border): layer name (map
    via `layers` from `lib/build/content.ts`), then `why` (Decide) or
    `question` (Learn), plus a "Go to layer" link → `GO_STEP`.
- Result held in component state with the `contentHash` it was computed for;
  if the house changes afterwards show "House changed since this critique" +
  Re-inspect. Not persisted (a critique is of a moment, not of the house).
- Mode switch swaps note/question instantly from the held response.

## Acceptance

- A deliberately lopsided house (rich evidence one side, no counters, empty
  assumptions) gets: assumptions-related weakest link or `weak` grades where
  expected, quotes from actual house text, and a working "Go to layer" link.
- Learn/Decide toggle swaps note ↔ question without a network call.
- Strength number identical before/after critique (no coupling).
- `npx tsc --noEmit`, `npm run build` pass.
