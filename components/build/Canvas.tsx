'use client'

// Center canvas as a single scrolling document (builder-workspace-redesign
// plan §1): the document header (question + purpose), then all seven layers
// stacked as sections, each with its own heading and Draft Mode claim banner.
// This replaced the one-layer-at-a-time wizard with its Back/Next footer.
//
// state.step still means "the focused layer". Two things move it: LayerNav
// (and the reducer's APPLY_DRAFT_STAGE, so the view follows a live draft) —
// this component scrolls the matching section into view; and this component's
// own scroll-spy, which dispatches GO_STEP as the reader scrolls. The two are
// kept from feeding each other by remembering which step the spy last chose
// and skipping the programmatic scroll for that one.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { Action, State } from '@/lib/build/types'
import type { Strength } from '@/lib/build/strength'
import { stepLabelsForMode, type PipelineMode } from '@/lib/ai/reasoning/steps'
import { documentHeading, layers } from '@/lib/build/content'
import { draftGateLocked } from '@/lib/ai/draft'
import { InlineText } from './Editable'
import { DraftClaimBanner } from './DraftClaimBanner'
import { FrameLayer } from './layers/FrameLayer'
import { PerspectivesLayer } from './layers/PerspectivesLayer'
import { PerspectiveDetail } from './layers/PerspectiveDetail'
import { EvidenceLayer } from './layers/EvidenceLayer'
import { AssumptionsLayer } from './layers/AssumptionsLayer'
import { ConclusionLayer } from './layers/ConclusionLayer'
import { ImplicationsLayer } from './layers/ImplicationsLayer'
import { ReviewLayer } from './layers/ReviewLayer'
import { SectorShell } from './sectors/SectorShell'
import { ImplicationsSector } from './sectors/ImplicationsSector'
import { PerspectivesSector } from './sectors/PerspectivesSector'
import { SectorButton } from './sectors/SectorButton'
import { FindingsBanner } from './sectors/SectorFindings'
import { SECTOR_META } from '@/lib/sectors/types'
import type { SectorsState } from './sectors/useSectors'
import type { ImplicationsSectorAnalysis, PerspectivesSectorAnalysis } from '@/lib/sectors/types'
import { houseIsBlank } from './rail/DraftCard'
import { PipelineLayerIndicator, layerPipelineStatus } from './PipelineLayerStatus'
import type { ReasoningPipelineRunner } from './useReasoningPipelineRunner'

const SPY_DEBOUNCE_MS = 180
// How long a programmatic smooth scroll is allowed to settle before the spy is
// trusted again (a smooth scroll fires many intersection changes on the way).
const PROGRAMMATIC_SCROLL_MS = 700

const sectionId = (step: number) => `layer-${step}`

export const Canvas = forwardRef<
  HTMLElement,
  {
    state: State
    strength: Strength
    dispatch: React.Dispatch<Action>
    houseId?: string
    sectors?: SectorsState
    pipelineMode?: PipelineMode
    pipelineRunner?: ReasoningPipelineRunner
  }
