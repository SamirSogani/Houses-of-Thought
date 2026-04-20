-- =========================================================
-- Phase 3: Assignments
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.assignment_mode AS ENUM ('empty', 'prefilled', 'template');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM ('in_progress', 'submitted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- assignments ----------
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled Assignment',
  prompt text NOT NULL DEFAULT '',
  due_at timestamptz,
  mode public.assignment_mode NOT NULL DEFAULT 'empty',
  prefilled_question text,
  prefilled_sub_purposes text,
  template_analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_classroom ON public.assignments(classroom_id);
CREATE INDEX idx_assignments_teacher ON public.assignments(teacher_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_teacher_select"
  ON public.assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "assignments_teacher_insert"
  ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.is_classroom_owner(classroom_id));

CREATE POLICY "assignments_teacher_update"
  ON public.assignments FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "assignments_teacher_delete"
  ON public.assignments FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "assignments_student_select"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.is_classroom_member(classroom_id));

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- assignment_submissions ----------
CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  status public.submission_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX idx_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON public.assignment_submissions(student_id);
CREATE INDEX idx_submissions_analysis ON public.assignment_submissions(analysis_id);

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Block all direct inserts; only the start_assignment SECURITY DEFINER RPC may insert.
CREATE POLICY "submissions_block_direct_insert"
  ON public.assignment_submissions AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "submissions_student_select"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "submissions_student_update"
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- Teacher access via owning the parent assignment
CREATE OR REPLACE FUNCTION public.is_assignment_owner(p_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.assignments WHERE id = p_assignment_id AND teacher_id = auth.uid());
$$;

CREATE POLICY "submissions_teacher_select"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (public.is_assignment_owner(assignment_id));

CREATE POLICY "submissions_teacher_delete"
  ON public.assignment_submissions FOR DELETE TO authenticated
  USING (public.is_assignment_owner(assignment_id));

-- ---------- analyses: assignment_submission_id ----------
ALTER TABLE public.analyses
  ADD COLUMN assignment_submission_id uuid REFERENCES public.assignment_submissions(id) ON DELETE SET NULL;
CREATE INDEX idx_analyses_submission ON public.analyses(assignment_submission_id);

-- ---------- Teacher read access via submission ----------
CREATE OR REPLACE FUNCTION public.can_teacher_view_analysis(p_analysis_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.classroom_members m ON m.classroom_id = a.classroom_id AND m.student_id = s.student_id
    WHERE s.analysis_id = p_analysis_id
      AND a.teacher_id = auth.uid()
  );
$$;

CREATE POLICY "analyses_teacher_view_submission"
  ON public.analyses FOR SELECT TO authenticated
  USING (public.can_teacher_view_analysis(id));

CREATE POLICY "concepts_teacher_view_submission"
  ON public.concepts FOR SELECT TO authenticated
  USING (public.can_teacher_view_analysis(analysis_id));

CREATE POLICY "sub_questions_teacher_view_submission"
  ON public.sub_questions FOR SELECT TO authenticated
  USING (public.can_teacher_view_analysis(analysis_id));

CREATE POLICY "pov_labels_teacher_view_submission"
  ON public.pov_labels FOR SELECT TO authenticated
  USING (public.can_teacher_view_analysis(analysis_id));

CREATE POLICY "assumptions_teacher_view_submission"
  ON public.assumptions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sub_questions sq
    WHERE sq.id = assumptions.sub_question_id
      AND public.can_teacher_view_analysis(sq.analysis_id)
  ));

CREATE POLICY "staging_groups_teacher_view_submission"
  ON public.staging_groups FOR SELECT TO authenticated
  USING (public.can_teacher_view_analysis(analysis_id));

CREATE POLICY "staging_items_teacher_view_submission"
  ON public.staging_items FOR SELECT TO authenticated
  USING (public.can_teacher_view_analysis(analysis_id));

CREATE POLICY "staging_group_items_teacher_view_submission"
  ON public.staging_group_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staging_groups g
    WHERE g.id = staging_group_items.group_id
      AND public.can_teacher_view_analysis(g.analysis_id)
  ));

