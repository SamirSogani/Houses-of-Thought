
-- Create table for storing logic strength and stress test results
CREATE TABLE public.test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  test_type TEXT NOT NULL CHECK (test_type IN ('logic_strength', 'stress_test')),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own test results"
ON public.test_results FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own test results"
ON public.test_results FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own test results"
ON public.test_results FOR DELETE
USING (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_test_results_analysis ON public.test_results(analysis_id, test_type, created_at DESC);