>(
  function Canvas({ state, strength, dispatch, houseId, sectors, pipelineMode, pipelineRunner }, ref) {
    const mainRef = useRef<HTMLElement>(null)
    useImperativeHandle(ref, () => mainRef.current as HTMLElement)

    const { step, activePerspective: activeId } = state
    const activePerspective =
      activeId != null ? state.perspectives.find((p) => p.id === activeId) ?? null : null

    // ── Focus → scroll ─────────────────────────────────────────────────────
    const spyStepRef = useRef<number | null>(null)
    const programmaticUntilRef = useRef(0)
    useEffect(() => {
      if (spyStepRef.current === step) {
        // The spy chose this step from the reader's own scrolling; don't yank.
        spyStepRef.current = null
        return
      }
      const el = mainRef.current?.querySelector<HTMLElement>(`#${sectionId(step)}`)
      if (!el) return
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }, [step])

    // Opening a perspective's detail should bring the Perspectives section into
    // view even when the focused layer was already 2 (no step change to react to).
    useEffect(() => {
      if (activeId == null) return
      const el = mainRef.current?.querySelector<HTMLElement>(`#${sectionId(2)}`)
      if (!el) return
      programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS
      el.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, [activeId])

    // ── Scroll → focus (scroll-spy) ────────────────────────────────────────
    // The spy reads the current step only after its debounce, so syncing the
    // ref in an effect (not during render) is early enough and lint-clean.
    const stepRef = useRef(step)
    useEffect(() => {
      stepRef.current = step
    }, [step])
    useEffect(() => {
      const root = mainRef.current
      if (!root || typeof IntersectionObserver === 'undefined') return
      const visible = new Map<number, number>() // step → top offset within root
      let timer: ReturnType<typeof setTimeout> | null = null

      const settle = () => {
        timer = null
        if (Date.now() < programmaticUntilRef.current) return
        if (visible.size === 0) return
        // The intersecting section nearest the top of the reading band wins.
        let best: number | null = null
        let bestTop = Infinity
        visible.forEach((top, s) => {
          if (top < bestTop) {
            bestTop = top
            best = s
          }
        })
        if (best !== null && best !== stepRef.current) {
          spyStepRef.current = best
          dispatch({ type: 'GO_STEP', n: best })
        }
      }

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const s = Number((e.target as HTMLElement).dataset.step)
            if (e.isIntersecting) visible.set(s, e.boundingClientRect.top)
            else visible.delete(s)
          }
          if (timer) clearTimeout(timer)
          timer = setTimeout(settle, SPY_DEBOUNCE_MS)
        },
        // A band from 20% down the viewport to 45% up from the bottom: a
        // section counts as "being read" once its box crosses that band.
        { root, rootMargin: '-20% 0px -45% 0px', threshold: 0 }
      )
      root.querySelectorAll<HTMLElement>('section[data-step]').forEach((el) => io.observe(el))
      return () => {
        io.disconnect()
        if (timer) clearTimeout(timer)
      }
      // Sections are static (always seven); observing once on mount is enough.
    }, [dispatch])

    const counts = { perspectives: state.perspectives.length, evidence: state.evidence.length }
    const isDraft = draftGateLocked(state.draft)

    // Reset scroll when entering or leaving a sector deep-dive. Without this
    // the <main> element's scrollTop carries over from the house view (which
    // may be scrolled several screens down), making the sector appear blank.
    const activeSectorType = sectors?.activeSector ?? null
    useEffect(() => {
      if (mainRef.current) mainRef.current.scrollTop = 0
    }, [activeSectorType])

    // Sector deep-dive view: replaces normal canvas content when active.
    if (sectors?.activeSector) {
      const sType = sectors.activeSector
      const sRow = sectors.sectors[sType]
      const isLoading = sectors.generating === sType || (sRow?.status === 'generating')
      const sError = sRow?.status === 'failed' ? (sRow.error ?? 'Unknown error') : null
      return (
        <main ref={mainRef} className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', minWidth: 0 }}>
          <div className="bhp-canvas-inner" style={{ maxWidth: 760, margin: '0 auto', padding: '30px 36px 120px' }}>
            <SectorShell
              sectorType={sType}
              loading={isLoading}
              error={sError}
              onBack={sectors.closeSector}
              onRegenerate={() => sectors.regenerate(sType)}
            >
              {sType === 'implications' && sRow?.analysis && (
                <ImplicationsSector analysis={sRow.analysis as ImplicationsSectorAnalysis} />
              )}
              {sType === 'perspectives' && sRow?.analysis && (
                <PerspectivesSector analysis={sRow.analysis as PerspectivesSectorAnalysis} />
              )}
            </SectorShell>
          </div>
        </main>
      )
    }

    // Sector findings + button helpers for eligible layers.
    const implSector = sectors?.sectors.implications
    const perspSector = sectors?.sectors.perspectives
    const implFindings = implSector?.status === 'complete' && Array.isArray(implSector.findings) ? implSector.findings : []
    const perspFindings = perspSector?.status === 'complete' && Array.isArray(perspSector.findings) ? perspSector.findings : []

    return (
      <main ref={mainRef} className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', minWidth: 0 }}>
        <div className="bhp-canvas-inner" style={{ maxWidth: 760, margin: '0 auto', padding: '34px 36px 160px' }}>
          {/* ── The seven layers, stacked ─────────────────────────────────── */}
          {layers.map((l) => {
            const s = l.step
            const h = documentHeading(s, counts)
            // Pipeline inline status (Level 2 redesign)
            const pipelineStatus = pipelineRunner && pipelineMode
              ? layerPipelineStatus(s, pipelineRunner, pipelineMode)
              : null
            const activeStepLabel = pipelineStatus === 'active' && pipelineRunner?.step
              ? stepLabelsForMode(pipelineMode ?? 'thorough')[pipelineRunner.step] ?? null
              : null
            return (
              <section key={s} id={sectionId(s)} data-step={s} aria-labelledby={`${sectionId(s)}-title`} className="bhp-doc-section" style={{ marginTop: s === 1 ? 0 : 44 }}>
                {/* Frame IS the question, its purpose, and the concepts — so the
                    document header lives inside this first section. Jumping to
                    "Frame" lands on the question, and the scroll-spy reads the
                    top of the document as Frame. */}
                {s === 1 && <DocumentHeader state={state} dispatch={dispatch} isDraft={isDraft} />}

                {/* Inline pipeline prompt — minimal entry point (Level 2 redesign).
                    Shows when the house is blank, pipeline is idle, and runner is available. */}
                {s === 1 && pipelineRunner && houseIsBlank(state) && !state.draft && pipelineRunner.phase === 'idle' && (
                  <div style={{ marginTop: 16, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const q = state.question.trim()
                        if (q) pipelineRunner.start(q)
                      }}
                      disabled={!state.question.trim()}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: state.question.trim() ? 'var(--ink)' : 'var(--ink-subtle)',
                        background: state.question.trim() ? 'var(--amber-tint)' : 'var(--white)',
                        border: `1px solid ${state.question.trim() ? 'var(--amber)' : 'var(--rule)'}`,
                        borderRadius: 8,
                        padding: '8px 16px',
                        cursor: state.question.trim() ? 'pointer' : 'not-allowed',
                        opacity: state.question.trim() ? 1 : 0.5,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Build this house with AI →
                    </button>
                  </div>
                )}

                {/* Pipeline running status line — shows in the Frame area during pipeline execution */}
                {s === 1 && pipelineRunner && ['running', 'paused', 'awaiting-input', 'halted'].includes(pipelineRunner.phase) && (
                  <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {pipelineRunner.phase === 'running' && <span className="mini-spinner" style={{ width: 14, height: 14 }} />}
                    <span style={{ fontSize: 13, color: 'var(--ink-subtle)' }}>
                      {pipelineRunner.phase === 'running'
                        ? 'Building your house…'
                        : pipelineRunner.phase === 'paused'
                          ? 'Pipeline paused — open Co-pilot to continue'
                          : pipelineRunner.phase === 'awaiting-input'
                            ? 'Waiting for your input — open Co-pilot'
                            : 'Pipeline halted — open Co-pilot for details'}
                    </span>
                  </div>
                )}

                <div className="bhp-doc-section-head" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--rule-soft)', marginTop: s === 1 ? 36 : 0 }}>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--ink-subtle)', flex: '0 0 auto' }}>
                    {h.eyebrow}
                  </span>
                  {pipelineStatus && <PipelineLayerIndicator status={pipelineStatus} />}
                  <h2 id={`${sectionId(s)}-title`} style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>
                    {pipelineStatus === 'active' && activeStepLabel ? activeStepLabel : h.title}
                  </h2>
                </div>

                {/* Draft Mode claim pass (decision 016 §2) + post-draft Q&A (0039), per section. */}
                {!(s === 2 && activePerspective) && <DraftClaimBanner state={state} dispatch={dispatch} houseId={houseId} step={s} />}

                {/* Sector button + findings banner for eligible layers (perspectives § 2, implications § 6). */}
                {s === 2 && !activePerspective && sectors && houseId && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <SectorButton
                        sectorType="perspectives"
                        sector={perspSector}
                        generating={sectors.generating === 'perspectives'}
                        onClick={() => sectors.openSector('perspectives')}
                      />
                    </div>
                    {perspFindings.length > 0 && (
                      <FindingsBanner
                        findings={perspFindings}
                        sectorLabel={SECTOR_META.perspectives.label}
                        onOpenSector={() => sectors.openSector('perspectives')}
                      />
                    )}
                  </>
                )}
                {s === 6 && sectors && houseId && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <SectorButton
                        sectorType="implications"
                        sector={implSector}
                        generating={sectors.generating === 'implications'}
                        onClick={() => sectors.openSector('implications')}
                      />
                    </div>
                    {implFindings.length > 0 && (
                      <FindingsBanner
                        findings={implFindings}
                        sectorLabel={SECTOR_META.implications.label}
                        onOpenSector={() => sectors.openSector('implications')}
                      />
                    )}
                  </>
                )}

                {s === 1 && <FrameLayer state={state} dispatch={dispatch} conceptsOnly />}
                {s === 2 &&
                  (activePerspective ? (
                    <PerspectiveDetail perspective={activePerspective} dispatch={dispatch} onBack={() => dispatch({ type: 'CLOSE_PERSPECTIVE' })} />
                  ) : (
                    <PerspectivesLayer state={state} dispatch={dispatch} />
                  ))}
                {s === 3 && <EvidenceLayer state={state} dispatch={dispatch} />}
                {s === 4 && <AssumptionsLayer state={state} dispatch={dispatch} />}
                {s === 5 && <ConclusionLayer state={state} dispatch={dispatch} />}
                {s === 6 && <ImplicationsLayer state={state} dispatch={dispatch} />}
                {s === 7 && <ReviewLayer state={state} strength={strength} dispatch={dispatch} />}
              </section>
            )
          })}
        </div>
      </main>
    )
  }
)

