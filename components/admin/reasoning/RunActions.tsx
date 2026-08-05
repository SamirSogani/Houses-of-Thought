'use client'

// Two actions for a finished, real (non-dry-run) reasoning-pipeline run —
// mounted next to FinalAnswerCard on both the live pipeline page
// (ReasoningPipelinePage.tsx) and the past-runs browser
// (ReasoningRunsBrowser.tsx). Both callers are responsible for only mounting
// this once the run has actually finished (finalAnswer != null) and, on the
// live page, only for a real run (dry runs are never persisted, so there is
// nothing for the PATCH below to link) — this component defensively returns
// null on a missing finalAnswer as a second guard, but does not itself know
// about dryRun.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveHouse } from '@/lib/build/persistence'
import { reasoningRunToState } from '@/lib/ai/reasoning/house-mapping'
import type { RunState } from './ReasoningStagesList'

const btnStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--ink)',
  background: 'var(--white)',
  border: '1px solid var(--ink)',
  borderRadius: 7,
  padding: '5px 12px',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
}

export function RunActions({
  runId,
  run,
  // Already-linked house, when known up front (the runs browser fetches it
  // with the rest of the run detail). Omitted on the live pipeline page — a
  // freshly finished run's runId is only ever generated once per question
  // (crypto.randomUUID() in ReasoningPipelinePage.tsx's start()), so it can
  // never already be linked when this first mounts.
  initialHouseId,
}: {
  runId: string
  run: RunState
  initialHouseId?: string | null
}) {
  const router = useRouter()
  const [houseId, setHouseId] = useState<string | null>(initialHouseId ?? null)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!run.finalAnswer) return null

  async function viewInHouse() {
    if (busy) return
    if (houseId) {
      router.push(`/build/${houseId}?fromReasoningRun=${runId}`)
      return
    }
    setBusy(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErrorMsg('Signed out — sign in again to continue.')
        return
      }

      const { data: row, error: insertError } = await supabase
        .from('houses')
        .insert({ owner_id: user.id })
        .select('id')
        .single()
      if (insertError || !row) {
        setErrorMsg('Could not create the house.')
        return
      }
      const newHouseId = row.id as string

      // First save of a fresh house — no expectedRev to guard against.
      await saveHouse(supabase, newHouseId, reasoningRunToState(run))

      // Record the link server-side (reasoning_runs is deny-all RLS). A
      // double-click race converges on one winner via the route's
      // conditional update — resolvedHouseId is whichever id actually won,
      // not necessarily newHouseId.
      const res = await fetch(`/api/admin/reasoning/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ houseId: newHouseId }),
      })
      const resolvedHouseId: string = res.ok ? ((await res.json()) as { houseId: string }).houseId : newHouseId

      setHouseId(resolvedHouseId)
      router.push(`/build/${resolvedHouseId}?fromReasoningRun=${runId}`)
    } catch {
      setErrorMsg('Could not create the house.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => void viewInHouse()} disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Opening…' : houseId ? 'Open house' : 'View in house'}
      </button>
      <Link href={`/admin/reasoning/runs/${runId}/synthesis`} style={btnStyle}>
        Pro/con synthesis
      </Link>
      {errorMsg && <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{errorMsg}</span>}
    </div>
  )
}
