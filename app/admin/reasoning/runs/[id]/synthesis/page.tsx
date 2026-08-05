// Pro/con synthesis of a finished reasoning-pipeline run (RunActions.tsx).
// Same operator gate as every other /admin/reasoning page: a non-admin gets
// a 404 (notFound) so the route's existence isn't confirmed to others. A
// bookmarkable [id] route deliberately not offered by the runs browser
// itself — see decisions/020 for why this doesn't reopen that "no [id]
// route" choice: this is a materially different artifact (its own
// generation step, its own persisted sidebar), not a second way to view the
// same raw run detail.

import { notFound } from 'next/navigation'
import { isCallerAdmin } from '@/lib/auth/admin'
import { SynthesisPage } from '@/components/admin/reasoning/SynthesisPage'

export const dynamic = 'force-dynamic'

export default async function AdminReasoningRunSynthesisPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isCallerAdmin())) notFound()
  const { id } = await params
  return <SynthesisPage runId={id} />
}
