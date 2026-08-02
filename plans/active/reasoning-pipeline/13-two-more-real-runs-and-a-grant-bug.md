# 13 — Two more real runs: a real grant bug, and a real capacity ceiling (2026-08-02)

Written the same day as 12, continuing that session per its own "worth one or
two more real runs" note. **Code below is committed** — check `git log` if
that ever seems stale.

## Run 2 (n=3): clean, plus a real bug caught live

*"Should our school require students to wear uniforms?"* — completed fully
to final-composition, all six review gates 9/9 clean, zero regenerations —
same clean result as 12's run, now also confirmed at n=3's higher fan-out
(24 generators, peak ~27 concurrent). It also triggered context-gather's
`needs_user_input` path with real search findings, a second live
confirmation of that path (first verified in 11).

Mid-run, Groq hit its **daily** quota for real (not just per-minute) for the
first time this session. Its persist write failed:
`permission denied for table ai_daily_exhaustion` — a real bug in 0028's
migration, same root cause class as two prior fixes in this exact repo
(`0005_houses_grants.sql`, `0012_fix_ai_usage_execute_grant.sql`): RLS with
no policies only blocks rows from roles *without* `BYPASSRLS`; it doesn't by
itself grant a role table-level access, and this project's Supabase instance
doesn't auto-grant that to `service_role` for new tables. Non-fatal by
design — the run itself was unaffected, failover absorbed the rest cleanly —
but the cross-restart persistence 0028 exists for silently never wrote a
row. Fixed in
[0029_fix_ai_daily_exhaustion_grant.sql](../../../supabase/migrations/0029_fix_ai_daily_exhaustion_grant.sql)
(**not yet applied** — needs a manual paste into the Supabase SQL editor per
this repo's migration workflow, same as every migration here — see
[supabase/migrations/README.md](../../../supabase/migrations/README.md)).

## Run 3 (n=2): a real capacity ceiling, not a bug

*"Should our high school start the school day later, based on research on
teen sleep and academic performance?"* — Frame passed 9/9 clean, then hit a
real capacity wall. With Groq now daily-exhausted (from run 2, same UTC day)
skipped entirely, Gemini absorbed the full drafter load and started 429ing
itself; Cerebras — the drafter lane's last-resort target — received
concentrated concurrent load from many parallel calls at once and returned
schema-invalid JSON that failed both its own attempt and `completeJSON`'s
one built-in retry.

Confirmed this is **not a router bug**: the OpenRouter terminal airbag
(`router.ts`'s `laneDailyBlackout` check) is scoped to a *verified whole-lane
daily blackout* — only Groq's exhaustion was daily; Gemini's and Cerebras's
were ordinary per-minute rate-limits, which correctly keeps the airbag off
per its own documented rationale ("a single provider's daily limit... never
reaches here"). One client-side retry made it worse, not better — Gemini and
Cerebras were both fully rate-limited moments later, confirming a genuine,
temporary whole-lane capacity ceiling from this session's cumulative real
volume (3 real runs in quick succession, one at n=3), not a code defect.
Stopped rather than continuing to retry — matches 07/09/11's own established
precedent of not chasing a known capacity ceiling.

## Updated sample, and what's next

2 clean full runs (n=2, n=3) across three distinct questions now real-verify
Phase 1.5 holds under different question shapes and higher fan-out. The one
failed run is itself a useful data point for Phase 2's "dynamic budget
enforcement" item (e.g., detecting multi-provider concurrent stress and
shrinking `n` or widening the drafter stagger in response) — not a
pipeline-correctness bug.

Before more real testing: **apply 0029** (the grant fix) via the Supabase
dashboard, and let today's provider quotas cool down — this session alone
(4 real runs including the panel-oscillation work) burned through Groq's
daily cap and pushed Gemini/Cerebras into rate-limiting too.
