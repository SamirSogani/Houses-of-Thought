-- Harden _clone_analysis: add in-function authorization + revoke public execute
CREATE OR REPLACE FUNCTION public._clone_analysis(p_src_analysis_id uuid, p_target_user uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_analysis_id uuid;
  v_pov_map jsonb := '{}'::jsonb;
  v_sq_map jsonb := '{}'::jsonb;
  v_group_map jsonb := '{}'::jsonb;
  v_item_map jsonb := '{}'::jsonb;
  r record;
  v_new_id uuid;
BEGIN
  -- Authorization guards
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_target_user IS NULL OR p_target_user <> auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.analyses
     WHERE id = p_src_analysis_id
       AND (user_id = auth.uid() OR is_public = true)
  ) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

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
$function$;

-- Revoke public callable access. start_assignment is SECURITY DEFINER and runs as
-- function owner, so it can still invoke this helper internally.
REVOKE EXECUTE ON FUNCTION public._clone_analysis(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._clone_analysis(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public._clone_analysis(uuid, uuid) FROM authenticated;