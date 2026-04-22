-- 1. Add owner_account_type column to the three partitioned tables
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS owner_account_type public.account_type NOT NULL DEFAULT 'standard';

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS owner_account_type public.account_type NOT NULL DEFAULT 'teacher';

ALTER TABLE public.classroom_members
  ADD COLUMN IF NOT EXISTS owner_account_type public.account_type NOT NULL DEFAULT 'student';

-- 2. Backfill from each owner's current profile.account_type
UPDATE public.analyses a
  SET owner_account_type = COALESCE(p.account_type, 'standard')
  FROM public.profiles p
  WHERE p.user_id = a.user_id;

UPDATE public.classrooms c
  SET owner_account_type = COALESCE(p.account_type, 'teacher')
  FROM public.profiles p
  WHERE p.user_id = c.teacher_id;

UPDATE public.classroom_members m
  SET owner_account_type = COALESCE(p.account_type, 'student')
  FROM public.profiles p
  WHERE p.user_id = m.student_id;

-- 3. Helper: current_account_type()
CREATE OR REPLACE FUNCTION public.current_account_type()
RETURNS public.account_type
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_type FROM public.profiles WHERE user_id = auth.uid()
$$;

-- 4. Replace analyses owner policies (keep public_read & teacher_view_submission)
DROP POLICY IF EXISTS analyses_select ON public.analyses;
DROP POLICY IF EXISTS analyses_insert ON public.analyses;
DROP POLICY IF EXISTS analyses_update ON public.analyses;
DROP POLICY IF EXISTS analyses_delete ON public.analyses;

CREATE POLICY analyses_select ON public.analyses
  FOR SELECT
  USING (user_id = auth.uid() AND owner_account_type = public.current_account_type());

CREATE POLICY analyses_insert ON public.analyses
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND owner_account_type = public.current_account_type());

CREATE POLICY analyses_update ON public.analyses
  FOR UPDATE
  USING (user_id = auth.uid() AND owner_account_type = public.current_account_type());

CREATE POLICY analyses_delete ON public.analyses
  FOR DELETE
  USING (user_id = auth.uid() AND owner_account_type = public.current_account_type());

-- 5. Replace classrooms owner policies (keep classrooms_member_select)
DROP POLICY IF EXISTS classrooms_teacher_select ON public.classrooms;
DROP POLICY IF EXISTS classrooms_teacher_insert ON public.classrooms;
DROP POLICY IF EXISTS classrooms_teacher_update ON public.classrooms;
DROP POLICY IF EXISTS classrooms_teacher_delete ON public.classrooms;

CREATE POLICY classrooms_teacher_select ON public.classrooms
  FOR SELECT
  USING (teacher_id = auth.uid() AND owner_account_type = public.current_account_type());

CREATE POLICY classrooms_teacher_insert ON public.classrooms
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid() AND owner_account_type = public.current_account_type());

CREATE POLICY classrooms_teacher_update ON public.classrooms
  FOR UPDATE
  USING (teacher_id = auth.uid() AND owner_account_type = public.current_account_type());

CREATE POLICY classrooms_teacher_delete ON public.classrooms
  FOR DELETE
  USING (teacher_id = auth.uid() AND owner_account_type = public.current_account_type());

-- 6. Replace classroom_members self policies (keep teacher_select/teacher_delete cross-type)
DROP POLICY IF EXISTS members_self_select ON public.classroom_members;
DROP POLICY IF EXISTS members_self_delete ON public.classroom_members;

CREATE POLICY members_self_select ON public.classroom_members
  FOR SELECT
  USING (student_id = auth.uid() AND owner_account_type = public.current_account_type());

CREATE POLICY members_self_delete ON public.classroom_members
  FOR DELETE
  USING (student_id = auth.uid() AND owner_account_type = public.current_account_type());

