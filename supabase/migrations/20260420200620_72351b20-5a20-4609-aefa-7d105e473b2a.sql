-- =====================================================
-- Phase 2: Classrooms foundation
-- =====================================================

-- 1. Tables
CREATE TABLE public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Untitled Classroom',
  code text NOT NULL UNIQUE,
  student_cap integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classrooms_teacher ON public.classrooms(teacher_id);
CREATE INDEX idx_classrooms_code ON public.classrooms(code);

CREATE TABLE public.classroom_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id),
  UNIQUE (student_id) -- enforce one classroom per student
);

CREATE INDEX idx_classroom_members_classroom ON public.classroom_members(classroom_id);
CREATE INDEX idx_classroom_members_student ON public.classroom_members(student_id);

-- 2. Enable RLS
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;

-- 3. Helper SECURITY DEFINER functions (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_classroom_owner(p_classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms WHERE id = p_classroom_id AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_classroom_member(p_classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_members
    WHERE classroom_id = p_classroom_id AND student_id = auth.uid()
  );
$$;

-- 4. Code generator: HT-XXXX, excluding 0/O/1/I/L
CREATE OR REPLACE FUNCTION public.generate_classroom_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    result := 'HT-';
    FOR i IN 1..4 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.classrooms WHERE code = result);
    attempts := attempts + 1;
    IF attempts > 25 THEN
      RAISE EXCEPTION 'Could not generate unique classroom code';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- 5. Trigger to auto-generate code if blank
CREATE OR REPLACE FUNCTION public.classroom_set_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_classroom_code();
  ELSE
    NEW.code := upper(NEW.code);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_classroom_set_code
BEFORE INSERT ON public.classrooms
FOR EACH ROW EXECUTE FUNCTION public.classroom_set_code();

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_classrooms_updated_at
BEFORE UPDATE ON public.classrooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS policies — classrooms
CREATE POLICY classrooms_teacher_select
  ON public.classrooms FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY classrooms_member_select
  ON public.classrooms FOR SELECT
  USING (public.is_classroom_member(id));

CREATE POLICY classrooms_teacher_insert
  ON public.classrooms FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY classrooms_teacher_update
  ON public.classrooms FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY classrooms_teacher_delete
  ON public.classrooms FOR DELETE
  USING (teacher_id = auth.uid());

-- 8. RLS policies — classroom_members
-- Students see their own membership row; teachers see all members of their classrooms
CREATE POLICY members_self_select
  ON public.classroom_members FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY members_teacher_select
  ON public.classroom_members FOR SELECT
  USING (public.is_classroom_owner(classroom_id));

-- No direct INSERT — must go through join_classroom()
-- Students delete via leave_classroom(); teachers can remove members directly
CREATE POLICY members_teacher_delete
  ON public.classroom_members FOR DELETE
  USING (public.is_classroom_owner(classroom_id));

CREATE POLICY members_self_delete
  ON public.classroom_members FOR DELETE
  USING (student_id = auth.uid());

-- 9. Join function — validates code, cap, single-classroom rule
CREATE OR REPLACE FUNCTION public.join_classroom(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_classroom public.classrooms%ROWTYPE;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Already in a classroom?
  IF EXISTS (SELECT 1 FROM public.classroom_members WHERE student_id = v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_in_classroom');
  END IF;

  SELECT * INTO v_classroom FROM public.classrooms WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  -- Cap check
  IF v_classroom.student_cap IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.classroom_members WHERE classroom_id = v_classroom.id;
    IF v_count >= v_classroom.student_cap THEN
      RETURN jsonb_build_object('ok', false, 'error', 'classroom_full');
    END IF;
  END IF;

  INSERT INTO public.classroom_members (classroom_id, student_id) VALUES (v_classroom.id, v_user);

  RETURN jsonb_build_object('ok', true, 'classroom_id', v_classroom.id, 'classroom_name', v_classroom.name);
END;
$$;

-- 10. Leave function
CREATE OR REPLACE FUNCTION public.leave_classroom()
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
  DELETE FROM public.classroom_members WHERE student_id = v_user;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 11. Regenerate code function
CREATE OR REPLACE FUNCTION public.regenerate_classroom_code(p_classroom_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_code text;
BEGIN
  IF NOT public.is_classroom_owner(p_classroom_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;
  v_new_code := public.generate_classroom_code();
  UPDATE public.classrooms SET code = v_new_code, updated_at = now() WHERE id = p_classroom_id;
  RETURN jsonb_build_object('ok', true, 'code', v_new_code);
END;
$$;