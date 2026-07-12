// Cheap admin check for the navbar: the AdminNavLink calls this to decide whether
// to render the Admin entry. Returns a plain boolean (never leaks the admin email
// or 403s), so non-admins simply see no link.

import { NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ admin: await isCallerAdmin() })
}
