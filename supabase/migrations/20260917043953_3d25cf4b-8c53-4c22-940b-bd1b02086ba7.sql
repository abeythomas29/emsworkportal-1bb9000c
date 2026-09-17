CREATE OR REPLACE FUNCTION public.validate_billing_conversion_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_type text;
BEGIN
  IF NEW.converted_to_id IS NOT NULL THEN
    IF NEW.converted_to_id = NEW.id THEN
      RAISE EXCEPTION 'A document cannot be converted to itself';
    END IF;
    SELECT doc_type INTO t_type FROM public.billing_documents WHERE id = NEW.converted_to_id;
    IF t_type IS DISTINCT FROM 'tax_invoice' THEN
      RAISE EXCEPTION 'A quotation can only be linked to a tax invoice';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_billing_conversion_link ON public.billing_documents;
CREATE TRIGGER trg_validate_billing_conversion_link
BEFORE INSERT OR UPDATE OF converted_to_id ON public.billing_documents
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_conversion_link();

CREATE UNIQUE INDEX IF NOT EXISTS billing_documents_converted_to_id_unique
  ON public.billing_documents (converted_to_id)
  WHERE converted_to_id IS NOT NULL;