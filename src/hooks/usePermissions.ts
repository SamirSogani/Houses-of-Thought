import { useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { getPermissions, getAccountType, type Permissions, type AccountType } from "@/lib/permissions";

type Profile = Tables<"profiles">;

export interface UsePermissionsResult {
  accountType: AccountType;
  permissions: Permissions;
}

/** Reusable hook — pass the loaded profile and get back gating info. */
export function usePermissions(profile: Profile | null | undefined): UsePermissionsResult {
  return useMemo(
    () => ({
      accountType: getAccountType(profile),
      permissions: getPermissions(profile),
    }),
    [profile]
  );
}
