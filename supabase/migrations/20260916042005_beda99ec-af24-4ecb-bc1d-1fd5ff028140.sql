WITH matches AS (
  SELECT s.id AS src_id,
         (SELECT t.id FROM public.billing_documents t
          WHERE t.doc_type = 'tax_invoice'
            AND t.total = s.total
            AND t.party_id IS NOT DISTINCT FROM s.party_id
            AND t.doc_date >= s.doc_date - INTERVAL '30 days'
            AND t.id <> s.id
          ORDER BY t.doc_date ASC
          LIMIT 1) AS tax_id
  FROM public.billing_documents s
  WHERE s.doc_type IN ('proforma','estimate')
    AND s.converted_to_id IS NULL
)
UPDATE public.billing_documents d
SET converted_to_id = m.tax_id,
    status = CASE WHEN d.status = 'draft' THEN 'finalized' ELSE d.status END
FROM matches m
WHERE d.id = m.src_id AND m.tax_id IS NOT NULL;