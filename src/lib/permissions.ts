import type { Tables } from "@/integrations/supabase/types";

export type AccountType = "standard" | "student" | "teacher";

export type Profile = Tables<"profiles">;

/**
 * Single source of truth for what each account type can do.
 * Phase 1: only `standard`, `student`, and `teacher` exist.
 *
 * Add new gates here — never hardcode account-type checks elsewhere.
 */
export interface Permissions {
  /** Show the AI chat sidebar (FAB + sheet). */
  canUseAISidebar: boolean;
  /** Use the "Draft Full House" Gemini-powered generator. */
  canUseDraftFullHouse: boolean;
  /** Use the AI sidebar's Auto-Implement toggle. */
  canUseAutoImplement: boolean;
  /** Show the dedicated Research Mode panel on the right side (Brave Search). */
  canUseResearchPanel: boolean;
  /** Use Logic Strength Meter. */
  canUseLogicStrength: boolean;
  /** Use Reasoning Stress Test / Attack Mode. */
  canUseStressTest: boolean;
  /** Teacher: create and manage classrooms. */
  canCreateClassrooms: boolean;
  /** Student: join a classroom via code. */
  canJoinClassroom: boolean;
  /** Teacher: create assignments inside their classrooms. */
  canCreateAssignments: boolean;
  /** Student: start/submit assignments in their classroom. */
  canStartAssignments: boolean;
}

const STANDARD_PERMISSIONS: Permissions = {
  canUseAISidebar: true,
  canUseDraftFullHouse: true,
  canUseAutoImplement: true,
  canUseResearchPanel: false, // Standard accounts use Research inside the AI sidebar
  canUseLogicStrength: true,
  canUseStressTest: true,
  canCreateClassrooms: false,
  canJoinClassroom: false,
  canCreateAssignments: false,
  canStartAssignments: false,
};

const TEACHER_PERMISSIONS: Permissions = {
  // Phase 1: Teacher UI is identical to Standard, plus classroom management.
  ...STANDARD_PERMISSIONS,
  canCreateClassrooms: true,
  canCreateAssignments: true,
};

const STUDENT_PERMISSIONS: Permissions = {
  canUseAISidebar: false,        // No AI sidebar at all for students
  canUseDraftFullHouse: false,   // Locked with 🔒
  canUseAutoImplement: false,    // Locked (and lives inside the sidebar anyway)
  canUseResearchPanel: true,     // Dedicated Research panel replaces sidebar research
  canUseLogicStrength: true,
  canUseStressTest: true,
  canCreateClassrooms: false,
  canJoinClassroom: true,
  canCreateAssignments: false,
  canStartAssignments: true,
};

export function getAccountType(profile: Profile | null | undefined): AccountType {
  const t = (profile as any)?.account_type;
  if (t === "student" || t === "teacher" || t === "standard") return t;
  return "standard";
}

export function getPermissions(profile: Profile | null | undefined): Permissions {
  const type = getAccountType(profile);
  if (type === "student") return STUDENT_PERMISSIONS;
  if (type === "teacher") return TEACHER_PERMISSIONS;
  return STANDARD_PERMISSIONS;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  standard: "Standard",
  student: "Student",
  teacher: "Teacher",
};

export const ACCOUNT_TYPE_DESCRIPTIONS: Record<AccountType, string> = {
  standard: "Full access to every feature, including the AI assistant and Draft Full House.",
  student: "Built for classroom learning. Research Mode, Logic Strength, and Stress Test are available. The AI assistant and Draft Full House are not.",
  teacher: "Full access for educators. Same features as Standard.",
};
