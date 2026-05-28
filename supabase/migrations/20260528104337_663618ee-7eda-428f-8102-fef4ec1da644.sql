
-- Helper: research department detector
CREATE OR REPLACE FUNCTION public.is_research_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND LOWER(COALESCE(department, '')) = 'research'
      AND COALESCE(is_active, true) = true
  );
$$;

-- Series table
CREATE TABLE public.research_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_series TO authenticated;
GRANT ALL ON public.research_series TO service_role;

ALTER TABLE public.research_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Research, admins, managers can view series"
  ON public.research_series FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_research_user(auth.uid())
  );

CREATE POLICY "Research and admins can insert series"
  ON public.research_series FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_research_user(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Research and admins can update series"
  ON public.research_series FOR UPDATE TO authenticated
  USING (
    public.is_research_user(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.is_research_user(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete series"
  ON public.research_series FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_research_series_updated_at
  BEFORE UPDATE ON public.research_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tests table
CREATE TABLE public.research_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  series_id uuid REFERENCES public.research_series(id) ON DELETE SET NULL,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  instructions text NOT NULL,
  observation text,
  next_test_changes text,
  result_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_tests_user_date ON public.research_tests(user_id, test_date DESC);
CREATE INDEX idx_research_tests_series ON public.research_tests(series_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_tests TO authenticated;
GRANT ALL ON public.research_tests TO service_role;

ALTER TABLE public.research_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Research, admins, managers can view all tests"
  ON public.research_tests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_research_user(auth.uid())
  );

CREATE POLICY "Research and admins can insert own tests"
  ON public.research_tests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_research_user(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Users update own tests or admins"
  ON public.research_tests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own tests or admins"
  ON public.research_tests FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_research_tests_updated_at
  BEFORE UPDATE ON public.research_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
