// Token usage & cost ledger endpoint (admin-only, decision 020).
//   GET ?range=today|7d|30d|all → per-model breakdown (input/output/total
//   tokens, cost, call count) plus grand totals, sourced from the durable
//   ai_token_usage ledger (all instances) via lib/ai/token-usage.ts's
//   summary RPC. Cheap: one service-role query, no upstream calls.

import { NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/auth/admin'
import { getTokenUsageSummary, type UsageRange } from '@/lib/ai/token-usage'

export const dynamic = 'force-dynamic'

const RANGES: UsageRange[] = ['today', '7d', '30d', 'all']

function parseRange(value: string | null): UsageRange {
  return RANGES.includes(value as UsageRange) ? (value as UsageRange) : 'today'
}

export async function GET(req: Request) {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const range = parseRange(new URL(req.url).searchParams.get('range'))
  const summary = await getTokenUsageSummary(range) // null when the read is down
  return NextResponse.json({ summary })
}
