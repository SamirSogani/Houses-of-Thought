# Frontend Architecture Remediation Plan

Companion to [frontend-architecture.md](frontend-architecture.md) (ids C1…D10
refer there). Ordered by leverage; **Gate** marks what must land before school
pilots. Efforts: S ≤ half a day, M ≤ 2 days, L ≤ a week. Cross-references:
the DB plan's Phase-0 §3 (`save_house` RPC) is the server half of C1/C2.

## Phase 0 — make saving trustworthy (Gate)

### 1. Save-status state machine + error surface — C1(2), B1 (S) — Gate
Make `onSave` return a `Promise<void>` that rejects on any Supabase error
(`lib/build/persistence.ts:247-331`: check `error` on all nine calls). In
`BuildHousePage`, track `idle | dirty | saving | saved | failed` and render it
in the ContextBar (the mono eyebrow slot). `failed` retries with backoff and
never silently clears. A 401/JWT-expired rejection renders "Signed out — log
in again to keep saving" instead of retrying.

### 2. Single-flight save queue — C2 (S) — Gate
One in-flight save, at most one pending trailing save holding the *latest*
state; a completing save immediately runs the pending one. ~25 lines around
`onSaveRef` in `BuildHousePage.tsx:104-121`. Kills interleaved delete/insert
regardless of when the RPC lands, and gives the draft runner back-pressure.

### 3. Optimistic-concurrency token — C1(1) (M, client half) — Gate
Add `rev int` (or reuse `updated_at`) to `houses`; `loadHouse` returns it,
every save sends it, the `save_house` RPC (DB plan) rejects on mismatch with a
`stale-write` error; client maps that to a blocking "This house changed
elsewhere — reload" banner (no merge UI yet; refuse-and-reload is correct at
this scale). Until the RPC exists, a `.eq('rev', known)` guard on the parent
UPDATE + checking `count` gets 80% of the safety for one line.

### 4. Flush on `visibilitychange`/`pagehide` — H1 (S) — Gate
On `document.visibilitychange → hidden`, cancel the debounce and fire the save
immediately (the queue from §2 serializes it). Move the sign-out flush *before*
`signOut()` in `app/build/[id]/page.tsx:90-95` (flush, await, then sign out).
`sendBeacon` is not needed once hidden-flush + 800ms debounce overlap.

