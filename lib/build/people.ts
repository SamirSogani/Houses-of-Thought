// The four collaborators. See handoff 06-COLLABORATION-MODEL.md §1.

import type { Person, PersonKey } from './types'

export const people: Record<PersonKey, Person> = {
  you: { key: 'you', initials: 'YO', name: 'You', role: 'Owner', bg: '#14213A', fg: '#F7F6F2' },
  maya: { key: 'maya', initials: 'MR', name: 'Maya R.', role: 'Teacher', bg: '#3F8F5B', fg: '#FFFFFF' },
  devan: { key: 'devan', initials: 'DK', name: 'Devan K.', role: 'Co-builder', bg: '#3E5C8A', fg: '#FFFFFF' },
  ai: { key: 'ai', initials: 'AI', name: 'Co-pilot', role: 'AI', bg: '#F2B021', fg: '#14213A' },
}

// Owner reassignment cycles among humans only (never the AI). 03 §7.
export const ownerCycle: PersonKey[] = ['you', 'maya', 'devan']

// Seeded presence per person for the Team tab. 06 §3. "you" is dynamic (set at render).
export const seededPresence: Record<Exclude<PersonKey, 'you'>, { text: string; dot: string }> = {
  maya: { text: 'In Evidence', dot: 'var(--green-strong)' },
  devan: { text: 'In Perspectives', dot: 'var(--amber)' },
  ai: { text: 'Watching this layer', dot: 'var(--rule)' },
}

// Seeded activity feed. 06 §6.
export const activityFeed: { who: string; what: string; when: string; owner: PersonKey }[] = [
  { who: 'Maya R.', what: 'added evidence from Stanford GSE.', when: '2m', owner: 'maya' },
  { who: 'Co-pilot', what: 'suggested the IT & Security perspective.', when: '8m', owner: 'ai' },
  { who: 'Devan K.', what: 'took ownership of Parents.', when: '14m', owner: 'devan' },
]