-- 7. Update join_classroom to be partition-aware
CREATE OR REPLACE FUNCTION public.join_classroom(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_type public.account_type;
  v_classroom public.classrooms%ROWTYPE;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT account_type INTO v_type FROM public.profiles WHERE user_id = v_user;
  IF v_type IS NULL THEN v_type := 'standard'; END IF;

  -- Already in a classroom under THIS workspace?
  IF EXISTS (
    SELECT 1 FROM public.classroom_members
     WHERE student_id = v_user AND owner_account_type = v_type
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_in_classroom');
  END IF;

  SELECT * INTO v_classroom FROM public.classrooms WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  -- Cap check counts ALL members regardless of workspace
  IF v_classroom.student_cap IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.classroom_members WHERE classroom_id = v_classroom.id;
    IF v_count >= v_classroom.student_cap THEN
      RETURN jsonb_build_object('ok', false, 'error', 'classroom_full');
    END IF;
  END IF;

  INSERT INTO public.classroom_members (classroom_id, student_id, owner_account_type)
  VALUES (v_classroom.id, v_user, v_type);

  RETURN jsonb_build_object('ok', true, 'classroom_id', v_classroom.id, 'classroom_name', v_classroom.name);
END;
$$;

-- 8. Update leave_classroom to only delete current-workspace membership
CREATE OR REPLACE FUNCTION public.leave_classroom()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_type public.account_type;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT account_type INTO v_type FROM public.profiles WHERE user_id = v_user;
  IF v_type IS NULL THEN v_type := 'standard'; END IF;

  DELETE FROM public.classroom_members
   WHERE student_id = v_user AND owner_account_type = v_type;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 9. Update start_assignment: student-submission analyses always live in the Student workspace
CREATE OR REPLACE FUNCTION public.start_assignment(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_assignment public.assignments%ROWTYPE;
  v_analysis_id uuid;
  v_submission_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_assignment FROM public.assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'assignment_not_found');
  END IF;

  IF NOT public.is_classroom_member(v_assignment.classroom_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  SELECT id, analysis_id INTO v_submission_id, v_analysis_id
  FROM public.assignment_submissions
  WHERE assignment_id = p_assignment_id AND student_id = v_user;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'submission_id', v_submission_id, 'analysis_id', v_analysis_id, 'already_started', true);
  END IF;

  IF v_assignment.mode = 'none' THEN
    INSERT INTO public.assignment_submissions (assignment_id, student_id, analysis_id)
    VALUES (p_assignment_id, v_user, NULL)
    RETURNING id INTO v_submission_id;

    RETURN jsonb_build_object('ok', true, 'submission_id', v_submission_id, 'analysis_id', NULL, 'already_started', false);
  END IF;

  IF v_assignment.mode = 'template' AND v_assignment.template_analysis_id IS NOT NULL THEN
    v_analysis_id := public._clone_analysis(v_assignment.template_analysis_id, v_user);
    UPDATE public.analyses SET title = v_assignment.title WHERE id = v_analysis_id;
  ELSIF v_assignment.mode = 'prefilled' THEN
    INSERT INTO public.analyses (user_id, title, overarching_question, sub_purposes, owner_account_type)
    VALUES (v_user, v_assignment.title, COALESCE(v_assignment.prefilled_question, ''), COALESCE(v_assignment.prefilled_sub_purposes, ''), 'student')
    RETURNING id INTO v_analysis_id;
  ELSE
    INSERT INTO public.analyses (user_id, title, owner_account_type)
    VALUES (v_user, v_assignment.title, 'student')
    RETURNING id INTO v_analysis_id;
  END IF;

  INSERT INTO public.assignment_submissions (assignment_id, student_id, analysis_id)
  VALUES (p_assignment_id, v_user, v_analysis_id)
  RETURNING id INTO v_submission_id;

  UPDATE public.analyses SET assignment_submission_id = v_submission_id WHERE id = v_analysis_id;

  RETURN jsonb_build_object('ok', true, 'submission_id', v_submission_id, 'analysis_id', v_analysis_id, 'already_started', false);
END;
$$;

-- 10. Update _clone_analysis: cloned analyses land in target user's Student workspace
CREATE OR REPLACE FUNCTION public._clone_analysis(p_src_analysis_id uuid, p_target_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_analysis_id uuid;
  v_pov_map jsonb := '{}'::jsonb;
  v_sq_map jsonb := '{}'::jsonb;
  v_group_map jsonb := '{}'::jsonb;
  v_item_map jsonb := '{}'::jsonb;
  r record;
  v_new_id uuid;
BEGIN
  INSERT INTO public.analyses (
    user_id, title, purpose, sub_purposes, overarching_question, overarching_conclusion, consequences, is_draft, is_public, owner_account_type
  )
  SELECT p_target_user, title, purpose, sub_purposes, overarching_question, overarching_conclusion, consequences, false, false, 'student'
  FROM public.analyses WHERE id = p_src_analysis_id
  RETURNING id INTO v_new_analysis_id;

  INSERT INTO public.concepts (analysis_id, term, definition)
  SELECT v_new_analysis_id, term, definition FROM public.concepts WHERE analysis_id = p_src_analysis_id;

  FOR r IN SELECT * FROM public.pov_labels WHERE analysis_id = p_src_analysis_id LOOP
    INSERT INTO public.pov_labels (analysis_id, parent_category, label, sort_order)
    VALUES (v_new_analysis_id, r.parent_category, r.label, r.sort_order)
    RETURNING id INTO v_new_id;
    v_pov_map := v_pov_map || jsonb_build_object(r.id::text, v_new_id::text);
  END LOOP;

  FOR r IN SELECT * FROM public.sub_questions WHERE analysis_id = p_src_analysis_id LOOP
    INSERT INTO public.sub_questions (analysis_id, question, information, sub_conclusion, pov_category, pov_label_id, sort_order, is_draft)
    VALUES (
      v_new_analysis_id, r.question, r.information, r.sub_conclusion, r.pov_category,
      CASE WHEN r.pov_label_id IS NOT NULL AND v_pov_map ? r.pov_label_id::text
           THEN (v_pov_map ->> r.pov_label_id::text)::uuid
           ELSE NULL END,
      r.sort_order, r.is_draft
    )
    RETURNING id INTO v_new_id;
    v_sq_map := v_sq_map || jsonb_build_object(r.id::text, v_new_id::text);
  END LOOP;

  FOR r IN SELECT a.* FROM public.assumptions a
           JOIN public.sub_questions sq ON sq.id = a.sub_question_id
           WHERE sq.analysis_id = p_src_analysis_id LOOP
    IF v_sq_map ? r.sub_question_id::text THEN
      INSERT INTO public.assumptions (sub_question_id, assumption_type, content)
      VALUES ((v_sq_map ->> r.sub_question_id::text)::uuid, r.assumption_type, r.content);
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.staging_groups WHERE analysis_id = p_src_analysis_id LOOP
    INSERT INTO public.staging_groups (analysis_id, base_type, assumption_mode, name, sort_order)
    VALUES (v_new_analysis_id, r.base_type, r.assumption_mode, r.name, r.sort_order)
    RETURNING id INTO v_new_id;
    v_group_map := v_group_map || jsonb_build_object(r.id::text, v_new_id::text);
  END LOOP;

  FOR r IN SELECT * FROM public.staging_items WHERE analysis_id = p_src_analysis_id LOOP
    INSERT INTO public.staging_items (analysis_id, type, content, sort_order)
    VALUES (v_new_analysis_id, r.type, r.content, r.sort_order)
    RETURNING id INTO v_new_id;
    v_item_map := v_item_map || jsonb_build_object(r.id::text, v_new_id::text);
  END LOOP;

  FOR r IN SELECT gi.* FROM public.staging_group_items gi
           JOIN public.staging_groups g ON g.id = gi.group_id
           WHERE g.analysis_id = p_src_analysis_id LOOP
    IF v_group_map ? r.group_id::text AND v_item_map ? r.item_id::text THEN
      INSERT INTO public.staging_group_items (group_id, item_id, sort_order)
      VALUES (
        (v_group_map ->> r.group_id::text)::uuid,
        (v_item_map ->> r.item_id::text)::uuid,
        r.sort_order
      );
    END IF;
  END LOOP;

  RETURN v_new_analysis_id;
END;
$$;