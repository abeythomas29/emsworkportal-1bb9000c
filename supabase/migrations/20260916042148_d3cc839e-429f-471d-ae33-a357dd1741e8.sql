ALTER TABLE public.billing_documents
  ADD COLUMN IF NOT EXISTS converted_from_id uuid REFERENCES public.billing_documents(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_billing_conversion_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.converted_from_id IS NOT NULL THEN
    UPDATE public.billing_documents
    SET converted_to_id = NEW.id,
        status = CASE WHEN status = 'draft' THEN 'finalized' ELSE status END
    WHERE id = NEW.converted_from_id
      AND (converted_to_id IS DISTINCT FROM NEW.id OR status = 'draft');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_billing_conversion_link ON public.billing_documents;
CREATE TRIGGER trg_sync_billing_conversion_link
AFTER INSERT OR UPDATE OF converted_from_id ON public.billing_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_billing_conversion_link();

UPDATE public.billing_documents t
SET converted_from_id = s.id
FROM public.billing_documents s
WHERE s.converted_to_id = t.id
  AND t.converted_from_id IS NULL;