CREATE POLICY "Public can read assumptions for public analyses"
ON public.assumptions
FOR SELECT
USING (
  public.is_analysis_public(
    (SELECT sq.analysis_id FROM public.sub_questions sq WHERE sq.id = assumptions.sub_question_id)
  )
);