### 5. Draft-gate escape hatch — H2 (S) — Gate
Render a "Stop draft here" affordance wherever the gate is shown when the
runner is unavailable (`DraftClaimBanner` and ReviewLayer know
`draftGateLocked` but can't dispatch `STOP_DRAFT` today). Distinguish 401 /
429-daily / network in `useDraftRunner.ts:65-69` copy. Add the
`draftGateLocked` check to the dashboard turn-in path
(`app/dashboard/page.tsx:126`) so 016 §2's claim is true everywhere.

### 6. Multi-tab writer lock — C1(4) (S)
BroadcastChannel `house:<id>`: second tab to open the same house gets a
read-only banner ("Open in another tab") with a "Take over" button. Cheap,
same-browser only — the cross-device case is §3's job.

## Phase 1 — testing foundation (Gate for the suite marked ✦)

### Runner setup (S)
- `pnpm add -D vitest @vitest/coverage-v8 vite-tsconfig-paths`; optional later:
  `@testing-library/react happy-dom` for hook tests (T24 only).
- `vitest.config.ts`: `plugins: [tsconfigPaths()]` (resolves `@/`),
  `test: { environment: 'node', include: ['**/*.test.ts'] }`. Vitest 3.x is
  the current safe choice with React 19/Next 16; no Next plugin needed because
  the first wave tests pure modules only.
- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`. Wire `pnpm test`
  into the ops plan's CI gate. Fix the false `lib/ai/serialize.ts:7` comment
  when the first test lands.

### Seams that block testing today (name only; do with the first test that needs them)
- **Router client injection**: `clientFor` constructs real `OpenAI` clients.
  Add `__setClientFactory(fn)` next to `__resetRouterState` (router.ts:829) so
  tests inject a fake with scripted 429/400/success per provider. (~10 lines.)
- **Persistence is already injectable** — `saveHouse(supabase, …)` takes the
  client. Write a tiny `mockSupabase()` recording `{table, op, payload}` and
  replaying canned rows; no refactor needed.
- **`useDraftRunner` fetch**: accept an optional `fetchImpl` param defaulting
  to `globalThis.fetch` (one line) — avoids global fetch stubbing.
- **Timers**: penalty box uses `Date.now()` — use `vi.useFakeTimers()`; no
  code change.

### First tests, ranked by bug-catching power × cheapness
Persistence & serialization (highest value: guards C1/C2/M1 fixes and B1/B2):
1. ✦ `loadHouse` returns `null` when any child select errors (write red
   against today's `persp.data ?? []` — this is B2's regression test).
2. ✦ Round-trip: `State` → `saveHouse` writes → replay rows → `loadHouse` →
   `serializeContent` equal modulo positional ids. The keystone test.
3. ✦ `saveHouse` write shape: 1 update + 4 deletes + ≤4 inserts,
   `position === index`, concepts/definitions arrays stay index-aligned (DB M2).
4. ✦ `serializeContent` golden key list — exactly the 17 persisted fields;
   fails when someone adds a `State` field without deciding persistence (M1).
5. `saveLocalHouse`/`loadLocalHouse` round-trip + legacy shapes (`string[]`
   concepts, pre-detail perspectives) normalize via `toConcepts`/`toPerspectives`.

Reducer & draft gate (guards the workspace's core invariants):
6. ✦ `APPLY_DRAFT_STAGE` stage guard: mismatched stage no-ops identically
   (`state.ts:383`) — the idempotence the runner depends on.
7. `APPLY_DRAFT_STAGE` advances stage; `drafted[stage]` true iff ≥1 action
   applied; zero-action stage still advances with `drafted=false`.
8. `CLAIM_DRAFT_LAYER` rejects undrafted/already-claimed; final claim after
   `stage==='done'` settles (`unclaimedDraftStages` empty).
9. ✦ `draftGateLocked` truth table: null / mid-run / done+unclaimed /
   done+claimed; PUBLISH and EXPORT return only a toast while locked.
10. Reducer purity sweep: deep-`Object.freeze` the input state, run every
    action type once, assert no throw — catches any `suggestions.ts`-style
    in-place mutation forever (M3).
11. `REMOVE_PERSPECTIVE` clears matching `activePerspective`; `GO_STEP` clamps
    to 1–7; `nextId` after remove-max documents id reuse (L1 canary).
12. `applyAiAction` provenance: evidence → `owner:'ai', byAI:true`;
    perspective/assumption → `owner:'ai'`; `add_subquestion` to an unknown
    perspective returns `null` and changes nothing.

Strength & status (cheap, wide blast radius on dashboard badges):
13. `computeStrength` cases: empty house floors (14/22/4), caps at 100,
    overall rounding; pins current behavior before deciding B6.
14. `layerDone` thresholds per layer + `doneCount`; `deriveStatus`:
    empty / title-only → in-progress / all-7 → complete (DB M6 depends on it).

Router failover (the most intricate untested logic in the repo; ✦ as a block):
15. ✦ 429 on primary cascades to next target in lane order per role
    (suggestor: cerebras→mistral→groq→gemini); success stops the walk.
16. ✦ Groq 429 opens the penalty box: next `realtimeAttempts()` skips Groq for
    30s (fake timers), then returns on `gpt-oss-20b` until one success clears
    `groqRecovering`.
17. ✦ Daily-quota 429 arms the airbag; OpenRouter is attempted only when
    `dailyLimitsExhausted()` — a plain 429 chain without daily never reaches it.
18. ✦ Non-429 (401/500/network) throws immediately mid-chain — no cascade.
19. Size-aware skip: `neededTokens` > window skips to Gemini; everything
    skipped → 413 `ai-context-overflow`; overflow error escalates not throws.
20. `completeJSON` self-correction: invalid first reply → retry prompt carries
    the zod error → valid second reply parses; two failures → 502
    `ai-invalid-output`.
21. `reasoningEffortFor` matrix (gpt-oss / qwen non-coder / coder / others) —
    a wrong value is a hard 400 in production (router.ts:632-643).

Hook layer (needs happy-dom; do last):
22. `useDraftRunner` machine via `renderHook` + injected fetch: start seeds
    START_DRAFT and fires stage 1; response dispatches APPLY_DRAFT_STAGE;
    pause aborts (no dispatch); error sets `errorCode` and stops the loop.

## Phase 2 — architecture consolidation (post-gate)

1. **Shared authed-page scaffold** — H4 (M): one `useAuthedPage({require})`
   hook returning `{user, accountType, caps, signOut}` + a `<CenterNotice>`;
   migrate the 4 profile-fetch pages and 9 `handleSignOut` copies onto it.
   This is also where the session-expiry listener (Phase 0 §1) lives once.
2. **RSC opportunistically, not big-bang** — H4/perf-H2 (M per page): convert
   dashboard and classroom list pages to Server Components with client
   islands when next touched; keep the Build workspace client-side (it is a
   local-first editor; server-render only its shell/initial state later).
3. **Undo stack** — M2 (M): bounded history of `serializeContent` snapshots in
   `BuildHousePage` (the partition already exists), Ctrl+Z + a toast "Undo"
   affordance after every REMOVE_*.
4. **Hoist interview/suggestion state** — M4 (S): move `InterviewCard`
   transcript and the co-pilot cache up beside `useDraftRunner` so the mobile
   drawer stops destroying them; memoize the per-render `serializeContent`.

## Phase 3 — debt retirement (S each unless noted)

| Debt | Action |
|---|---|
| D1 | Delete `ACCEPT_SUGGESTION` case, `suggestions.ts`, `accepted` writes; DB column drop rides the DB plan |
| D2 | Delete `components/build/rail/TeamPanel.tsx` |
| D3 | Rename 7 imports `@/lib/ai/groq` → `@/lib/ai/router`; delete shim; drop `groq-sdk` (ops M2) |
| D4 | Product call on `/house`: promote to `/try` full builder (M, with signup carry) or delete route + local adapter |
| D5 | Hide Invite/Team affordances (with ux 1.2/1.3 work); decide `house_collaborators` at collab time |
| D7 | Perspective strength: derive from content counts (S) or remove bar/numeral (S) — decide, don't leave 0s |
| D8–D10 | CSS freeze note in the responsive files' headers; rename reducer `draft` locals; 15-min doc pass (file-structure routes, `/house` header, persistence "single-tab" comment) |

## Sequencing summary

Week 1 (all Gate): Phase 0 §1–§5 + vitest setup + tests 1–4, 6, 9.
Week 2: remaining ✦ tests (15–18), Phase 0 §6, Phase 2 §1.
Then: Phase 2 §2–§4 opportunistically; Phase 3 as touch-time cleanups.
Total gate-critical effort: ~4–5 focused days, all S/M items — no L item is
required before a pilot.
