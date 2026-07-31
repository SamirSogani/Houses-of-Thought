// Reasoning pipeline (decision 019) — admin-only, standalone from House Chat.
// Same operator gate as /admin/chat: a non-admin gets a 404 (notFound) so the
// route's existence isn't confirmed to others.

import { notFound } from 'next/navigation'
import { isCallerAdmin } from '@/lib/auth/admin'
import { ReasoningPipelinePage } from '@/components/admin/reasoning/ReasoningPipelinePage'

export const dynamic = 'force-dynamic'

export default async function AdminReasoningPage() {
  if (!(await isCallerAdmin())) notFound()
  return <ReasoningPipelinePage />
}
