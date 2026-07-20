# Analysis — Full-Repo Deep Audit (2026-07-16)

Read-only analysis of the whole product: what could fail, what it costs to
run, and what must change before real classrooms depend on it. Security was
explicitly out of scope across all documents. This folder complements — and
never repeats — the earlier surface audits in [`audits/`](../audits/)
(accessibility, UX, performance, code quality, content consistency) and the
draft legal docs in [`legal/`](../legal/).

Finding IDs below are prefixed by file: **db-** database, **ops-** operations,
**ai-** AI subsystem, **fe-** frontend architecture, **bl-** business logic,
plus **cq/ux/perf/a11y/content-** for the `audits/` files.

## Document map

| Report | Plan | Domain, in one line |
|---|---|---|
| [database-and-data-model.md](database-and-data-model.md) | [plan](database-and-data-model-plan.md) | Schema, integrity, migrations, growth math — non-atomic autosave, unfiltered dashboard query, get-or-create races |
| [operations-and-delivery.md](operations-and-delivery.md) | [plan](operations-and-delivery-plan.md) | Delivery pipeline — no backups, no CI, no alerting, hand-pasted migrations; $0/mo fix path |
| [ai-subsystem.md](ai-subsystem.md) | [plan](ai-subsystem-plan.md) | Router resilience + unit economics — cookieless anon bypasses caps, non-429s kill healthy failover, full cost model (~$0.04/student/assignment) |
| [frontend-architecture.md](frontend-architecture.md) | [plan](frontend-architecture-plan.md) | Client state & save protocol — last-writer-wins overwrites, interleaved saves, dead metrics, debt register, first-tests strategy |
| [business-logic-edge-cases.md](business-logic-edge-cases.md) | [plan](business-logic-edge-cases-plan.md) | Flow correctness — due dates a day early, read-only that isn't, unreviewed strawman release, gradeable-then-editable turn-in |
| [product-strategy-gaps.md](product-strategy-gaps.md) | — | Marketing vs code scorecard (4/7 core claims real), Draft-Mode positioning risk, competitive context |
| [pilot-readiness-plan.md](pilot-readiness-plan.md) | (is a plan) | What one real teacher needs vs what exists; phased path + the 10 instrumentation events |

## The one-paragraph verdict

The classroom spine (roster → assignment → strawman → turn-in → feedback) is
real and was verified end-to-end, and the AI boundary is genuinely
well-engineered — the "AI never writes your conclusion" invariant is enforced
in the type system, not just prompts. The risk is concentrated elsewhere, in
four clusters: **(1) durability** — there are zero database backups and the
autosave path can silently destroy or revert work through at least five
distinct mechanisms; **(2) honesty** — fake success states, fabricated
collaborators, and marketing claims the legal docs refused to make will burn
teacher trust faster than any bug; **(3) operations** — every push deploys
straight to production with no gate, no error tracking, and a rate limiter
that fails open while the most expensive AI call sits on an unauthenticated
page; **(4) classroom-boundary correctness** — due dates render a day early,
students can edit graded work invisibly, strawmen release before review, and
the student AI clamp binds to a self-selected label. None of it is
research-hard; nearly all of it is finishing and honesty, ≈3 solo weeks for
the full pre-pilot gate.

## Cross-domain priorities

### P0 — this week, regardless of pilot timing (~2 days)
1. **Take a `pg_dump` of production today; stand up nightly backups** —
   ops-C1. The only product-ending risk in the ledger: classroom data has
   zero copies. Workflow sketch is in the ops plan.
2. **Verify migrations 0010/0011/0022 are applied live and the AI limiter
   actually closes; add the IP-keyed anonymous ceiling** — ai-0.1/0.2
   (ai-C1, ops-M3, strategy §4.6). Until then every cap is advisory.
3. **CI gate + branch protection + Sentry + `/api/health` + uptime monitor** —
   ops-C2/H1. Everything after this lands safer, and breakage stops being
   invisible. All free.

### P1 — the pre-pilot gate (~3 solo weeks; union of the five plans' Gates)
- **Make saving trustworthy** (the cluster with the most independent failure
  modes): transactional `save_house` RPC (db-H1) + error-checked writes with
  save-status UI (cq-B1/B2, fe-§1) + single-flight queue (fe-C2) + rev token
  (fe-C1) + flush on `visibilitychange`/pre-sign-out (fe-H1) + `loadHouse`
  null-on-child-error (cq-B2).
