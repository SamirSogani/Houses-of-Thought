# 02 — Data contracts (handoff packets)

Structured, never prose — a fresh-session agent's entire world model of prior
work is the packet it's handed. `ReviewPanelVerdict` is the generic shape
reused at every nine-standard gate (see [01](01-layers-and-standards.md) and
[decision 019 §3](../../../decisions/019-multi-agent-reasoning-pipeline.md)
for why it isn't called `CriticPanelVerdict`).

```
ContextGatherVerdict
  { needs_user_input: bool, questions_for_user[], reason }

FramePacket
  { original_query, core_question, definitions[], purpose, scope_notes }

BreadthScopingPacket
  { n, rationale, candidate_viewpoint_labels[] }

PerspectiveBundle
  { perspective_id, stance_label, stance_summary, key_claims[],
    sub_questions[], assumptions[],
    evidence[] { claim_id, source_ref, confidence, caveats },
    counterargument { authored_by_session, target_claims[], rebuttals[] } }

ReviewPanelVerdict            // reused at every 9-standard gate
  { subject_id,
    standards: { clarity, accuracy, precision, relevance, depth, breadth,
                 logic, significance, fairness },  // each { pass, notes }
    overall_pass, degraded }

GlobalAssumptionsPacket
  { question_level_assumptions[], cross_perspective_notes }

GlobalEvidencePacket
  { question_level_evidence[] { claim_id, source_ref, confidence } }

ConclusionsPacket
  { conclusions[], supporting_chain[] }

ImplicationsPacket
  { implications[], confidence, caveats_from_degraded_layers[] }

FinalAnswer
  // composed from FramePacket.core_question + ImplicationsPacket,
  // with a caveats section for anything that hit degraded: true
```

## Evidence generation's intermediate contracts (2026-08-13, Samir's redesign)

`PerspectiveBundle.evidence[]` and `GlobalEvidencePacket` above are the
**final** shapes — unchanged. How they get populated changed: each is now
built across 3 phases (strategy → populate → confidence, see
[01](01-layers-and-standards.md) and
[24-evidence-redesign-and-failure-tracking.md](24-evidence-redesign-and-failure-tracking.md)),
each with its own intermediate contract that never reaches the client's
final answer:

```
EvidenceStrategy              // strategy phase's only output
  { search_queries[] (max 3), needs_user_input, questions_for_user[], reason }

EvidenceGatherUnit             // aggregated for the client's pause UI when
  { unitId, unitLabel, reason, questions[] }   // any strategy unit asked

EvidenceItemDraft              // populate phase's output — no confidence yet
  { claim_id, source_ref, caveats }            // (per-perspective)
GlobalEvidenceItemDraft
  { claim_id, source_ref }                     // (global — no caveats field)

PerspectivePartialBundle       // PerspectiveBundle minus `evidence` — what
  // = PerspectiveBundle.omit({ evidence: true })   the details fan-out
                                                     // (sub_questions/
                                                     // assumptions/
                                                     // counterargument)
                                                     // produces before
                                                     // evidence is merged in
```

`EvidenceGatherUnitAnswers` (`(string | null)[]`, max 3) is the admin's
answers to one unit's questions, index-aligned with that unit's
`questions[]`; `null` means that question was skipped.

## Sub-element failure tracking (2026-08-13)

```
SubElementFailure
  { perspectiveId, stanceLabel, subElement, errorMessage }

PERSPECTIVE_SUB_ELEMENTS = [
  'sub_questions', 'assumptions', 'counterargument',
  'evidence_strategy', 'evidence_populate', 'evidence_confidence',
]
```

Every perspectives fan-out step (details, evidence-strategy, -populate,
-confidence) now uses `Promise.allSettled` instead of `Promise.all` and
collects a `SubElementFailure[]` for every rejected sub-element across every
perspective, instead of surfacing only the first rejection — see
[24-evidence-redesign-and-failure-tracking.md](24-evidence-redesign-and-failure-tracking.md)
for why (Vercel Hobby's 1-hour log retention made root-causing a bare
"ai-empty-output" hard to pin to a specific perspective/sub-element after
the fact). `route.ts`'s error response carries this list back to the client
as `subElementFailures` whenever a `PerspectivesGenerateError` is thrown.

## Notes

- `overall_pass` on a `ReviewPanelVerdict` defaults to **all nine must pass**
  — the strictest reading of "nine standards, one panel per standard."
  Treat as a tunable threshold once real reviewer output shows whether that's
  too strict (e.g. requiring 8/9 with a mandatory note on the failing one) —
  see `panel_pass_threshold` in
  [03-orchestration-and-failure-handling.md](03-orchestration-and-failure-handling.md).
- `PerspectiveBundle.counterargument.authored_by_session` records which
  session wrote it, so a reviewer can confirm it wasn't the stance's own
  author (the independence requirement in [01](01-layers-and-standards.md)).
- `caveats_from_degraded_layers[]` on `ImplicationsPacket` and the caveats
  section on `FinalAnswer` are the only places a degraded perspective bundle
  surfaces downstream — everything else treats it as if it had passed.
