
-- 1. Add profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS about_me text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location_context text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_project text NOT NULL DEFAULT '';

-- 2. Add is_public and draft fields to analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- 3. Add is_draft to sub_questions
ALTER TABLE public.sub_questions
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- 4. Create pov_labels table for nested categories
CREATE TABLE IF NOT EXISTS public.pov_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  parent_category text NOT NULL DEFAULT 'individual',
  label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pov_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pov_labels_select" ON public.pov_labels FOR SELECT USING (can_access_analysis(analysis_id));
CREATE POLICY "pov_labels_insert" ON public.pov_labels FOR INSERT WITH CHECK (can_access_analysis(analysis_id));
CREATE POLICY "pov_labels_update" ON public.pov_labels FOR UPDATE USING (can_access_analysis(analysis_id));
CREATE POLICY "pov_labels_delete" ON public.pov_labels FOR DELETE USING (can_access_analysis(analysis_id));

-- 5. Add pov_label_id to sub_questions for nested mapping
ALTER TABLE public.sub_questions
  ADD COLUMN IF NOT EXISTS pov_label_id uuid REFERENCES public.pov_labels(id) ON DELETE SET NULL;

-- 6. Public read policy for shared analyses
CREATE POLICY "analyses_public_read" ON public.analyses FOR SELECT USING (is_public = true);

-- 7. Public read for sub_questions of public analyses
CREATE OR REPLACE FUNCTION public.is_analysis_public(p_analysis_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.analyses WHERE id = p_analysis_id AND is_public = true);
$$;

CREATE POLICY "sub_questions_public_read" ON public.sub_questions FOR SELECT USING (is_analysis_public(analysis_id));
CREATE POLICY "concepts_public_read" ON public.concepts FOR SELECT USING (is_analysis_public(analysis_id));
CREATE POLICY "pov_labels_public_read" ON public.pov_labels FOR SELECT USING (is_analysis_public(analysis_id));
