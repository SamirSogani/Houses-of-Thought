CREATE OR REPLACE FUNCTION public.can_attach_to(p_parent_type text, p_parent_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
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
    -- Phase 4 will implement comment ownership checks. Locked until then.
    RETURN false;
  END IF;

  RETURN false;
END;
$function$;