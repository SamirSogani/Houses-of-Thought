# Schools-Pilot Readiness Plan

**Companion to:** [product-strategy-gaps.md](product-strategy-gaps.md) · **Date:** 2026-07-16
Frame: what a single real teacher running one class through one assignment needs, vs what exists.
Effort: **S** ≤ 1 day · **M** = days · **L** = week(s). Solo founder assumed.

## 1. Pilot-readiness checklist

### Classroom mechanics
| Need | Status | Evidence |
|---|---|---|
| Create class, invite via join code/link | **Ready** | `app/classroom/page.tsx`, `join_class` RPC, `/join/[code]` |
| Roster with student work, read-only | **Ready** | `get_class_roster` RPC + `can_view_student_house` RLS (decisions 010/011, E2E-verified) |
| Assignments: pose question, due date, units | **Ready** | `assignments` + `courses`, lazy house seeding via `open_assignment` |
| Turn-in → grade → feedback loop | **Ready** | `houses.turned_in`, `submission_feedback`, teacher critic reuse |
| Student AI clamp (server-side) | **Ready** | `capabilities.ts` + route clamps; strongest trust asset — quotable |
| Strawman exercise | **Ready** | `/api/ai/strawman`, doubly gated, teacher review flow |
| Edit/delete assignment, rename/delete class | **Gap (M)** | Insert + reorder only (`AssignmentPanel.tsx`); a typo in a posed question is permanent |
| Remove a student / reset join code | **Gap (S–M)** | No affordance; a leaked code = uncontrolled roster forever |
| Join-success confirmation for students | **Gap (S)** | Silent redirect to dashboard (ux-review 2.5) |

### Trust, safety, procurement-shaped blockers (pilot-stalling level, not legal analysis)
| Need | Status | Evidence |
|---|---|---|
| Educator signup CTA that works | **Gap (S)** | `/signup?role=educator` → 404; the educators page's only primary CTA |
| Published /terms + /privacy + working contact | **Gap (S–M)** | Docs exist in `legal/` with `[CONTACT EMAIL]`/`[MINIMUM AGE]` placeholders; no routes; no contact channel anywhere (content review C1/C2). No teacher pilots a tool whose privacy link 404s |
| Age gate + ToS acceptance at signup | **Gap (M)** | `app/login/page.tsx` has neither; marketing promises "12+" and an under-12 teacher-managed path that doesn't exist (C3). COPPA-shaped stall for any grade ≤ 8 |
| Honest data claims | **Gap (S)** | "We don't train models on student data" shipped against Privacy's own TODO (C4) — one vendor-terms question from a district kills trust |
| Account deletion path | **Gap (M)** | Promised in Privacy §5/§8, unfulfillable (no contact, no self-serve delete) |
| Email confirmation / account hygiene | **Gap (S decision)** | Confirmation off (tech-stack.md): anyone can register any email. Acceptable for pilot only if acknowledged |
| Google SSO | **Gap (L)** | Password-only auth; many K-12 students can't create password accounts on unapproved tools. Near-blocker for real districts; workable for one friendly pilot class |
| LMS integration (Google Classroom/Canvas) | **Gap (L, deferrable)** | Zero mentions in repo. Table stakes for scale; a hand-held pilot can run on join codes |
| Admin/district console, DPA workflow | **Gap (deferrable)** | Not needed for teacher-level pilot; needed before any paid district conversation (~2028 per strategy — fine) |

### Teacher workflow quality
| Need | Status | Evidence |
|---|---|---|
| Get student work OUT (PDF/print for grading, evidence for colleagues) | **Gap (M)** | Export is a fake toast (`state.ts:465-467`). The wedge is "make thinking gradeable" — with no artifact leaving the app |
| Rubric-shaped assessment | **Gap (M)** | `submission_feedback` = one grade string + free text, while the critic already grades 6 Paul–Elder standards — the rubric exists and isn't surfaced as one |
| Teacher onboarding | **Gap (M)** | `/welcome` ships "Placeholder"; nav jargon ("Collab"); no guide, no seeded sample class |
| No fake UI in front of students | **Gap (S–M)** | Fake collaborators/presence, fake publish/invite in every real house (ux-review 1.2/1.3) — a student tells the teacher "it says invite sent" and the pilot's credibility is spent |
| Peer review (promised on educators page) | **Gap (L, cut the claim instead)** | Privacy §1.4 forbids it as-built; `house_collaborators` unwired (decision 003) |