-- ---------- Clone helper ----------
CREATE OR REPLACE FUNCTION public._clone_analysis(p_src_analysis_id uuid, p_target_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_analysis_id uuid;
  v_pov_map jsonb := '{}'::jsonb;
  v_sq_map jsonb := '{}'::jsonb;
  v_group_map jsonb := '{}'::jsonb;
  v_item_map jsonb := '{}'::jsonb;
  r record;
  v_new_id uuid;
BEGIN
  -- New analysis
  INSERT INTO public.analyses (
    user_id, title, purpose, sub_purposes, overarching_question, overarching_conclusion, consequences, is_draft, is_public
  )
  SELECT p_target_user, title, purpose, sub_purposes, overarching_question, overarching_conclusion, consequences, false, false
  FROM public.analyses WHERE id = p_src_analysis_id
  RETURNING id INTO v_new_analysis_id;

  -- Concepts
  INSERT INTO public.concepts (analysis_id, term, definition)
  SELECT v_new_analysis_id, term, definition FROM public.concepts WHERE analysis_id = p_src_analysis_id;

  -- POV labels (build id map)
  FOR r IN SELECT * FROM public.pov_labels WHERE analysis_id = p_src_analysis_id LOOP
    INSERT INTO public.pov_labels (analysis_id, parent_category, label, sort_order)
    VALUES (v_new_analysis_id, r.parent_category, r.label, r.sort_order)
    RETURNING id INTO v_new_id;
    v_pov_map := v_pov_map || jsonb_build_object(r.id::text, v_new_id::text);
  END LOOP;

  -- Sub-questions (remap pov_label_id; build sq id map)
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

  -- Assumptions (remap sub_question_id)
  FOR r IN SELECT a.* FROM public.assumptions a
           JOIN public.sub_questions sq ON sq.id = a.sub_question_id
           WHERE sq.analysis_id = p_src_analysis_id LOOP
    IF v_sq_map ? r.sub_question_id::text THEN
      INSERT INTO public.assumptions (sub_question_id, assumption_type, content)
      VALUES ((v_sq_map ->> r.sub_question_id::text)::uuid, r.assumption_type, r.content);
    END IF;
  END LOOP;

  -- Staging groups (build map)
  FOR r IN SELECT * FROM public.staging_groups WHERE analysis_id = p_src_analysis_id LOOP
    INSERT INTO public.staging_groups (analysis_id, base_type, assumption_mode, name, sort_order)
    VALUES (v_new_analysis_id, r.base_type, r.assumption_mode, r.name, r.sort_order)
    RETURNING id INTO v_new_id;
    v_group_map := v_group_map || jsonb_build_object(r.id::text, v_new_id::text);
  END LOOP;

  -- Staging items (build map)
  FOR r IN SELECT * FROM public.staging_items WHERE analysis_id = p_src_analysis_id LOOP
    INSERT INTO public.staging_items (analysis_id, type, content, sort_order)
    VALUES (v_new_analysis_id, r.type, r.content, r.sort_order)
    RETURNING id INTO v_new_id;
    v_item_map := v_item_map || jsonb_build_object(r.id::text, v_new_id::text);
  END LOOP;

  -- Staging group items (remap both)
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

-- ---------- start_assignment RPC ----------
CREATE OR REPLACE FUNCTION public.start_assignment(p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- Already started?
  SELECT id, analysis_id INTO v_submission_id, v_analysis_id
  FROM public.assignment_submissions
  WHERE assignment_id = p_assignment_id AND student_id = v_user;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'submission_id', v_submission_id, 'analysis_id', v_analysis_id, 'already_started', true);
  END IF;

  -- Create the analysis based on mode
  IF v_assignment.mode = 'template' AND v_assignment.template_analysis_id IS NOT NULL THEN
    v_analysis_id := public._clone_analysis(v_assignment.template_analysis_id, v_user);
    UPDATE public.analyses SET title = v_assignment.title WHERE id = v_analysis_id;
  ELSIF v_assignment.mode = 'prefilled' THEN
    INSERT INTO public.analyses (user_id, title, overarching_question, sub_purposes)
    VALUES (v_user, v_assignment.title, COALESCE(v_assignment.prefilled_question, ''), COALESCE(v_assignment.prefilled_sub_purposes, ''))
    RETURNING id INTO v_analysis_id;
  ELSE
    INSERT INTO public.analyses (user_id, title)
    VALUES (v_user, v_assignment.title)
    RETURNING id INTO v_analysis_id;
  END IF;

  INSERT INTO public.assignment_submissions (assignment_id, student_id, analysis_id)
  VALUES (p_assignment_id, v_user, v_analysis_id)
  RETURNING id INTO v_submission_id;

  UPDATE public.analyses SET assignment_submission_id = v_submission_id WHERE id = v_analysis_id;

  RETURN jsonb_build_object('ok', true, 'submission_id', v_submission_id, 'analysis_id', v_analysis_id, 'already_started', false);
END;
$$;

-- ---------- submit / unsubmit RPCs ----------
CREATE OR REPLACE FUNCTION public.submit_assignment(p_submission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_owner uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT student_id INTO v_owner FROM public.assignment_submissions WHERE id = p_submission_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_owner <> v_user THEN RETURN jsonb_build_object('ok', false, 'error', 'not_owner'); END IF;
  UPDATE public.assignment_submissions
    SET status = 'submitted', submitted_at = now()
    WHERE id = p_submission_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unsubmit_assignment(p_submission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_owner uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT student_id INTO v_owner FROM public.assignment_submissions WHERE id = p_submission_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_owner <> v_user THEN RETURN jsonb_build_object('ok', false, 'error', 'not_owner'); END IF;
  UPDATE public.assignment_submissions
    SET status = 'in_progress', submitted_at = NULL
    WHERE id = p_submission_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;