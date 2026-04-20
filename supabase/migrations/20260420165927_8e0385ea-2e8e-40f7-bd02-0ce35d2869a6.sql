-- Staging items: individual pieces of material a user has parked above the house
CREATE TABLE public.staging_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'information',
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.staging_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staging_items_select"
  ON public.staging_items FOR SELECT
  USING (public.can_access_analysis(analysis_id));

CREATE POLICY "staging_items_insert"
  ON public.staging_items FOR INSERT
  WITH CHECK (public.can_access_analysis(analysis_id));

CREATE POLICY "staging_items_update"
  ON public.staging_items FOR UPDATE
  USING (public.can_access_analysis(analysis_id));

CREATE POLICY "staging_items_delete"
  ON public.staging_items FOR DELETE
  USING (public.can_access_analysis(analysis_id));

CREATE INDEX idx_staging_items_analysis ON public.staging_items(analysis_id);

-- Staging groups: named sections that bundle multiple staging items
CREATE TABLE public.staging_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  base_type TEXT NOT NULL DEFAULT 'information',
  assumption_mode TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.staging_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staging_groups_select"
  ON public.staging_groups FOR SELECT
  USING (public.can_access_analysis(analysis_id));

CREATE POLICY "staging_groups_insert"
  ON public.staging_groups FOR INSERT
  WITH CHECK (public.can_access_analysis(analysis_id));

CREATE POLICY "staging_groups_update"
  ON public.staging_groups FOR UPDATE
  USING (public.can_access_analysis(analysis_id));

CREATE POLICY "staging_groups_delete"
  ON public.staging_groups FOR DELETE
  USING (public.can_access_analysis(analysis_id));

CREATE INDEX idx_staging_groups_analysis ON public.staging_groups(analysis_id);

-- Join table: which items belong to which group (an item may belong to many groups)
CREATE TABLE public.staging_group_items (
  group_id UUID NOT NULL REFERENCES public.staging_groups(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.staging_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, item_id)
);

ALTER TABLE public.staging_group_items ENABLE ROW LEVEL SECURITY;

-- Helper: access through the parent group's analysis
CREATE OR REPLACE FUNCTION public.can_access_staging_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staging_groups g
    WHERE g.id = p_group_id AND public.can_access_analysis(g.analysis_id)
  );
$$;

CREATE POLICY "staging_group_items_select"
  ON public.staging_group_items FOR SELECT
  USING (public.can_access_staging_group(group_id));

CREATE POLICY "staging_group_items_insert"
  ON public.staging_group_items FOR INSERT
  WITH CHECK (public.can_access_staging_group(group_id));

CREATE POLICY "staging_group_items_update"
  ON public.staging_group_items FOR UPDATE
  USING (public.can_access_staging_group(group_id));

CREATE POLICY "staging_group_items_delete"
  ON public.staging_group_items FOR DELETE
  USING (public.can_access_staging_group(group_id));