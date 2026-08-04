CREATE OR REPLACE FUNCTION public.delete_research_series(_series_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
BEGIN
  SELECT created_by INTO v_creator FROM public.research_series WHERE id = _series_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Series not found';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR v_creator = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.research_tests SET series_id = NULL WHERE series_id = _series_id;
  DELETE FROM public.research_series WHERE id = _series_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_research_series(uuid) TO authenticated;