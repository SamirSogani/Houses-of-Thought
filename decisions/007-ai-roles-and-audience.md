# Decision 007 — AI roles, audience, and the Learn/Decide posture

**Date:** 2026-07-07
**Status:** Direction set (no wiring yet — informs how the Groq co-pilot is built)
**Amended (2026-07-16):** [decision 016](016-draft-mode.md) opens a claim-gated
Draft flow for full-posture accounts; the conclusion stays human-only in every mode.

## Context

Decision 006 picked the model (GPT-OSS on Groq). This decides *what the AI is
for* before any of it is wired. The trigger was a broader question: is Houses of
Thought a classroom tool, or a decision-making tool for anyone?

The answer that resolves it: the 7-layer house (Concepts → Perspectives →
Evidence → Assumptions → Conclusion → Implications → Strength) is a
**general-purpose reasoning framework**, not a school feature. The framework is
already audience-agnostic — the seeded example houses are a monorepo migration
and a school AI-adoption policy ([lib/examples/data.ts](../lib/examples/data.ts)),
both adult decisions. Only the surrounding packaging is classroom-specific.

## The governing principle

The real design variable is **how much of the thinking the AI is allowed to do**,
and that is set by *who it is for* — not by the feature list. The AI's posture
runs along a dial:

`Mirror → Coach → Sparring partner → Co-analyst → Author`
(you do the thinking) ————————————→ (AI does the work)

- **Author is off-limits as real output.** If the AI builds the student's (or
  user's) house, the reasoning it exists to teach/produce evaporates. Author is
  reserved for *labeled worked examples / strawmen to critique* only. See 006 /
  005 §4.

## Decisions made

### 1. One engine, gated by a Learn/Decide mode
- **Choice:** Build the reasoning engine and AI roles **audience-agnostic**, and
  expose a single **`Learn` vs `Decide`** mode that swings the posture dial and
  gates which capabilities are unlocked. Do **not** fork the product per segment.
- **Reasoning:** The engine is shared; only posture differs. A mode toggle keeps
  one codebase serving students, individuals, and teams.

### 2. Posture by audience
| Audience | Goal | Posture | Mode |
|---|---|---|---|
| **Students** | the *skill* | Coach — Socratic, withholding, never authors | Learn |
| **Individual deciding** | a decision they trust | Sparring / Co-analyst | Decide |
| **Teams / pros** | rigor + defensible artifact + buy-in | Co-analyst + facilitator | Decide |
| **Teachers** | assess & unstick students | Rubric critic (second-order user) | Learn |

### 3. Classrooms are the wedge, not the ceiling
- **Choice:** Lead with classrooms; treat "anyone making a hard decision" as the
  actual market.
- **Reasoning:** Schools are a high-trust beachhead, and the Coach constraint
  forces the hardest/best version of the AI — one that helps without doing the
  work. The framework already travels beyond students.

## Capability map (per reasoning layer)

Marked **L** (safe in Learn/Coach mode) / **D** (unlocked in Decide mode).

- **Framing** — interview for the *real* question (L+D); detect decision type &
  calibrate rigor (L+D); split compound questions (L+D).
- **Perspectives** — surface missing stakeholders (L+D, current); roleplay a
  perspective to interrogate (L+D); steelman the opposition (D).
- **Evidence** — Research Mode with cited sources (D); rate quality / flag
  single-source dependence (L+D); name missing evidence (L+D).
- **Assumptions** *(highest value — humans can't self-detect these)* — surface
  hidden assumptions (L+D); flag load-bearing ones (L+D); "what would have to be
  true?" (L+D).
- **Reasoning/conclusion** — check the conclusion follows (L+D); bias & fallacy
  detection (L+D).
- **Implications** — second-order effects, pre-mortem (L+D); who bears the
  downside (L+D).
- **Review / House Strength** — Socratic critic: score vs Paul–Elder standards,
  attack the weakest link, compare to an exemplar (L+D).

### Cross-cutting (often the most valuable)
- **Blind-spot sweep** across the whole house — killer feature for individuals.
- **"What are you avoiding?"** — motivated-reasoning detection on personal calls.
- **Compare two houses** — Option A vs B, strength side by side.
- **Translate to an output** — decision memo / conversation script / action plan
  (for teams, this *is* the RFC).
- **Longitudinal loop** — revisit a past house ("you assumed X — did it hold?");
  retention hook and the deepest learning payoff.

## Build sequence

1. **Interviewer** — context intake → a `context` object on `State`, feeding all
   downstream calls (the foundation; makes suggestions specific, not canned).
2. **Socratic critic** at House Strength.
3. **Blind-spot sweep.**
4. **Decide-mode generative help** — research, roleplay, compare, memo export.

Throughout: "AI builds a house" stays labeled examples / strawmen only.

## Deferred / open

- UI surface for the `Learn`/`Decide` toggle and where mode is stored on `State`.
- Whether teams get a distinct facilitator surface or reuse Decide mode.
- How the longitudinal loop persists and re-engages users over time.
