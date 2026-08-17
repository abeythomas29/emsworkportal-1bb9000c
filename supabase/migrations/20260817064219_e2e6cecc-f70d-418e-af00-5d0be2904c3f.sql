
-- Create research_messages table
CREATE TABLE IF NOT EXISTS public.research_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    series_id UUID REFERENCES public.research_series(id) ON DELETE SET NULL,
    message_date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'whatsapp',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_messages TO authenticated;
GRANT ALL ON public.research_messages TO service_role;

-- Enable RLS
ALTER TABLE public.research_messages ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all research messages') THEN
        CREATE POLICY "Users can view all research messages"
            ON public.research_messages FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own research messages') THEN
        CREATE POLICY "Users can insert their own research messages"
            ON public.research_messages FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own research messages') THEN
        CREATE POLICY "Users can update their own research messages"
            ON public.research_messages FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own research messages') THEN
        CREATE POLICY "Users can delete their own research messages"
            ON public.research_messages FOR DELETE
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;
