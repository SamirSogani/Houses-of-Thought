// AI router monitor endpoint (admin-only).
//   GET  → passive snapshot of the routing engine (lanes, penalty box, daily
//          airbag, per-target health derived from real traffic) PLUS consumption:
//          today's ai_usage totals (durable, all instances) and the per-route /
//          Brave counters (this instance only). Cheap: one service-role query,
//          no upstream calls.
//   POST → the above PLUS an active liveness probe that pings every target. Costs
//          a sliver of quota, so it is only run when the admin clicks "Run check".

import { NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/auth/admin'
import { getRouterSnapshot, probeTargets } from '@/lib/ai/router'
import { getAiUsageSummary, getRouteCounts } from '@/lib/ai/limits'
import { getBraveCounter } from '@/lib/ai/brave'

export const dynamic = 'force-dynamic'

async function payload() {
  return {
    snapshot: getRouterSnapshot(),
    usage: await getAiUsageSummary(), // null when the usage read is down
    routeCounts: getRouteCounts(),
    brave: getBraveCounter(),
  }
}

export async function GET() {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return NextResponse.json(await payload())
}

export async function POST() {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const probe = await probeTargets()
  return NextResponse.json({ ...(await payload()), probe })
}
