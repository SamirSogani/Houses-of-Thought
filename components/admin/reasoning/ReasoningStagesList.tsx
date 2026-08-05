'use client'

// Live checklist for the reasoning pipeline — extends ChatBuildCard's
// ordered-array done/current/pending render (decision 017) to the pipeline's
// 10 top-level layer rows (lib/ai/reasoning/steps.ts LAYER_GROUPS), with
// nested per-perspective sub-rows under Perspectives showing each bundle's
// review-panel outcome (pass / degraded).

import { CheckIcon } from '@/components/icons'
import { LAYER_GROUPS, STEP_LABELS, type StepId } from '@/lib/ai/reasoning/steps'
import { ReviewPanelVerdictPanel } from './ReviewPanelVerdictPanel'
import type {
  ContextGatherVerdict,
  AdHocContextGather,
  FramePacket,
  ReviewPanelVerdict,
  BreadthScopingPacket,
  PerspectiveStance,
  PerspectiveBundle,
  GlobalAssumptionsPacket,
  GlobalEvidencePacket,
  ConclusionsPacket,
  ImplicationsPacket,
  FinalAnswer,
} from '@/lib/ai/reasoning/contracts'

// Client-side mirror of the route's RunStateSchema (app/api/admin/reasoning/route.ts) —
// grows one field per step as the client merges each response's `patch` in.
export interface RunState {
  originalQuery: string
  contextGatherPre?: ContextGatherVerdict | null
  // Phase 3 item 1 (decision 019): the admin's answers to the checkpoint
  // above/below, same index alignment as questions_for_user; null entries are
  // skipped questions. See ReasoningPipelinePage.tsx for how these get filled.
  contextGatherPreAnswers?: (string | null)[] | null
  frame?: FramePacket | null
  frameVerdict?: ReviewPanelVerdict | null
  contextGatherPost?: ContextGatherVerdict | null
  contextGatherPostAnswers?: (string | null)[] | null
  breadthScoping?: BreadthScopingPacket | null
  // Admin-triggered, ad-hoc context-gather calls (Phase 3 item 1's larger
  // scope) — zero, one, or many, at whatever step the admin was paused on.
  adHocContextGathers?: AdHocContextGather[] | null
  perspectiveStances?: PerspectiveStance[] | null
  perspectives?: PerspectiveBundle[] | null
  perspectiveVerdicts?: ReviewPanelVerdict[] | null
  globalAssumptions?: GlobalAssumptionsPacket | null
  globalAssumptionsVerdict?: ReviewPanelVerdict | null
  globalEvidence?: GlobalEvidencePacket | null
  globalEvidenceVerdict?: ReviewPanelVerdict | null
  conclusions?: ConclusionsPacket | null
  conclusionsVerdict?: ReviewPanelVerdict | null
  implications?: ImplicationsPacket | null
  implicationsVerdict?: ReviewPanelVerdict | null
  finalAnswer?: FinalAnswer | null
}

function stepDone(run: RunState, stepId: StepId): boolean {
  switch (stepId) {
    case 'context-gather-pre':
      return run.contextGatherPre != null
    case 'frame-generate':
      return run.frame != null
    case 'frame-review':
      // A failing-but-retryable verdict sits in run.frameVerdict while the
      // layer loops back to regenerate (route.ts retryStep()) — only a PASS
      // means this step is actually done, not merely "a verdict exists."
      return run.frameVerdict?.overall_pass === true
    case 'context-gather-post':
      return run.contextGatherPost != null
    case 'breadth-scoping':
      return run.breadthScoping != null
    case 'perspectives-generate-stances':
      return run.perspectiveStances != null
    case 'perspectives-generate-details':
      return run.perspectives != null
    case 'perspectives-review':
      // "Done" means every bundle has settled — passed, or gave up and
      // degraded — not merely that a first round of verdicts exists (some
      // may still be mid-regeneration; see needsRegeneration() in
      // orchestrator-perspectives.ts).
      return run.perspectiveVerdicts != null && run.perspectiveVerdicts.every((v) => v.overall_pass || v.degraded)
    case 'global-assumptions-generate':
      return run.globalAssumptions != null
    case 'global-assumptions-review':
      return run.globalAssumptionsVerdict?.overall_pass === true
    case 'global-evidence-generate':
      return run.globalEvidence != null
    case 'global-evidence-review':
      return run.globalEvidenceVerdict?.overall_pass === true
    case 'conclusions-generate':
      return run.conclusions != null
    case 'conclusions-review':
      return run.conclusionsVerdict?.overall_pass === true
    case 'implications-generate':
      return run.implications != null
    case 'implications-review':
      return run.implicationsVerdict?.overall_pass === true
    case 'final-composition':
      return run.finalAnswer != null
  }
}

// Context-gather has no ReviewPanelVerdict to reuse ReviewPanelVerdictPanel
// with — it's a different, much smaller shape (needs_user_input/questions_for_user/
// reason, plus search_findings attached by the orchestrator, contracts.ts) —
// so this is a small dedicated block rather than a new general-purpose panel.
// Only rendered when there's something to show the user (needs_user_input).
//
// Read-only always, on both render paths this component serves (the live
// pipeline page AND the historical /admin/reasoning/runs browser, via the
// shared RunState this file defines) — `answers`, when present, is shown as
// plain text under each question, never as editable input. The live page's
// actual answer-collection UI is ContextGatherAnswerBox.tsx, a SEPARATE
// component only ReasoningPipelinePage.tsx imports; a past, already-`done`
// run has no one left to answer, so this file must never gain interactivity.
function ContextGatherNote({
  verdict,
  answers,
}: {
  verdict: ContextGatherVerdict | null | undefined
  answers?: (string | null)[] | null
}) {
  if (!verdict?.needs_user_input || verdict.questions_for_user.length === 0) return null
  return (
    <div
      style={{
        marginLeft: 24,
        marginTop: 2,
        marginBottom: 2,
        padding: '8px 10px',
        borderRadius: 7,
        border: '1px solid var(--amber)',
        background: 'var(--amber-tint)',
        fontSize: 11.5,
        color: 'var(--ink)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{verdict.reason}</div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {verdict.questions_for_user.map((q, i) => {
          const answer = answers?.[i]
          return (
            <li key={i}>
              {q.question}
              {answer && <div style={{ color: 'var(--ink-subtle)', fontStyle: 'italic', marginTop: 1 }}>→ {answer}</div>}
            </li>
          )
        })}
      </ul>
      {verdict.search_findings && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--ink-subtle)' }}>Search findings</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10.5, marginTop: 4 }}>{verdict.search_findings}</pre>
        </details>
      )}
    </div>
  )
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }

