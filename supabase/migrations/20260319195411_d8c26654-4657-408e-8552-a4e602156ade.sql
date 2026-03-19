
-- Create draft_runs table to persist Draft Full House run history
CREATE TABLE public.draft_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  status TEXT NOT NULL DEFAULT 'running',
  draft_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  iterations INTEGER NOT NULL DEFAULT 0,
  sub_questions_generated INTEGER NOT NULL DEFAULT 0,
  final_logic_score INTEGER NOT NULL DEFAULT 0,
  final_resilience_score INTEGER NOT NULL DEFAULT 0,
  log_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.draft_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own draft runs"
ON public.draft_runs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own draft runs"
ON public.draft_runs FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own draft runs"
ON public.draft_runs FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own draft runs"
ON public.draft_runs FOR DELETE
USING (user_id = auth.uid());
