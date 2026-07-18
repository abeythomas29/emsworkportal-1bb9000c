
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS converted_to_id uuid REFERENCES public.billing_documents(id) ON DELETE SET NULL;

-- Backfill: link existing sources whose notes reference the converted-from doc number
UPDATE public.billing_documents src
SET converted_to_id = tgt.id
FROM public.billing_documents tgt
WHERE tgt.notes ILIKE 'Converted from ' || src.doc_number
  AND src.doc_number IS NOT NULL
  AND src.converted_to_id IS NULL
  AND src.doc_type IN ('proforma','estimate');