// The question and its purpose — the top of the document, inside the Frame
// section (see the note at its call site).
function DocumentHeader({ state, dispatch, isDraft }: { state: State; dispatch: React.Dispatch<Action>; isDraft: boolean }) {
  return (
    <header className="bhp-doc-header">
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--amber-text)' }}>
              Your house{isDraft ? ' · Draft' : ''}
            </div>
            <h1
              className="bhp-doc-h1"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, lineHeight: 1.18, letterSpacing: '-0.015em', color: 'var(--ink)', marginTop: 10 }}
            >
              <InlineText
                ariaLabel="Overarching question"
                multiline
                value={state.question}
                placeholder="What's a question you can't crack?"
                onChange={(value) => dispatch({ type: 'SET_QUESTION', value })}
              />
            </h1>
            <div
              style={{
                marginTop: 18,
                padding: '12px 16px',
                background: 'var(--amber-tint)',
                borderLeft: '3px solid var(--amber)',
                borderRadius: '0 10px 10px 0',
              }}
            >
              <div className="mono" style={{ fontSize: 9, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--amber-text)' }}>Purpose</div>
              <div style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.55, marginTop: 5 }}>
                <InlineText
                  ariaLabel="Purpose"
                  multiline
                  value={state.purpose}
                  placeholder="Why does this question matter, and who does the reasoning have to hold up to?"
                  onChange={(value) => dispatch({ type: 'SET_PURPOSE', value })}
                />
              </div>
            </div>
          </header>
  )
}
