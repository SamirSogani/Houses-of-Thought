// Admin AI monitor. Server-gated: anyone who is not the ADMIN_EMAIL_001 account
// gets a 404 (notFound) so the route's existence isn't even confirmed to others.
// The monitor UI itself is a client component that reads the admin API.

import { notFound } from 'next/navigation'
import { isCallerAdmin } from '@/lib/auth/admin'
import { AiMonitor } from '@/components/admin/AiMonitor'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!(await isCallerAdmin())) notFound()
  return <AiMonitor />
}
