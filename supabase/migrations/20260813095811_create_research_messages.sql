CREATE TABLE public.research_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    series_id uuid REFERENCES public.research_series(id) ON DELETE SET NULL,
    message_date date NOT NULL DEFAULT CURRENT_DATE,
    content text NOT NULL,
    source text NOT NULL DEFAULT 'whatsapp',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_messages TO authenticated;
GRANT ALL ON public.research_messages TO service_role;

ALTER TABLE public.research_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all research messages"
    ON public.research_messages FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert their own research messages"
    ON public.research_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research messages"
    ON public.research_messages FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own research messages"
    ON public.research_messages FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE TRIGGER update_research_messages_updated_at
    BEFORE UPDATE ON public.research_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
