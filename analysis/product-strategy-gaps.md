# Product Strategy Gap Analysis

**Auditor:** product-strategy analyst (subagent) · **Date:** 2026-07-16
**Evidence base:** context/vision/product-strategy.md feature table verified against code;
builds on audits/ux-review.md and audits/content-consistency-review.md (not re-litigated).

## 1. Strategy ↔ Implementation Gap Map

Ratings: **Real** (works as marketed) · **Partial** (works, but materially narrower than the claim)
· **Facade** (UI asserts success for something that doesn't happen) · **Absent**.

| Feature (strategy status) | Verdict | Evidence |
|---|---|---|
| House Builder — "12-layer" (Core) | **Real, but 7 layers** | Full reducer + normalized persistence (`lib/build/state.ts`, `lib/build/persistence.ts`, decision 002). But it is 7 layers, not the marketed 12 (`context/framework/trapasso-model.md`): Purpose is a Frame field, Sub-Questions live under Perspectives, Personal POV / Logical Inference / Sub-Conclusions have no layer. Strategy table's "12-layer" is wrong on its face. |
| Collab (Core) | **Partial** | The human+AI half (decision 001 §2's actual definition) is real: interview, per-layer Socratic suggestions, critic, research — all wired (`app/api/ai/*`, `components/build/rail/*`). The human-collab half is a facade: hardcoded "Maya R."/"Devan K." with fabricated presence and activity (`lib/build/people.ts`), inert Invite, no `house_collaborators` feature (decision 003 = DB foundation only). |
| Research Mode (Core) | **Real** | Brave-grounded, same-request URL allowlist, "anything else is dropped" (`app/api/ai/research/route.ts`, `lib/ai/brave.ts`). The anti-hallucination claim is genuinely enforced, not just prompted. |
| Logic Strength (Core) | **Partial** | `lib/build/strength.ts` `computeStrength` is pure item-counting: evidence = `count*18+14`, logic = `assumptions*7 + implications*2 + 22`, coverage = `perspectives*11+4`. The "Logic" axis never reads the conclusion, reasoning, or any text. Marketed as "quantified reasoning quality" / "how sound the inferential chain" — it measures quantity. Five junk evidence items max the Evidence axis; students will discover this. |
| Stress Test (Core) | **Absent as named; Partial by proxy** | "Stress Test" exists only in marketing copy (`components/sections/*`, grep confirms). The nearest real feature is the Review critic (`CRITIQUE_BLOCK` → weakestLink in `CritiqueSection.tsx`) — real and good, but a one-shot report card, not the marketed adversarial "attack mode," and never labeled Stress Test in-product. |
| Classrooms (Core) | **Real** | Classes + join codes, roster RPC, teacher read-only via RLS, assignments (due dates, courses, lazy house seeding), strawman exercise, turn-in, grade + feedback (`submission_feedback`). Verified E2E against live Supabase (decision 011). The deepest, most honest part of the product. |
| Student mode (Core) | **Real** | `lib/auth/capabilities.ts` pins students to Learn/coach, `canAuthorDraft:false`; clamped server-side in `/api/ai/suggest` and `/api/ai/draft`. Quotable to teachers. (Marketing *undersells* it — "assistant off" is false; it's Socratic-on.) |
| Personal Foundational POV (Exists) | **Partial** | Four POV textareas persist to `profiles` (`components/profile/ProfileForm.tsx`). But nothing reads them — not the AI serializer (`lib/ai/serialize.ts`), not any house surface. The model's promised purpose ("surfaces blind spots", trapasso-model.md) is unimplemented. Stored, inert. |
| Publish / Export (Exists) | **Facade** | `state.ts` PUBLISH/EXPORT return success toasts ("House published", "Exported as PDF") and do nothing. Decision 016 added a real claim-gate *in front of* these fake buttons — real teeth guarding a door painted on a wall. Strategy doc itself lists these under "Why create an account." |

**Core-column scorecard: 4 of 7 Real (~57%); 2 Partial; 1 Absent-as-named.** Weighted by how
much of each claim survives contact with code, roughly 70–75% of the marketed core works. The
two failures are both **trust-signal numbers** (strength-as-quality, stress test) — the worst
place for a "defensible reasoning" product to be soft.

## 2. Positioning coherence: "AI won't write your conclusion" vs Draft Mode

**The ban is genuinely enforced, in three layers — this is the strongest thing in the codebase:**
1. Prompt: `PERSONA` hard rule (`lib/ai/prompts.ts:11`), composed into every co-pilot route.
2. Type system: `AiActionSchema` (`lib/ai/findings.ts:37-40`) is a discriminated union that
   *cannot express* setting conclusion/reasoning/question/purpose. Not just prompted — unrepresentable.
3. Server clamps: students can never reach author output (`capabilities.ts` + route checks).

**Draft Mode (016) — the line holds literally, but it moved.** Option B keeps invariant 1
verbatim: the draft route has no conclusion stage and composes with PERSONA (unlike the
strawman). "The AI never writes your conclusion" stays true. But the positioning was "build the
reasoning"; for standard accounts the canonical flow is now "watch the AI build ~5 of 7 layers,
click Claim per layer, then write the verdict." Weak points, in order:
- **The claim pass is a click-through.** 016 §Deferred admits it may be "too shallow." No edit
  is required before claiming. If claim-rate-without-edit is high, Draft Mode *is* the removed
  answer machine minus the last paragraph. This is measurable (see instrumentation) — measure it
  before a teacher ever sees Draft Mode marketing.
- **The gate's teeth bite a facade.** The publish/export lock (state.ts:458-467) is real logic
  guarding fake buttons. The only live consequences are the provisional-strength badge and
  student exclusion (moot — students never get Draft Mode).
- **The front door already authors.** `MINI_HOUSE_SYSTEM` writes a `final_take` (3–5 sentence
  synthesis) for every `/try` visitor — the closest thing to a chatbot answer in the product, on
  the exact surface where teachers evaluate the "won't answer" promise. "Illuminate, never
  decide" is a defensible reading, but it is a judgment call sitting on the funnel's first step.

**Where else code undercuts the positioning:** fake publish/export/invite success toasts and
fabricated collaborators (a rigor product confirming actions that never happened); a strength
score gameable by count-padding; "Stress Test" sold but unshipped; POV stored but never used.
Verdict: the philosophy is defensible and unusually well-engineered at the AI boundary; the
credibility risk is everywhere *except* the AI boundary.

## 3. Competitive context (analyst knowledge; no web search)

- **"AI that won't just answer" is commoditized.** Khanmigo's Socratic tutor mode has district
  distribution; ChatGPT Study Mode, Anthropic's Learning Mode (Claude for Education), and
  Google LearnLM guided-learning all shipped "guide, don't answer" modes in 2025. Refusal alone
  is no longer a moat — it's a toggle in every general assistant.
- **Teacher-workflow wrappers** (MagicSchool, SchoolAI, Brisk) own the K-12 AI channel:
  SSO, LMS sync, admin dashboards, signed DPAs. They compete on distribution, not pedagogy —
  and they have everything this repo lacks (see pilot-readiness-plan.md).
- **Structure-first tools:** Kialo Edu (free argument mapping with classes — closest analog,
  no AI scaffolding, no scoring), legacy Rationale/ThinkerAnalytix, Packback (Socratic
  discussion + "curiosity scores," higher-ed; overlaps the "gradeable thinking" claim).
- **What the code suggests is genuinely differentiated:** (a) the reasoning as a *gradeable
  layered artifact* rather than a chat transcript; (b) **provenance** — `owner: 'ai'`,
  `unreviewed` flags, per-layer claim gates. Nobody else tracks who authored each brick of the
  reasoning; in a 2026 classroom that is the AI-integrity feature teachers are begging for.
  (c) the strawman exercise (teacher-authored flawed house to attack) — real, shipped, unusual.
- **Implication:** lead with the artifact + provenance + strawman, not with refusal. Refusal is
  the floor; auditability of the thinking is the differentiator the code actually supports.

## 4. Docs/decisions drift (beyond content-consistency-review)

1. **product-strategy.md feature table is the drift.** "12-layer" (product: 7), "Publish/Export
   — Exists" (facade per ToS §7 itself), "Stress Test — Core" (absent), "Collab … canonical
   builder UX" (its multi-user half is fake). The strategy doc needs a truth pass against §1 above.
2. **tech-stack.md asserts unbuilt architecture as fact:** "on account creation the local house
   is imported into the Supabase-backed account" — no migration path exists (only the orphaned
   `/house` page reads `LOCAL_HOUSE_KEY`). Same claim in decision 001 §6.
3. **trapasso-model.md** still names the score "Logic Strength" (canonical: House Strength) and
   promises POV "surfaces blind spots" (unimplemented; decision 007's blind-spot sweep unbuilt).
4. **audits/ux-review.md §9.1 is stale:** commits `2f643b1`/`f904ac3` shipped mobile builder
   support (`useIsMobile`, `MobileStepStrip`) after the review; the audit still reports the
   funnel dead-ending on mobile. Annotate it or re-verify, or the audit misdirects planning.
5. **Decision numbering collision:** two 013s (`013-multi-provider-routing.md`,
   `013-standardize-on-pnpm.md`) — 17 files, 16 numbers.
6. **Decision 016 / draft-mode plan phase 0 is still open:** migrations 0010/0011/0022 not
   applied live; `lib/ai/limits.ts` **fails open** (limits.ts:112,120). Draft Mode (~6 model
   calls + Brave per run) is deployed-uncapped risk until applied — 016 itself says it "must
   not ship uncapped."
7. **`/welcome` "verified working" (tech-stack.md) vs shipped "Placeholder" eyebrow** — the doc
   describes auth as done while the first post-auth screen is scaffolding.
