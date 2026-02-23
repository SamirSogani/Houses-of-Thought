
-- Create sidebar_chats table for persistent multi-thread chat
CREATE TABLE public.sidebar_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  chat_title TEXT NOT NULL DEFAULT 'New Chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sidebar_chats ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own chats
CREATE POLICY "sidebar_chats_select" ON public.sidebar_chats FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "sidebar_chats_insert" ON public.sidebar_chats FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sidebar_chats_update" ON public.sidebar_chats FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "sidebar_chats_delete" ON public.sidebar_chats FOR DELETE
  USING (user_id = auth.uid());

-- Index for fast lookups by analysis
CREATE INDEX idx_sidebar_chats_analysis_id ON public.sidebar_chats(analysis_id);
CREATE INDEX idx_sidebar_chats_user_id ON public.sidebar_chats(user_id);
