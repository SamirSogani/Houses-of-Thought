# Decision 018 — House Chat conclusion candidates (admin-only Author extension)

**Date:** 2026-07-18
**Status:** Decided & implemented 2026-07-18; verified end-to-end by the
operator 2026-07-20 (toggle on → candidates rendered, disagreed, and Adopt
wrote the conclusion + reasoning and landed the implications).
**Amends:** [016](016-draft-mode.md) §1 ("the AI drafts materials, never the
verdict") and [007](007-ai-roles-and-audience.md)'s Author boundary — **for the
House Chat admin surface only, per-question opt-in**. Everywhere else,
invariant 1 stands verbatim.

## Context

Operator request: a toggle in House Chat ([017](017-house-chat-admin-beta.md))
letting the admin choose whether the AI drafts the conclusion. Requirements:
the conclusion must weigh **every datapoint in the house**, and the output must
be **multiple conclusions, not one**, each with its own trailing implications.

This collides head-on with the brand promise ("the AI never writes your
conclusion"). The strawman (010 §6) set the precedent for a fenced exception;
this is the second, and it is fenced harder.

## Decisions made

### 1. Plural candidates, human adoption — never a single verdict
- `POST /api/admin/chat-conclusions` returns **2–4 candidates that must
  genuinely disagree** (schema-enforced minimum of 2; a lone verdict fails the
  parse). Each carries: `conclusion`, `reasoning` citing the house's own text,
  `basis` (3–8 named datapoints doing the load-bearing work), and 2–4
  `implications` (pos/neg/unc, who, horizon) that follow *if adopted*.
- Nothing lands in the house until the admin clicks **Adopt** on one card —
  a composition of existing reducer actions (`SET_CONCLUSION`,
  `SET_REASONING`, `APPLY_AI_ACTION` × `add_implication`), so the candidate's
  implications get the standard AI provenance marks. One-shot; switching
  verdicts afterwards is builder editing.

### 2. The capability is fenced, not generalized
- Self-contained prompt (`CHAT_CONCLUSIONS_SYSTEM`), NOT composed with
  `PERSONA` — the strawman pattern — because PERSONA forbids conclusion text.
- The shared `AiActionSchema` still cannot express a conclusion; no public
  route, no other surface, and no non-admin account gains this. The route 403s
  non-admins **before** spending quota.
- The toggle is per-question, default **off**, sticky across questions,
  captured at build start (flipping it mid-build changes nothing running).

### 3. Sequencing and quota
- Candidates are fetched once, after the five material stages settle and only
  when something was drafted (no datapoints → nothing to conclude from). The
  composer stays locked until the fetch settles, preserving 017's serial-lane
  guarantee. Cost when toggled: +1 drafter-lane call per question.
- Candidates are ephemeral component state — the transcript itself is
  ephemeral, so persisting them buys nothing; only an adopted conclusion
  persists, via ordinary autosave.

## Consequences

- New: `app/api/admin/chat-conclusions/route.ts`, `ConclusionCandidateSchema` /
  `ChatConclusionsResponseSchema` in `lib/ai/chat.ts` (+ tests),
  `CHAT_CONCLUSIONS_SYSTEM`, candidates UI + Adopt in `ChatBuildCard`, the
  composer toggle in `HouseChat`.
- The marketing line "the AI never writes your conclusion" now carries an
  operator-only asterisk. If this graduates beyond admin, that copy — and
  probably the claim gate — must be revisited first.

## Deferred / open

- Prose provenance: adopted conclusions carry no owner mark (prose fields have
  none anywhere); a `draft.adoptedConclusion` marker is the natural follow-up.
- A claim-style review gate on adopted conclusions before publish.
- Showing unadopted candidates inside the builder later (they die with the
  chat transcript today).
