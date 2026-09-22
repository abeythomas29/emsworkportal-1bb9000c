ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.finalize_tax_invoice(_document_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc RECORD;
  v_number TEXT;
  v_invoice_id UUID;
  v_party_name TEXT;
  v_mode TEXT;
  v_received NUMERIC;
  v_balance NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_doc FROM public.billing_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
  IF v_doc.doc_type <> 'tax_invoice' THEN
    RAISE EXCEPTION 'Not a tax invoice';
  END IF;
  IF v_doc.status = 'finalized' THEN
    RETURN jsonb_build_object('doc_number', v_doc.doc_number, 'already', true);
  END IF;
  IF v_doc.financial_year IS NULL THEN
    RAISE EXCEPTION 'financial_year is required to finalize';
  END IF;

  v_number := public.get_next_billing_number('tax_invoice', v_doc.financial_year);
  v_party_name := COALESCE(v_doc.party_snapshot->>'name', 'Unknown');

  v_mode := COALESCE(v_doc.payment_mode, 'Advance');
  IF lower(v_mode) = 'credit' THEN
    v_received := 0;
    v_balance := v_doc.total;
  ELSE
    v_received := v_doc.total;
    v_balance := 0;
  END IF;

  INSERT INTO public.sales_invoices
    (invoice_no, invoice_date, party_name, transaction_type, payment_type,
     total_amount, received_amount, balance_due, is_cancelled, uploaded_by)
  VALUES
    (v_number, v_doc.doc_date, v_party_name, 'Sale', v_mode,
     v_doc.total, v_received, v_balance, false, auth.uid())
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.sales_items
    (invoice_id, invoice_no, invoice_date, party_name,
     item_name, hsn_sac, description, quantity, unit,
     unit_price, discount_percent, discount, tax_percent, tax, amount, product_id)
  SELECT
     v_invoice_id, v_number, v_doc.doc_date, v_party_name,
     i.item_name, i.hsn_sac, i.description, i.quantity, i.unit,
     i.unit_price, i.discount_percent, i.discount_amount,
     i.tax_percent, i.tax_amount, i.amount, i.product_id
  FROM public.billing_document_items i
  WHERE i.document_id = _document_id;

  UPDATE public.billing_documents
    SET status = 'finalized',
        doc_number = v_number,
        sales_invoice_id = v_invoice_id,
        finalized_at = now()
    WHERE id = _document_id;

  RETURN jsonb_build_object('doc_number', v_number, 'sales_invoice_id', v_invoice_id);
END;
$$;