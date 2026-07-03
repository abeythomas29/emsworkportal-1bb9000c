
-- =========================================================================
-- COMPANY SETTINGS (single-row config)
-- =========================================================================
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address_line TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  gstin TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_ifsc TEXT,
  bank_micr TEXT,
  bank_branch_code TEXT,
  bank_swift TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage company settings"
  ON public.company_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed with EMS defaults
INSERT INTO public.company_settings
  (name, address_line, city, state, state_code, pincode, gstin, phone, email,
   bank_name, bank_account, bank_ifsc, bank_micr, bank_branch_code, bank_swift)
VALUES
  ('Esoteric Mineral Solution pvt ltd',
   '28/1 Bisuvanahalli, Kasuvanahalli',
   'Bengaluru', 'Karnataka', '29', '561203',
   '29AAGCE8267L1ZW', '8854999998', 'info@esotericminerals.com',
   'HDFC BANK GIRIDIH-JHARKHAND', '50200068599330', 'HDFC0000760',
   '815240002', '760', 'HDFCINBBXXX');

-- =========================================================================
-- PARTIES
-- =========================================================================
CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  gst_type TEXT NOT NULL DEFAULT 'unregistered', -- 'unregistered' | 'registered'
  billing_street TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_state_code TEXT,
  billing_pincode TEXT,
  billing_country TEXT DEFAULT 'India',
  shipping_same BOOLEAN NOT NULL DEFAULT true,
  shipping_street TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_state_code TEXT,
  shipping_pincode TEXT,
  shipping_country TEXT DEFAULT 'India',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX parties_name_idx ON public.parties (name);
CREATE INDEX parties_gstin_idx ON public.parties (gstin);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parties TO authenticated;
GRANT ALL ON public.parties TO service_role;

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage parties"
  ON public.parties FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER parties_updated_at
  BEFORE UPDATE ON public.parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- BILLING NUMBER SERIES  (per doc_type + financial year)
-- =========================================================================
CREATE TABLE public.billing_number_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL, -- 'tax_invoice' | 'proforma' | 'estimate'
  financial_year TEXT NOT NULL, -- e.g. '25-26'
  prefix TEXT NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doc_type, financial_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_number_series TO authenticated;
GRANT ALL ON public.billing_number_series TO service_role;

ALTER TABLE public.billing_number_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage number series"
  ON public.billing_number_series FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER billing_number_series_updated_at
  BEFORE UPDATE ON public.billing_number_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed running series based on invoices already issued
-- Tax Invoice EMSK25-26-56 issued => next = 57
INSERT INTO public.billing_number_series (doc_type, financial_year, prefix, next_number) VALUES
  ('tax_invoice', '25-26', 'EMSK', 57),
  ('tax_invoice', '26-27', 'EMSK', 1),
  ('proforma',    '26-27', 'EMSK-', 2),
  ('proforma',    '25-26', 'EMSK-', 1),
  ('estimate',    '25-26', 'EST-',  1),
  ('estimate',    '26-27', 'EST-',  1);

-- =========================================================================
-- BILLING DOCUMENTS
-- =========================================================================
CREATE TABLE public.billing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL, -- 'tax_invoice' | 'proforma' | 'estimate'
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'finalized'
  doc_number TEXT,
  financial_year TEXT,
  doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  party_snapshot JSONB, -- captured at save time
  place_of_supply_state TEXT,
  place_of_supply_code TEXT,
  payment_mode TEXT,
  terms TEXT,
  notes TEXT,
  sub_total NUMERIC NOT NULL DEFAULT 0,
  total_discount NUMERIC NOT NULL DEFAULT 0,
  total_tax NUMERIC NOT NULL DEFAULT 0,
  round_off NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  total_in_words TEXT,
  tax_summary JSONB, -- HSN-grouped tax breakdown
  sales_invoice_id UUID, -- populated when a tax invoice is mirrored
  created_by UUID,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX billing_documents_type_status_idx ON public.billing_documents (doc_type, status);
