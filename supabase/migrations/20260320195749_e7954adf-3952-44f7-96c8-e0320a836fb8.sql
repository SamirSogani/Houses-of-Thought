
CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  path text NOT NULL DEFAULT '/',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts so any visitor can be tracked
CREATE POLICY "Anyone can insert visits"
  ON public.site_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No direct SELECT - only accessible via service role in edge function
CREATE POLICY "No direct select"
  ON public.site_visits FOR SELECT
  USING (false);

CREATE INDEX idx_site_visits_created_at ON public.site_visits (created_at);
CREATE INDEX idx_site_visits_visitor_id ON public.site_visits (visitor_id);
