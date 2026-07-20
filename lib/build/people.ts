// People who can own house content. 'you' is the signed-in builder and 'ai' is
// the co-pilot. 'maya' and 'devan' are legacy demo collaborators: they no longer
// appear anywhere in the live product (collaboration isn't built yet), but the
// keys stay so older saved houses and the public /examples fixtures that
// attribute items to them still render. Remove once those fixtures are re-keyed.

import type { Person, PersonKey } from './types'

export const people: Record<PersonKey, Person> = {
  you: { key: 'you', initials: 'YO', name: 'You', role: 'Owner', bg: '#14213A', fg: '#F7F6F2' },
  maya: { key: 'maya', initials: 'MR', name: 'Maya R.', role: 'Co-builder (demo)', bg: '#3F8F5B', fg: '#FFFFFF' },
  devan: { key: 'devan', initials: 'DK', name: 'Devan K.', role: 'Co-builder (demo)', bg: '#3E5C8A', fg: '#FFFFFF' },
  ai: { key: 'ai', initials: 'AI', name: 'Co-pilot', role: 'AI', bg: '#F2B021', fg: '#14213A' },
}
