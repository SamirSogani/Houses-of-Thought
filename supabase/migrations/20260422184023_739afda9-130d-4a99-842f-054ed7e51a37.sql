
-- =========================================================
-- Phase 4: Comments
-- =========================================================

-- 1. New enums
DO $$ BEGIN
  CREATE TYPE public.comment_target_type AS ENUM ('submission', 'inline', 'assignment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_audience AS ENUM ('one_way', 'two_way');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. assignments.comment_audience
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS comment_audience public.comment_audience NOT NULL DEFAULT 'two_way';

-- 3. comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  submission_id   uuid NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  analysis_id     uuid NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  target_type     public.comment_target_type NOT NULL,
  target_kind     text NULL,
  target_id       uuid NULL,
  author_id       uuid NOT NULL DEFAULT auth.uid(),
  author_role     text NOT NULL CHECK (author_role IN ('teacher','student')),
  body            text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  resolved_at     timestamptz NULL,
  resolved_by     uuid NULL,
  edited_at       timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_assignment ON public.comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_comments_submission ON public.comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_comments_target ON public.comments(target_type, target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_analysis ON public.comments(analysis_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 4. comment_reads table
CREATE TABLE IF NOT EXISTS public.comment_reads (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid(),
  read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reads_user ON public.comment_reads(user_id);

ALTER TABLE public.comment_reads ENABLE ROW LEVEL SECURITY;

-- 5. Helper functions

-- Can the current user view a given comment row?
CREATE OR REPLACE FUNCTION public.can_view_comment(p_comment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_assignment_id uuid;
  v_submission_id uuid;
  v_target public.comment_target_type;
  v_classroom_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT c.assignment_id, c.submission_id, c.target_type
    INTO v_assignment_id, v_submission_id, v_target
    FROM public.comments c WHERE c.id = p_comment_id;
  IF v_assignment_id IS NULL THEN RETURN false; END IF;

  SELECT a.classroom_id, a.teacher_id INTO v_classroom_id, v_teacher_id
    FROM public.assignments a WHERE a.id = v_assignment_id;

  IF v_teacher_id = v_uid THEN RETURN true; END IF;

  IF v_target = 'assignment' THEN
    RETURN public.is_classroom_member(v_classroom_id);
  END IF;

  -- submission / inline
  IF v_submission_id IS NOT NULL THEN
    SELECT s.student_id INTO v_student_id
      FROM public.assignment_submissions s WHERE s.id = v_submission_id;
    RETURN v_student_id = v_uid;
  END IF;

  RETURN false;
END;
$$;

-- Can the current user post on a given thread context?
CREATE OR REPLACE FUNCTION public.can_post_comment(
  p_assignment_id uuid,
  p_target_type public.comment_target_type,
  p_submission_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher_id uuid;
  v_audience public.comment_audience;
  v_classroom_id uuid;
  v_student_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT a.teacher_id, a.comment_audience, a.classroom_id
    INTO v_teacher_id, v_audience, v_classroom_id
    FROM public.assignments a WHERE a.id = p_assignment_id;
  IF v_teacher_id IS NULL THEN RETURN false; END IF;

  -- Teacher: always allowed on own assignment
  IF v_teacher_id = v_uid THEN RETURN true; END IF;

  -- Students: only on submission/inline, only when two-way, only on their own submission
  IF p_target_type IN ('submission','inline') THEN
    IF v_audience <> 'two_way' THEN RETURN false; END IF;
    IF p_submission_id IS NULL THEN RETURN false; END IF;
    SELECT s.student_id INTO v_student_id
      FROM public.assignment_submissions s WHERE s.id = p_submission_id;
    RETURN v_student_id = v_uid;
  END IF;

  -- Assignment-wide: students cannot post in Phase 4
  RETURN false;
END;
$$;

-- 6. RLS policies on comments

DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO authenticated
  USING (public.can_view_comment(id));

DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_post_comment(assignment_id, target_type, submission_id)
  );

-- Author edits body/edited_at; student-on-own-submission can toggle resolved_*.
-- We can't easily restrict per-column in policy; rely on RPCs for those mutations.
-- This UPDATE policy permits: author OR teacher-of-assignment OR student-of-submission.
DROP POLICY IF EXISTS comments_update ON public.comments;
CREATE POLICY comments_update ON public.comments
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = comments.assignment_id AND a.teacher_id = auth.uid())
    OR (
      comments.target_type IN ('submission','inline')
      AND comments.submission_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.assignment_submissions s
        WHERE s.id = comments.submission_id AND s.student_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS comments_delete ON public.comments;
CREATE POLICY comments_delete ON public.comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = comments.assignment_id AND a.teacher_id = auth.uid())
  );

-- 7. RLS policies on comment_reads

DROP POLICY IF EXISTS comment_reads_select ON public.comment_reads;
CREATE POLICY comment_reads_select ON public.comment_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS comment_reads_insert ON public.comment_reads;
CREATE POLICY comment_reads_insert ON public.comment_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_comment(comment_id));

DROP POLICY IF EXISTS comment_reads_delete ON public.comment_reads;
CREATE POLICY comment_reads_delete ON public.comment_reads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 8. RPCs

CREATE OR REPLACE FUNCTION public.post_comment(
  p_assignment_id uuid,
  p_target_type public.comment_target_type,
  p_target_kind text,
  p_target_id uuid,
  p_submission_id uuid,
  p_analysis_id uuid,
  p_body text
) RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher uuid;
  v_role text;
  v_row public.comments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'empty_body'; END IF;
  IF length(p_body) > 5000 THEN RAISE EXCEPTION 'body_too_long'; END IF;

  IF NOT public.can_post_comment(p_assignment_id, p_target_type, p_submission_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT teacher_id INTO v_teacher FROM public.assignments WHERE id = p_assignment_id;
  v_role := CASE WHEN v_teacher = v_uid THEN 'teacher' ELSE 'student' END;

  -- Sanity: submission/inline must have submission_id
  IF p_target_type IN ('submission','inline') AND p_submission_id IS NULL THEN
    RAISE EXCEPTION 'missing_submission';
  END IF;

  INSERT INTO public.comments (
    assignment_id, submission_id, analysis_id, target_type,
    target_kind, target_id, author_id, author_role, body
  ) VALUES (
    p_assignment_id, p_submission_id, p_analysis_id, p_target_type,
    p_target_kind, p_target_id, v_uid, v_role, p_body
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_comment(p_id uuid, p_body text)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.comments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'empty_body'; END IF;
  IF length(p_body) > 5000 THEN RAISE EXCEPTION 'body_too_long'; END IF;

  SELECT * INTO v_row FROM public.comments WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_row.author_id <> v_uid THEN RAISE EXCEPTION 'not_author'; END IF;

  UPDATE public.comments
    SET body = p_body, edited_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_comment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid;
  v_assignment uuid;
  v_teacher uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT author_id, assignment_id INTO v_author, v_assignment FROM public.comments WHERE id = p_id;
  IF v_author IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;

  SELECT teacher_id INTO v_teacher FROM public.assignments WHERE id = v_assignment;
  IF v_author <> v_uid AND v_teacher <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_allowed');
  END IF;

  DELETE FROM public.comments WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_comment(p_id uuid)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.comments;
  v_student uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.comments WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_row.target_type NOT IN ('submission','inline') THEN RAISE EXCEPTION 'not_resolvable'; END IF;
  IF v_row.submission_id IS NULL THEN RAISE EXCEPTION 'not_resolvable'; END IF;

  SELECT student_id INTO v_student FROM public.assignment_submissions WHERE id = v_row.submission_id;
  IF v_student <> v_uid THEN RAISE EXCEPTION 'not_student_owner'; END IF;

  UPDATE public.comments
    SET resolved_at = now(), resolved_by = v_uid
    WHERE id = p_id
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.unresolve_comment(p_id uuid)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.comments;
  v_student uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.comments WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_row.submission_id IS NULL THEN RAISE EXCEPTION 'not_resolvable'; END IF;

  SELECT student_id INTO v_student FROM public.assignment_submissions WHERE id = v_row.submission_id;
  IF v_student <> v_uid THEN RAISE EXCEPTION 'not_student_owner'; END IF;

  UPDATE public.comments
    SET resolved_at = NULL, resolved_by = NULL
    WHERE id = p_id
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_comments_read(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'marked', 0);
  END IF;

  INSERT INTO public.comment_reads (comment_id, user_id)
  SELECT c.id, v_uid
  FROM public.comments c
  WHERE c.id = ANY(p_ids)
    AND public.can_view_comment(c.id)
  ON CONFLICT (comment_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unread_comment_counts()
RETURNS TABLE(assignment_id uuid, submission_id uuid, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.assignment_id, c.submission_id, count(*)::bigint
  FROM public.comments c
  WHERE public.can_view_comment(c.id)
    AND c.author_id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.comment_reads r
       WHERE r.comment_id = c.id AND r.user_id = auth.uid()
    )
  GROUP BY c.assignment_id, c.submission_id;
$$;

-- 9. Wire up the previously-stubbed 'comment' branch in attachment helpers
CREATE OR REPLACE FUNCTION public.can_view_attachment(p_attachment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    RETURN public.can_view_comment(v_att.parent_id);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_attach_to(p_parent_type text, p_parent_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher_id uuid;
  v_student_id uuid;
  v_author uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  IF p_parent_type = 'assignment' THEN
    SELECT teacher_id INTO v_teacher_id FROM public.assignments WHERE id = p_parent_id;
    RETURN v_teacher_id = v_uid;

  ELSIF p_parent_type = 'submission' THEN
    SELECT student_id INTO v_student_id FROM public.assignment_submissions WHERE id = p_parent_id;
    RETURN v_student_id = v_uid;

  ELSIF p_parent_type = 'comment' THEN
    SELECT author_id INTO v_author FROM public.comments WHERE id = p_parent_id;
    RETURN v_author = v_uid;
  END IF;

  RETURN false;
END;
$$;

-- 10. Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.comment_reads REPLICA IDENTITY FULL;