// Read-only list of every admin-triggered, ad-hoc context-gather call so far
// (Phase 3 item 1's larger scope) — rendered on both the live page and the
// historical browser, same as everything else in this file. Not tied to any
// LAYER_GROUPS row since an ad-hoc call can happen at any step boundary, so
// it gets its own section below the main list instead.
function AdHocContextGathersList({ gathers }: { gathers: AdHocContextGather[] | null | undefined }) {
  if (!gathers || gathers.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ ...mono, color: 'var(--ink-subtle)' }}>Ad-hoc questions</div>
      {gathers.map((g, i) => (
        <div key={i} style={{ border: '1px solid var(--rule)', borderRadius: 9, padding: '9px 12px', background: 'var(--white)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>Paused at: {g.atStep}</div>
          {g.verdict.needs_user_input ? (
            <ContextGatherNote verdict={g.verdict} answers={g.answers} />
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', marginTop: 4 }}>{g.verdict.reason}</div>
          )}
        </div>
      ))}
    </div>
  )
}

const degradedPill: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: '1px 6px',
  borderRadius: 999,
  border: '1px solid var(--amber)',
  background: 'var(--amber-tint)',
  color: 'var(--amber-text)',
}

export function ReasoningStagesList({
  run,
  currentStep,
  running,
}: {
  run: RunState
  currentStep: StepId | null
  running: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {LAYER_GROUPS.map((group) => {
        const allDone = group.stepIds.every((s) => stepDone(run, s))
        const isCurrent = currentStep != null && group.stepIds.includes(currentStep)

        return (
          <div
            key={group.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              border: '1px solid var(--rule)',
              borderRadius: 9,
              padding: '9px 12px',
              opacity: !allDone && !isCurrent ? 0.55 : 1,
              background: 'var(--white)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', flex: '0 0 auto' }}>
                {allDone ? (
                  <CheckIcon size={14} />
                ) : isCurrent && running ? (
                  <span className="mini-spinner" aria-hidden="true" />
                ) : (
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--rule)' }} />
                )}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  fontWeight: isCurrent ? 600 : 400,
                  color: allDone || isCurrent ? 'var(--ink)' : 'var(--ink-subtle)',
                }}
              >
                {isCurrent && currentStep ? STEP_LABELS[currentStep] : group.label}
              </span>
            </div>

            {group.id === 'context-gather-pre' && (
              <ContextGatherNote verdict={run.contextGatherPre} answers={run.contextGatherPreAnswers} />
            )}
            {group.id === 'context-gather-post' && (
              <ContextGatherNote verdict={run.contextGatherPost} answers={run.contextGatherPostAnswers} />
            )}
            {group.id === 'frame' && run.frameVerdict && (
              <ReviewPanelVerdictPanel label="Frame review" verdict={run.frameVerdict} artifact={run.frame} />
            )}
            {group.id === 'global-assumptions' && run.globalAssumptionsVerdict && (
              <ReviewPanelVerdictPanel
                label="Global assumptions review"
                verdict={run.globalAssumptionsVerdict}
                artifact={run.globalAssumptions}
              />
            )}
            {group.id === 'global-evidence' && run.globalEvidenceVerdict && (
              <ReviewPanelVerdictPanel
                label="Global evidence review"
                verdict={run.globalEvidenceVerdict}
                artifact={run.globalEvidence}
              />
            )}
            {group.id === 'conclusions' && run.conclusionsVerdict && (
              <ReviewPanelVerdictPanel label="Conclusions review" verdict={run.conclusionsVerdict} artifact={run.conclusions} />
            )}
            {group.id === 'implications' && run.implicationsVerdict && (
              <ReviewPanelVerdictPanel
                label="Implications review"
                verdict={run.implicationsVerdict}
                artifact={run.implications}
              />
            )}

            {group.id === 'perspectives' && run.perspectives && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 24 }}>
                {run.perspectives.map((p, i) => {
                  const verdict = run.perspectiveVerdicts?.[i]
                  return (
                    <div key={p.perspective_id} style={{ borderLeft: '2px solid var(--rule)', paddingLeft: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink)' }}>
                        {verdict ? (
                          verdict.degraded ? (
                            <span style={degradedPill}>degraded</span>
                          ) : verdict.overall_pass ? (
                            <CheckIcon size={12} />
                          ) : (
                            // Failed but not yet degraded — still regenerating.
                            <span className="mini-spinner" aria-hidden="true" />
                          )
                        ) : (
                          <span className="mini-spinner" aria-hidden="true" />
                        )}
                        <span style={{ fontWeight: 600 }}>{p.stance_label}</span>
                      </div>
                      {verdict && <ReviewPanelVerdictPanel label={`${p.stance_label} review`} verdict={verdict} artifact={p} />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <AdHocContextGathersList gathers={run.adHocContextGathers} />
    </div>
  )
}