## 2. Sequenced plan to a first credible teacher pilot

**Phase A — Stop selling what doesn't exist (S, ~2–3 days total).**
Fix `/signup?role=educator` → `/login?mode=signup` with teacher preselected; strip fake
collaborators/presence/invite/publish/export from real houses (or label "Preview"); delete
untrue claims (train-models, work-carries-over, peer review, "assistant off", under-12 path);
add join-success confirmation. Zero new features — this phase is subtraction.

**Phase B — Procurement-shaped floor (M, ~1 week).**
Fill legal placeholders, ship `/terms` `/privacy` `/contact` routes + one real support email;
age gate (13+) + ToS checkbox at signup; pick one deletion path (even mailto). Apply migrations
`0010/0011/0022` so AI limits stop failing open **before** Draft Mode meets real traffic.

**Phase C — Complete the teacher loop (M, ~1–2 weeks).**
Assignment/class edit + delete; remove-student + reset-code; **real PDF export of a house**
(single highest-leverage feature: it is the gradeable artifact, the parent-night handout, and
the teacher-to-colleague viral loop in one); rubric feedback surfacing the critic's six
standards next to the grade field.

**Phase D — Recruit and run the pilot (S build, L calendar).**
Seeded sample class + 10-minute teacher guide; instrument (below); run 1–3 friendly teachers on
join codes, founder-supported. Explicitly defer: SSO, LMS sync, peer review, districts.

**Phase E — Only if pilots bite (L).** Google SSO → Google Classroom roster import → then the
LMS conversation. Sequenced after evidence, not before.

## 3. Instrumentation: the 10 events that say whether the wedge works

Today only `@vercel/analytics` page-views exist (`app/layout.tsx`). Use `track()` custom events
or a small Supabase `events` table; either is an afternoon.

| # | Event (props) | Hook point | Question it answers |
|---|---|---|---|
| 1 | `mini_house_completed` (source) | `/api/ai/mini-house` success / `MiniHouseResult` mount | Is the teaser landing? (top-of-funnel) |
| 2 | `signup_completed` (role, from_try) | `app/login/page.tsx` post-signUp | Try→account conversion; teacher vs student mix |
| 3 | `house_created` (source: blank/draft/assignment) | insert sites in `dashboard`, `build`, `open_assignment` | Which entry path actually gets used |
| 4 | `layer_completed` (layer n) | `layerDone` transition during autosave (`persistence.ts`) | Where houses stall — the activation funnel inside the product |
| 5 | `conclusion_written` | first non-empty conclusion in reducer (`state.ts`) | The core value moment: did they finish the thinking |
| 6 | `ai_accepted` (kind: suggestion/research) | `applyAiAction` / Add-click in `CopilotPanel` | Is the scaffold useful or ignored |
| 7 | `draft_layer_claimed` (edited_before_claim: bool) | `CLAIM_DRAFT_LAYER` in `state.ts` + `useDraftRunner` | **The philosophy metric** — if edited_before_claim ≈ 0, Draft Mode is the answer machine (016's open question, answered with data) |
| 8 | `class_created` / `class_joined` | `classroom/page.tsx` insert; `/join/[code]` RPC success | Teacher activation; students-per-class = the viral k-factor the whole strategy bets on |
| 9 | `assignment_created` / `assignment_turned_in` | `AssignmentPanel`; turn-in toggle in `HouseCard` | Assignment completion rate — the wedge's core loop |
| 10 | `feedback_given` (has_grade) | `SubmissionFeedback` save | Did the teacher close the loop (retention predictor for the buyer) |

Derived wedge-health dashboard: teacher→students k-factor (8), assignment completion (9/3),
median deepest layer (4), conclusion rate (5/3), teacher week-2 return (any event, teacher role).

## 4. Verdict

The classroom spine (roster → assignment → strawman → turn-in → feedback, with a server-clamped
student AI) is real and E2E-verified — rare honesty for a repo this young. But a pilot today
would stall in week one on subtraction-level problems: a 404 on the educator CTA, privacy links
that don't resolve, placeholder legal text, no export, and fake success states in front of
students. Roughly 2–4 focused weeks (Phases A–C) separate today's build from a defensible
first pilot; none of it is research-hard, almost all of it is honesty and finishing.
