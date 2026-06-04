ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);