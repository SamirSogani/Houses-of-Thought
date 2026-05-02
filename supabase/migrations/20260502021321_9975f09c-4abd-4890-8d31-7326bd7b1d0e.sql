
-- Prevent privilege escalation via profiles.account_type self-update.
-- Users may still update their own profile, but cannot change account_type
-- (or user_id) directly. Account type changes go through a SECURITY DEFINER RPC.

DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_update
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND account_type = (SELECT p.account_type FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Also tighten INSERT so a brand-new profile row cannot be inserted as 'teacher'
-- (a row created via handle_new_user trigger already defaults to 'standard').
DROP POLICY IF EXISTS profiles_insert ON public.profiles;

CREATE POLICY profiles_insert
ON public.profiles
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND account_type = 'standard'::public.account_type
);

-- Server-side controlled account-type switch. Free for users to call,
-- but routed through a definer function so we can add guardrails later
-- (audit logging, rate limits, role-based admin overrides, etc.).
CREATE OR REPLACE FUNCTION public.set_account_type(p_new_type public.account_type)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_new_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_type');
  END IF;

  INSERT INTO public.profiles (user_id, account_type, updated_at)
  VALUES (v_user, p_new_type, now())
  ON CONFLICT (user_id) DO UPDATE
    SET account_type = EXCLUDED.account_type,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'account_type', p_new_type);
END;
$$;

REVOKE ALL ON FUNCTION public.set_account_type(public.account_type) FROM public;
GRANT EXECUTE ON FUNCTION public.set_account_type(public.account_type) TO authenticated;
