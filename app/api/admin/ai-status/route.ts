// AI router monitor endpoint (admin-only).
//   GET  → passive snapshot of the routing engine (lanes, penalty box, daily
//          airbag, per-target health derived from real traffic). Cheap, no
//          upstream calls.
//   POST → the above PLUS an active liveness probe that pings every target. Costs
//          a sliver of quota, so it is only run when the admin clicks "Run check".

import { NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/auth/admin'
import { getRouterSnapshot, probeTargets } from '@/lib/ai/router'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return NextResponse.json({ snapshot: getRouterSnapshot() })
}

export async function POST() {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const probe = await probeTargets()
  return NextResponse.json({ snapshot: getRouterSnapshot(), probe })
}
