// Per-model detail endpoint (admin-only), keyed by ?name=<provider/model>.
//   GET  → detail: identity, health, recent event log, failover position.
//   POST → runs a live probe against THIS model only, then returns fresh detail.

import { NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/auth/admin'
import { getTargetDetail, probeOne } from '@/lib/ai/router'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const name = new URL(req.url).searchParams.get('name') ?? ''
  const detail = getTargetDetail(name)
  if (!detail.found) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json({ detail })
}

export async function POST(req: Request) {
  if (!(await isCallerAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const name = new URL(req.url).searchParams.get('name') ?? ''
  const probe = await probeOne(name)
  if (!probe) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json({ detail: getTargetDetail(name), probe })
}