CREATE INDEX billing_documents_number_idx ON public.billing_documents (doc_number);
CREATE INDEX billing_documents_date_idx ON public.billing_documents (doc_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_documents TO authenticated;
GRANT ALL ON public.billing_documents TO service_role;

ALTER TABLE public.billing_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage billing documents"
  ON public.billing_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER billing_documents_updated_at
  BEFORE UPDATE ON public.billing_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- BILLING DOCUMENT ITEMS
-- =========================================================================
CREATE TABLE public.billing_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.billing_documents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  product_id UUID,
  item_name TEXT NOT NULL,
  description TEXT,
  hsn_sac TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  taxable_value NUMERIC NOT NULL DEFAULT 0,
  cgst NUMERIC NOT NULL DEFAULT 0,
  sgst NUMERIC NOT NULL DEFAULT 0,
  igst NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX billing_document_items_doc_idx ON public.billing_document_items (document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_document_items TO authenticated;
GRANT ALL ON public.billing_document_items TO service_role;

ALTER TABLE public.billing_document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage billing document items"
  ON public.billing_document_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- FUNCTIONS
-- =========================================================================

-- Atomically assign the next number for (doc_type, financial_year)
CREATE OR REPLACE FUNCTION public.get_next_billing_number(_doc_type TEXT, _financial_year TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_next INTEGER;
  v_default_prefix TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_default_prefix := CASE _doc_type
    WHEN 'tax_invoice' THEN 'EMSK'
    WHEN 'proforma'    THEN 'EMSK-'
    WHEN 'estimate'    THEN 'EST-'
    ELSE 'DOC-'
  END;

  -- Lock the series row (create if missing)
  INSERT INTO public.billing_number_series (doc_type, financial_year, prefix, next_number)
  VALUES (_doc_type, _financial_year, v_default_prefix, 1)
  ON CONFLICT (doc_type, financial_year) DO NOTHING;

  UPDATE public.billing_number_series
    SET next_number = next_number + 1,
        updated_at = now()
    WHERE doc_type = _doc_type AND financial_year = _financial_year
    RETURNING prefix, next_number - 1 INTO v_prefix, v_next;

  RETURN v_prefix || _financial_year || '-' || v_next::TEXT;
END;
$$;

-- Finalize proforma / estimate (assigns number)
CREATE OR REPLACE FUNCTION public.finalize_billing_document(_document_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc RECORD;
  v_number TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_doc FROM public.billing_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
  IF v_doc.status = 'finalized' THEN
    RETURN jsonb_build_object('doc_number', v_doc.doc_number, 'already', true);
  END IF;
  IF v_doc.doc_type = 'tax_invoice' THEN
    RAISE EXCEPTION 'Use finalize_tax_invoice for tax invoices';
  END IF;
  IF v_doc.financial_year IS NULL THEN
    RAISE EXCEPTION 'financial_year is required to finalize';
  END IF;

  v_number := public.get_next_billing_number(v_doc.doc_type, v_doc.financial_year);

  UPDATE public.billing_documents
    SET status = 'finalized',
        doc_number = v_number,
        finalized_at = now()
    WHERE id = _document_id;

  RETURN jsonb_build_object('doc_number', v_number);
END;
$$;

-- Finalize tax invoice (assigns number + mirrors to sales_invoices/sales_items)
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

  -- Mirror to sales_invoices
  INSERT INTO public.sales_invoices
    (invoice_no, invoice_date, party_name, transaction_type, payment_type,
     total_amount, received_amount, balance_due, is_cancelled, uploaded_by)
  VALUES
    (v_number, v_doc.doc_date, v_party_name, 'Sale', COALESCE(v_doc.payment_mode, 'Credit'),
     v_doc.total, 0, v_doc.total, false, auth.uid())
  RETURNING id INTO v_invoice_id;

  -- Mirror items (triggers apply_sale_to_stock)
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
