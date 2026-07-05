'use client'

// The Profile form. Holds all edits in local state (no backend yet). A debounced
// "saved" indicator reflects the auto-save affordance from the reference.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  perspectiveFields,
  profileToRow,
  usernameError,
  type AccountType,
  type PerspectiveKey,
  type ProfileData,
} from '@/lib/profile/data'
import { SectionCard, FieldLabel, TextInput, TextArea } from './primitives'
import { AccountTypeSelector } from './AccountTypeSelector'
import { DeleteAccountModal } from './DeleteAccountModal'

type SaveState = 'saved' | 'saving'

const twoCol: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
}

export function ProfileForm({ initial, userId }: { initial: ProfileData; userId: string }) {
  const [profile, setProfile] = useState<ProfileData>(initial)
  const [save, setSave] = useState<SaveState>('saved')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tourNote, setTourNote] = useState(false)
  const [taken, setTaken] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  const nameError = usernameError(profile.username)

  // Debounced auto-save to public.profiles. Skips the first render (the loaded
  // state) and never writes while the username is locally invalid.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (nameError) return
    setSave('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update(profileToRow(profile))
        .eq('id', userId)
      // 23505 = unique_violation: the username is already taken by another user.
      setTaken(error?.code === '23505')
      setSave('saved')
    }, 650)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [profile, nameError, userId])

  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))
  const setPerspective = (key: PerspectiveKey, value: string) =>
    setProfile((p) => ({ ...p, perspectives: { ...p.perspectives, [key]: value } }))

  return (
    <>
      {/* Breadcrumb + heading */}
      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link href="/dashboard" style={{ color: 'var(--ink-subtle)' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}>
          Dashboard
        </Link>
        <span aria-hidden="true">/</span>
        <span style={{ color: 'var(--ink)' }}>Profile</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(30px, 4vw, 40px)', letterSpacing: '-0.015em', color: 'var(--ink)' }}>
            Your Profile
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink-mid)', marginTop: 8 }}>
            Personal information and foundational perspective. Changes save automatically.
          </p>
        </div>
        <SaveIndicator state={save} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'clamp(20px, 3vw, 32px)' }}>
        {/* Username */}
        <SectionCard>
          <FieldLabel label="Username" helper="How teachers and classmates see you in classrooms. 3-30 characters: letters, numbers, underscore, dot, or dash." />
          <TextInput value={profile.username} onChange={(v) => set('username', v)} ariaLabel="Username" invalid={!!nameError || taken} />
          {nameError && <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 7 }}>{nameError}</p>}
          {!nameError && taken && <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 7 }}>That username is taken.</p>}
        </SectionCard>

        {/* Account Type */}
        <SectionCard>
          <FieldLabel label="Account Type" helper="Choose the experience that matches you. You can change this anytime." />
          <AccountTypeSelector value={profile.accountType} onChange={(t: AccountType) => set('accountType', t)} />
        </SectionCard>

        {/* About / Current Project */}
        <div style={twoCol}>
          <SectionCard>
            <FieldLabel label="About Me" />
            <TextArea value={profile.aboutMe} onChange={(v) => set('aboutMe', v)} placeholder="Tell us about yourself..." ariaLabel="About me" />
          </SectionCard>
          <SectionCard>
            <FieldLabel label="Current Project" />
            <TextInput value={profile.currentProject} onChange={(v) => set('currentProject', v)} placeholder="What are you working on?" ariaLabel="Current project" />
          </SectionCard>
        </div>

        {/* Role / Location */}
        <div style={twoCol}>
          <SectionCard>
            <FieldLabel label="Role" />
            <TextInput value={profile.role} onChange={(v) => set('role', v)} placeholder="Student, Researcher, Analyst..." ariaLabel="Role" />
          </SectionCard>
          <SectionCard>
            <FieldLabel label="Location / Context" />
            <TextInput value={profile.location} onChange={(v) => set('location', v)} placeholder="San Francisco, CA" ariaLabel="Location or context" />
          </SectionCard>
        </div>

        {/* Personal Foundational Point of View */}
        <div style={{ marginTop: 8 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(22px, 3vw, 28px)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            Personal Foundational Point of View
          </h2>
          <p className="mono" style={{ fontSize: 10, color: 'var(--amber-hover)', marginTop: 8 }}>
            Element 4.2 · These perspectives persist across all your houses.
          </p>
        </div>
        <div style={twoCol}>
          {perspectiveFields.map((f) => (
            <SectionCard key={f.key} accent="var(--amber)">
              <FieldLabel label={f.name} helper={f.desc} />
              <TextArea value={profile.perspectives[f.key]} onChange={(v) => setPerspective(f.key, v)} placeholder={f.placeholder} ariaLabel={`${f.name} perspective`} />
            </SectionCard>
          ))}
        </div>

        {/* Onboarding Tour */}
        <SectionCard style={{ marginTop: 8 }}>
          <FieldLabel label="Onboarding Tour" helper="Restart the guided tour anytime to revisit how Houses of Thought works." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setTourNote(true)
                setTimeout(() => setTourNote(false), 4000)
              }}
              style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 8, padding: '10px 16px', background: 'var(--white)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--parchment)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--white)'; e.currentTarget.style.color = 'var(--ink)' }}
            >
              Restart tour
            </button>
            {tourNote && <span style={{ fontSize: 13, color: 'var(--ink-subtle)' }}>The guided tour is on the way.</span>}
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <SectionCard accent="var(--warning)">
          <FieldLabel label="Danger Zone" helper="Permanently delete your account and all associated data. This action cannot be undone." color="var(--warning)" />
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--warning)', borderRadius: 8, padding: '10px 16px' }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-8" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete Account
          </button>
        </SectionCard>
      </div>

      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} />}
    </>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const saved = state === 'saved'
  return (
    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: saved ? 'var(--green-strong)' : 'var(--amber)' }} />
      {saved ? 'All changes saved' : 'Saving…'}
    </span>
  )
}