- **Classroom correctness**: dashboard owner filter (db-C1 — teacher-visible
  on day one), local end-of-day due dates (bl-C1), enforce read-only at the
  dispatch seam (bl-C2), strawman release gate (bl-H1), turn-in
  lock + timestamp + late marker (bl-H2), unique submission index (db-H3),
  protect graded work from delete (db-H2) and edit (bl-H2).
- **Trust the clamp**: bind student posture to assignment linkage, not
  self-selected type (bl-H5); fail closed on capability lookup (bl-M5);
  roster shows account types.
- **Router resilience & cost**: cascade on 5xx/timeout (ai-C2), per-attempt
  latency budgets (ai-H1), cap Gemini thinking spend (ai-H2, ~50–70% of
  drafter cost), Brave paid tier + draft-stage degradation (ai-H3),
  draft-gate escape hatch (fe-H2).
- **Stop selling what doesn't exist** (subtraction, ~2–3 days): fix/remove
  fake publish/export/invite/presence (ux-1.2/1.3), dead CTAs incl. the
  educators-page 404 (ux-1.1), untrue claims (content-C3/C4/C5, H1–H3),
  "Placeholder" welcome page (ux-1.4), dead `Perspective.strength` bar (fe-H3).
- **Procurement floor**: fill legal placeholders; ship `/terms`, `/privacy`,
  `/contact` + one real support address (content-C1/C2); age gate + ToS
  acceptance at signup; a working account-deletion path (db-H4 + the stub
  modal); migration workflow via Supabase CLI (db-C2, ops-H2).

### P2 — during the pilot
- **The teacher loop**: real PDF export (the gradeable artifact — pilot plan
  calls it the single highest-leverage feature), rubric surfacing from the
  critic's six standards, assignment edit/delete, remove-student/reset-code,
  feedback attribution (bl-M4).
- **Instrumentation**: the 10 events in pilot-readiness §3 — especially
  `draft_layer_claimed(edited_before_claim)`, the metric that answers whether
  Draft Mode is scaffolding or an answer machine (strategy §2).
- **Tests**: vitest + the ranked first-22 (fe-plan Phase 1); router failover
  block must land with the ai-plan Phase-0 semantic changes (ai-3.2).
- **Accessibility floor**: global `:focus-visible` + text-safe color tokens
  (a11y #1/#2 — two fixes covering ~45 call sites), then modal traps and live
  regions.
- **Performance quick wins**: un-hide the marketing LCP (perf-H4), shrink the
  middleware matcher (perf-H1), split zod out of `/try` (perf-H3).
- **Cost dashboard**: usage + Brave counters on the admin monitor (ai-1.4);
  suggest-call intent gate (ai-M3).

### P3 — opportunistic
Debt register retirement (fe-D1…D10: zombie suggestion subsystem, groq shim,
orphaned `/house`, fake personas), shared authed-page scaffold then
per-page RSC (fe-H4, perf-H2), undo stack (fe-M2), CSS retrofit containment
(fe-M5), schema robustness (ai-H4, ai-M1), `ai_usage` pruning (db-L1),
strategy-doc truth pass and decision-numbering fix (strategy §4).

## Cost of running it (from the AI cost model)

Legitimate usage is cheap: ≈ **$0.04 per student per assignment**, ≈ $1.20
per 30-student class period, ≈ **$480–1,920/yr** for a 600-student pilot
year, plus ~$120/yr Brave paid tier and one $25/mo Supabase Pro decision when
the first real school onboards. The binding constraints are free-tier
*quotas* (Gemini RPD, Brave 2k/mo — one classroom period of research bursts
past it) and the unmetered-anonymous hole, not dollars.

## Provenance

`audits/` and `legal/` predate this analysis (earlier sessions). The prior
session of this commission produced the database, operations, pilot-readiness,
and product-strategy documents; this session added the AI-subsystem,
frontend-architecture, and business-logic pairs (three parallel deep-dive
agents, each cross-checked against the code) and this index. The
ux-review's mobile finding §9.1 predates the mobile retrofit (commits
`2f643b1`/`f904ac3`) and is stale; everything else was current as of
2026-07-16 on `main` @ `0d606e3`.
