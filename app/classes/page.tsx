'use client'

// Student classroom panel (decision 010). Reached from the dashboard navbar
// (students only): join a class by code, see the classes you're in with progress,
// and open/continue assigned work. Auth is enforced by the proxy; the panel is
// harmless for any signed-in user, but the navbar only surfaces it to students.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import Footer from '@/components/sections/Footer'
import { StudentClasses } from '@/components/classroom/StudentClasses'
import { StudentAssignments } from '@/components/classroom/StudentAssignments'

export default function StudentClassroomPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  // Set by the join flow (/join/<code> → /classes?joined=1). Joining a class
  // used to drop the student on the dashboard with no confirmation anywhere
  // (ux M5). Read from window on mount so no Suspense boundary is required.
  const [justJoined, setJustJoined] = useState(false)
  useEffect(() => {
    setJustJoined(new URLSearchParams(window.location.search).get('joined') === '1')
  }, [])

  // Teachers have their own /classroom; keep the two entry points from crossing.
  const guard = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
    if (profile?.account_type === 'teacher') {
      router.replace('/classroom')
      return
    }
    setReady(true)
  }, [router])

  useEffect(() => {
    guard()
  }, [guard])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!ready) {
    return (
      <main
        id="main"
        className="acct-vh-min"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--parchment)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: 'var(--ink-subtle)',
        }}
      >
        Loading your classes…
      </main>
    )
  }

  return (
    <div className="acct-vh-min" style={{ display: 'flex', flexDirection: 'column', background: 'var(--parchment)' }}>
      <DashboardHeader onSignOut={handleSignOut} showClassroom classroomHref="/classes" active="classroom" />

      <main style={{ flex: '1 1 auto' }}>
        <div className="container" style={{ paddingBlock: 'clamp(32px, 5vw, 56px)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(30px, 4vw, 40px)', letterSpacing: '-0.015em', color: 'var(--ink)' }}>
            Your Classes
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink-mid)', marginTop: 8 }}>
            Join a class, track your progress, and open the work assigned to you.
          </p>

          {justJoined && (
            <p
              role="status"
              style={{
                marginTop: 16,
                padding: '11px 15px',
                border: '1px solid var(--green-strong)',
                background: 'rgba(63,143,91,0.10)',
                borderRadius: 10,
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--ink)',
              }}
            >
              You&rsquo;re in. Your new class and any work assigned to you are below.
            </p>
          )}

          <div style={{ marginTop: 'clamp(24px, 3vw, 36px)' }}>
            <StudentClasses />
          </div>

          {/* Assigned work (self-hides when empty). */}
          <div style={{ marginTop: 'clamp(28px, 4vw, 44px)' }}>
            <StudentAssignments />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
