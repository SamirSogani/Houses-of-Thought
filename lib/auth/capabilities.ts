// Single source of truth for what each account type may do (plan phase 1).
// Isomorphic + pure: imported by both server routes (authoritative gate) and
// client UI (cosmetic hiding). Keep this the ONLY place capabilities are decided
// so the two layers never drift.
//
// Decisions this encodes:
//  - Students run the co-pilot in Learn/Coach posture only and are pinned to
//    Learn mode (decision 007). They never get "author" output.
//  - Draft Mode (decision 016) supersedes 001 §3's "Draft Full House is dead for
//    everyone": canAuthorDraft is true for full-posture adults (standard, teacher)
//    and gates POST /api/ai/draft server-side. Students stay false — they never
//    get author output — and the verdict (conclusion/reasoning) stays human-only
//    in every mode (016 §1). The teacher strawman remains separately gated
//    per-assignment (assignments.ai_strawman_enabled) in app/api/ai/strawman.
//  - Only teachers may create classes / see other users' houses (decision 001 §2:
//    multi-user lives in classrooms).

import type { AccountType } from '@/lib/profile/data'
import type { AiMode } from '@/lib/build/types'

export interface Capabilities {
  // 'coach' = Socratic/withholding only; 'full' = Learn and Decide both allowed.
  aiPosture: 'coach' | 'full'
  canAuthorDraft: boolean
  canCreateClasses: boolean
  canViewOthersHouses: boolean
  // When set, the co-pilot mode is pinned to this value (students → 'learn').
  forcedMode: AiMode | null
}

const CAPABILITIES: Record<AccountType, Capabilities> = {
  standard: {
    aiPosture: 'full',
    canAuthorDraft: true,
    canCreateClasses: false,
    canViewOthersHouses: false,
    forcedMode: null,
  },
  teacher: {
    aiPosture: 'full',
    canAuthorDraft: true,
    canCreateClasses: true,
    canViewOthersHouses: true,
    forcedMode: null,
  },
  student: {
    aiPosture: 'coach',
    canAuthorDraft: false,
    canCreateClasses: false,
    canViewOthersHouses: false,
    forcedMode: 'learn',
  },
}

// Falls back to the most-restrictive-but-functional default ('standard') for any
// unknown value, so a bad DB row can never widen access.
export function capabilitiesFor(type: AccountType): Capabilities {
  return CAPABILITIES[type] ?? CAPABILITIES.standard
}
