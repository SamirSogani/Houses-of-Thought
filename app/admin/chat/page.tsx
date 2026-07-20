// House Chat (decision 017) — admin-only beta. Same operator gate as /admin:
// anyone who is not the ADMIN_EMAIL_001 account gets a 404 (notFound) so the
// route's existence isn't even confirmed to others. The chat itself is a client
// component; the build machinery it drives is the standard Draft Mode loop.

import { notFound } from 'next/navigation'
import { isCallerAdmin } from '@/lib/auth/admin'
import { HouseChat } from '@/components/admin/HouseChat'

export const dynamic = 'force-dynamic'

export default async function AdminChatPage() {
  if (!(await isCallerAdmin())) notFound()
  return <HouseChat />
}
