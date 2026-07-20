// GET /api/health — public, unauthenticated liveness probe (ops plan items
// 10/15/18). Probes the Supabase PostgREST root directly: ANY http response —
// including 401 permission-denied, since anon has no table grants here — proves
// the project is up; only a network failure or a 5xx counts as down. A table
// query can't be used for this: supabase-js reports anon's 42501 as an opaque
// error indistinguishable from an outage.
//
// AI lanes are reported as COUNTS only, deliberately: this route is public, so
// key env-var names and per-lane health never appear here — that detail is the
// admin monitor's job (router-monitor.ts behind the admin gate).

import { NextResponse } from 'next/server'
import { TARGETS, type Target } from '@/lib/ai/router-config'

// Never cache a health check.
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  let db = false
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      cache: 'no-store',
      // Bounded so the monitor gets a timely 503 instead of a hang.
      signal: AbortSignal.timeout(5_000),
    })
    db = res.status < 500
  } catch {
    db = false
  }

  // Importing TARGETS is side-effect-free (no clients built, no state touched);
  // configured mirrors router-monitor's own per-target check.
  const targets = Object.values(TARGETS) as Target[]
  const configured = targets.filter((t) => Boolean(process.env[t.keyEnv])).length

  return NextResponse.json(
    { ok: db, db, aiLanes: { configured, total: targets.length } },
    { status: db ? 200 : 503 }
  )
}
