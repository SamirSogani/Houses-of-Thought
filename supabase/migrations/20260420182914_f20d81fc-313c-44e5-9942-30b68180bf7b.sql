-- Create enum for account types
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('standard', 'student', 'teacher');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add account_type column to profiles, defaulting to 'standard'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'standard';

-- Backfill any NULL rows (defensive — column is NOT NULL with default but in case)
UPDATE public.profiles SET account_type = 'standard' WHERE account_type IS NULL;