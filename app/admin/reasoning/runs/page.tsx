// Browse past reasoning-pipeline runs (decision 019, Phase 2 item 1). Same
// operator gate as /admin/reasoning: a non-admin gets a 404 (notFound) so the
// route's existence isn't confirmed to others.

import { notFound } from 'next/navigation'
import { isCallerAdmin } from '@/lib/auth/admin'
import { ReasoningRunsBrowser } from '@/components/admin/reasoning/ReasoningRunsBrowser'

export const dynamic = 'force-dynamic'

export default async function AdminReasoningRunsPage({
  searchParams,
}: {
  // ?run= (app/build/[id]/page.tsx's "← Back to pipeline" link) deep-links
  // straight to a run instead of landing on the bare list.
  searchParams: Promise<{ run?: string }>
}) {
  if (!(await isCallerAdmin())) notFound()
  const { run } = await searchParams
  return <ReasoningRunsBrowser initialSelectedRunId={run} />
}
