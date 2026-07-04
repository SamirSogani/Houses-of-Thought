// Static data + validation for the Profile page. No backend yet; edits live in local
// component state. Copy taken from references/ux/Migration_v2_Profile.pdf (em-dashes
// removed per brand rules, "Draft Full House" typo corrected).

export type AccountType = 'standard' | 'student' | 'teacher'

export interface AccountTypeMeta {
  key: AccountType
  name: string
  desc: string
}

export const accountTypes: AccountTypeMeta[] = [
  {
    key: 'standard',
    name: 'Standard',
    desc: 'Full access to every feature, including the AI assistant and Draft Full House.',
  },
  {
    key: 'student',
    name: 'Student',
    desc: 'Built for classroom learning. Research Mode, Logic Strength, and Stress Test are available. The AI assistant and Draft Full House are not.',
  },
  {
    key: 'teacher',
    name: 'Teacher',
    desc: 'Full access for educators. Same features as Standard.',
  },
]

export type PerspectiveKey = 'biological' | 'social' | 'familial' | 'individual'

export interface PerspectiveMeta {
  key: PerspectiveKey
  name: string
  desc: string
  placeholder: string
}

export const perspectiveFields: PerspectiveMeta[] = [
  {
    key: 'biological',
    name: 'Biological',
    desc: 'Your biological influences, instincts, and physical perspective',
    placeholder: 'Describe your biological perspective...',
  },
  {
    key: 'social',
    name: 'Social',
    desc: 'Your social context, cultural background, and community influences',
    placeholder: 'Describe your social perspective...',
  },
  {
    key: 'familial',
    name: 'Familial',
    desc: 'Your family upbringing, traditions, and familial values',
    placeholder: 'Describe your familial perspective...',
  },
  {
    key: 'individual',
    name: 'Individual',
    desc: 'Your unique personal experiences, beliefs, and individual identity',
    placeholder: 'Describe your individual perspective...',
  },
]

export interface ProfileData {
  username: string
  accountType: AccountType
  aboutMe: string
  currentProject: string
  role: string
  location: string
  perspectives: Record<PerspectiveKey, string>
}

export const initialProfile: ProfileData = {
  username: 'Samir_sogani',
  accountType: 'standard',
  aboutMe: '',
  currentProject: '',
  role: '',
  location: '',
  perspectives: { biological: '', social: '', familial: '', individual: '' },
}

// Username rule from the reference: 3-30 chars; letters, numbers, underscore, dot, dash.
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/

export function usernameError(value: string): string | null {
  if (value.length === 0) return 'Username is required.'
  if (value.length < 3) return 'Use at least 3 characters.'
  if (value.length > 30) return 'Use 30 characters or fewer.'
  if (!USERNAME_RE.test(value)) return 'Only letters, numbers, underscore, dot, or dash.'
  return null
}
