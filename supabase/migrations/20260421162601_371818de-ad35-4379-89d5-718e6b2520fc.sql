-- Add username column to profiles (unique, case-insensitive, 3-30 chars)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Validate format via trigger (length + allowed chars). Nullable allowed so
-- existing users are not blocked until they pick one.
CREATE OR REPLACE FUNCTION public.validate_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := trim(NEW.username);
    IF NEW.username = '' THEN
      NEW.username := NULL;
    ELSIF char_length(NEW.username) < 3 OR char_length(NEW.username) > 30 THEN
      RAISE EXCEPTION 'Username must be between 3 and 30 characters';
    ELSIF NEW.username !~ '^[A-Za-z0-9_.-]+$' THEN
      RAISE EXCEPTION 'Username may only contain letters, numbers, underscore, dot, and dash';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_username ON public.profiles;
CREATE TRIGGER profiles_validate_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_username();

-- Teachers can read (user_id, username) of their classroom members so rosters
-- and submissions display real names. Limits by membership so it's not a
-- global directory.
DROP POLICY IF EXISTS profiles_classroom_teacher_select ON public.profiles;
CREATE POLICY profiles_classroom_teacher_select
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_members m
      JOIN public.classrooms c ON c.id = m.classroom_id
      WHERE m.student_id = profiles.user_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Update handle_new_user to capture username from auth metadata if present
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'username', '')), '');
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, v_username)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;