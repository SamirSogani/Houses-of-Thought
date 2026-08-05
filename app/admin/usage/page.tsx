// Token usage & cost ledger (decision 020) — admin-only, standalone from the
// router monitor. Same operator gate as /admin/chat and /admin/reasoning: a
// non-admin gets a 404 (notFound) so the route's existence isn't confirmed.

import { notFound } from 'next/navigation'
import { isCallerAdmin } from '@/lib/auth/admin'
import { TokenUsageMonitor } from '@/components/admin/TokenUsageMonitor'

export const dynamic = 'force-dynamic'

export default async function AdminUsagePage() {
  if (!(await isCallerAdmin())) notFound()
  return <TokenUsageMonitor />
}
