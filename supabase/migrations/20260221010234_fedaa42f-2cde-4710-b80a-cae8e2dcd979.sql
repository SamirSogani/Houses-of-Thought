-- Tables first

-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  biological text NOT NULL DEFAULT '',
  social text NOT NULL DEFAULT '',
  familial text NOT NULL DEFAULT '',
  individual text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Analyses table
CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled Analysis',
  purpose text NOT NULL DEFAULT '',
  sub_purposes text NOT NULL DEFAULT '',
  overarching_question text NOT NULL DEFAULT '',
  overarching_conclusion text NOT NULL DEFAULT '',
  consequences text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyses_select" ON public.analyses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "analyses_insert" ON public.analyses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "analyses_update" ON public.analyses FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "analyses_delete" ON public.analyses FOR DELETE USING (user_id = auth.uid());

-- Sub-questions table
CREATE TABLE public.sub_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  pov_category text NOT NULL DEFAULT 'individual',
  information text NOT NULL DEFAULT '',
  sub_conclusion text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sub_questions ENABLE ROW LEVEL SECURITY;

-- Concepts table
CREATE TABLE public.concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  term text NOT NULL DEFAULT '',
  definition text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

-- Assumptions table
CREATE TABLE public.assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_question_id uuid NOT NULL REFERENCES public.sub_questions(id) ON DELETE CASCADE,
  assumption_type text NOT NULL DEFAULT 'unknown_unknowns',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;

-- Now helper functions
CREATE OR REPLACE FUNCTION public.can_access_analysis(p_analysis_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.analyses WHERE id = p_analysis_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_sub_question(p_sub_question_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sub_questions sq
    JOIN public.analyses a ON a.id = sq.analysis_id
    WHERE sq.id = p_sub_question_id AND a.user_id = auth.uid()
  );
$$;

-- RLS for sub_questions
CREATE POLICY "sub_questions_select" ON public.sub_questions FOR SELECT USING (can_access_analysis(analysis_id));
CREATE POLICY "sub_questions_insert" ON public.sub_questions FOR INSERT WITH CHECK (can_access_analysis(analysis_id));
CREATE POLICY "sub_questions_update" ON public.sub_questions FOR UPDATE USING (can_access_analysis(analysis_id));
CREATE POLICY "sub_questions_delete" ON public.sub_questions FOR DELETE USING (can_access_analysis(analysis_id));

-- RLS for concepts
CREATE POLICY "concepts_select" ON public.concepts FOR SELECT USING (can_access_analysis(analysis_id));
CREATE POLICY "concepts_insert" ON public.concepts FOR INSERT WITH CHECK (can_access_analysis(analysis_id));
CREATE POLICY "concepts_update" ON public.concepts FOR UPDATE USING (can_access_analysis(analysis_id));
CREATE POLICY "concepts_delete" ON public.concepts FOR DELETE USING (can_access_analysis(analysis_id));

-- RLS for assumptions
CREATE POLICY "assumptions_select" ON public.assumptions FOR SELECT USING (can_access_sub_question(sub_question_id));
CREATE POLICY "assumptions_insert" ON public.assumptions FOR INSERT WITH CHECK (can_access_sub_question(sub_question_id));
CREATE POLICY "assumptions_update" ON public.assumptions FOR UPDATE USING (can_access_sub_question(sub_question_id));
CREATE POLICY "assumptions_delete" ON public.assumptions FOR DELETE USING (can_access_sub_question(sub_question_id));