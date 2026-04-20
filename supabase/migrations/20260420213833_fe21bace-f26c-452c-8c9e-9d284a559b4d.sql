-- ============================================================
-- 1. Add 'none' to assignment_mode enum
-- ============================================================
ALTER TYPE public.assignment_mode ADD VALUE IF NOT EXISTS 'none';

-- ============================================================
-- 2. Add response_type to assignments
-- ============================================================
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS response_type text
  CHECK (response_type IS NULL OR response_type IN ('acknowledge', 'text'));

-- ============================================================
-- 3. Make analysis_id nullable + add response_text on submissions
-- ============================================================
ALTER TABLE public.assignment_submissions
  ALTER COLUMN analysis_id DROP NOT NULL;

ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS response_text text;

-- ============================================================
-- 4. Update start_assignment RPC to handle 'none' mode
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_assignment(p_assignment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- No-house mode: just create a submission with null analysis
  IF v_assignment.mode = 'none' THEN
    INSERT INTO public.assignment_submissions (assignment_id, student_id, analysis_id)
    VALUES (p_assignment_id, v_user, NULL)
    RETURNING id INTO v_submission_id;

    RETURN jsonb_build_object('ok', true, 'submission_id', v_submission_id, 'analysis_id', NULL, 'already_started', false);
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
$function$;

-- ============================================================
-- 5. Attachments table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  parent_type text NOT NULL CHECK (parent_type IN ('assignment', 'submission', 'comment')),
  parent_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_parent_idx ON public.attachments (parent_type, parent_id);
CREATE INDEX IF NOT EXISTS attachments_owner_idx ON public.attachments (owner_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. Helper functions for attachment access
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_view_attachment(p_attachment_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_att public.attachments%ROWTYPE;
  v_classroom_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_att FROM public.attachments WHERE id = p_attachment_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Owner always
  IF v_att.owner_id = v_uid THEN RETURN true; END IF;

  IF v_att.parent_type = 'assignment' THEN
    SELECT classroom_id, teacher_id INTO v_classroom_id, v_teacher_id
      FROM public.assignments WHERE id = v_att.parent_id;
    IF v_teacher_id = v_uid THEN RETURN true; END IF;
    IF public.is_classroom_member(v_classroom_id) THEN RETURN true; END IF;
    RETURN false;

  ELSIF v_att.parent_type = 'submission' THEN
    SELECT s.student_id, a.teacher_id
      INTO v_student_id, v_teacher_id
      FROM public.assignment_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = v_att.parent_id;
    IF v_student_id = v_uid OR v_teacher_id = v_uid THEN RETURN true; END IF;
    RETURN false;

  ELSIF v_att.parent_type = 'comment' THEN
    -- Phase 4: same audience as parent submission. For now: owner-only fallback.
    RETURN false;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_attach_to(p_parent_type text, p_parent_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_classroom_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  IF p_parent_type = 'assignment' THEN
    SELECT teacher_id INTO v_teacher_id FROM public.assignments WHERE id = p_parent_id;
    RETURN v_teacher_id = v_uid;

  ELSIF p_parent_type = 'submission' THEN
    SELECT student_id INTO v_student_id FROM public.assignment_submissions WHERE id = p_parent_id;
    RETURN v_student_id = v_uid;

  ELSIF p_parent_type = 'comment' THEN
    RETURN true; -- Phase 4 will tighten
  END IF;

  RETURN false;
END;
$function$;

-- ============================================================
-- 7. RLS policies on attachments
-- ============================================================
DROP POLICY IF EXISTS attachments_select ON public.attachments;
CREATE POLICY attachments_select ON public.attachments
  FOR SELECT TO authenticated
  USING (public.can_view_attachment(id));

DROP POLICY IF EXISTS attachments_insert ON public.attachments;
CREATE POLICY attachments_insert ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.can_attach_to(parent_type, parent_id)
  );

DROP POLICY IF EXISTS attachments_delete_owner ON public.attachments;
CREATE POLICY attachments_delete_owner ON public.attachments
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS attachments_delete_teacher ON public.attachments;
CREATE POLICY attachments_delete_teacher ON public.attachments
  FOR DELETE TO authenticated
  USING (
    parent_type = 'assignment'
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = parent_id AND a.teacher_id = auth.uid())
  );

-- ============================================================
-- 8. Storage bucket + RLS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: look up an attachment row from a storage object name
CREATE OR REPLACE FUNCTION public.attachment_row_for_storage(p_name text)
 RETURNS public.attachments
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.attachments WHERE storage_path = p_name LIMIT 1;
$function$;

-- Storage policies
DROP POLICY IF EXISTS attachments_obj_select ON storage.objects;
CREATE POLICY attachments_obj_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.can_view_attachment((public.attachment_row_for_storage(name)).id)
  );

DROP POLICY IF EXISTS attachments_obj_insert ON storage.objects;
CREATE POLICY attachments_obj_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS attachments_obj_delete ON storage.objects;
CREATE POLICY attachments_obj_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.attachments a
        JOIN public.assignments asg ON asg.id = a.parent_id AND a.parent_type = 'assignment'
        WHERE a.storage_path = name AND asg.teacher_id = auth.uid()
      )
    )
  );