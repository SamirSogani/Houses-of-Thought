// Per-model admin detail. Server-gated (non-admins → 404). The model is passed as
// ?name=<provider/model>; the client component fetches its detail from the API.

import { notFound } from 'next/navigation'
import { isCallerAdmin } from '@/lib/auth/admin'
import { ModelDetail } from '@/components/admin/ModelDetail'

export const dynamic = 'force-dynamic'

export default async function AdminModelPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  if (!(await isCallerAdmin())) notFound()
  const { name } = await searchParams
  if (!name) notFound()
  return <ModelDetail name={name} />
}
