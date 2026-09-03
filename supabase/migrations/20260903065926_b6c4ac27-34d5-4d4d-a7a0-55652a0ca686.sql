-- 1. Uniqueness of document numbers
CREATE UNIQUE INDEX IF NOT EXISTS billing_documents_number_unique
  ON public.billing_documents (doc_type, financial_year, doc_number)
  WHERE doc_number IS NOT NULL;

-- 2. Audit log
CREATE TABLE public.billing_document_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid,
  doc_type text,
  financial_year text,
  doc_number text,
  action text NOT NULL,
  reason text,
  actor_id uuid,
  actor_email text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.billing_document_audit TO authenticated;
GRANT ALL ON public.billing_document_audit TO service_role;
ALTER TABLE public.billing_document_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view billing audit"
  ON public.billing_document_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated can insert billing audit"
  ON public.billing_document_audit FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX billing_document_audit_number_idx
  ON public.billing_document_audit (doc_type, financial_year, doc_number);

-- 3. Number allocation log
CREATE TABLE public.billing_number_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  financial_year text NOT NULL,
  seq integer NOT NULL,
  doc_number text NOT NULL,
  allocated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_number_allocations TO authenticated;
GRANT ALL ON public.billing_number_allocations TO service_role;
ALTER TABLE public.billing_number_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view number allocations"
  ON public.billing_number_allocations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX billing_number_allocations_idx
  ON public.billing_number_allocations (doc_type, financial_year, seq);

-- 4. Log allocations inside the number generator
CREATE OR REPLACE FUNCTION public.get_next_billing_number(_doc_type text, _financial_year text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT;
  v_next INTEGER;
  v_default_prefix TEXT;
  v_number TEXT;
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

  INSERT INTO public.billing_number_series (doc_type, financial_year, prefix, next_number)
  VALUES (_doc_type, _financial_year, v_default_prefix, 1)
  ON CONFLICT (doc_type, financial_year) DO NOTHING;

  UPDATE public.billing_number_series
    SET next_number = next_number + 1,
        updated_at = now()
    WHERE doc_type = _doc_type AND financial_year = _financial_year
    RETURNING prefix, next_number - 1 INTO v_prefix, v_next;

  v_number := v_prefix || _financial_year || '-' || v_next::TEXT;

  INSERT INTO public.billing_number_allocations (doc_type, financial_year, seq, doc_number, allocated_by)
  VALUES (_doc_type, _financial_year, v_next, v_number, auth.uid());

  RETURN v_number;
END;
$function$;

-- 5. Snapshot + block deletes of finalized documents
CREATE OR REPLACE FUNCTION public.billing_document_before_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb;
BEGIN
  IF OLD.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized documents cannot be deleted. Cancel the document instead.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO v_items
  FROM public.billing_document_items i WHERE i.document_id = OLD.id;

  INSERT INTO public.billing_document_audit
    (document_id, doc_type, financial_year, doc_number, action, actor_id, snapshot)
  VALUES
    (OLD.id, OLD.doc_type, OLD.financial_year, OLD.doc_number, 'deleted', auth.uid(),
     jsonb_build_object('document', to_jsonb(OLD), 'items', v_items));

  RETURN OLD;
END;
$function$;

CREATE TRIGGER billing_documents_before_delete
  BEFORE DELETE ON public.billing_documents
  FOR EACH ROW EXECUTE FUNCTION public.billing_document_before_delete();

-- 6. Log number changes
CREATE OR REPLACE FUNCTION public.billing_document_number_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.doc_number IS DISTINCT FROM OLD.doc_number THEN
    INSERT INTO public.billing_document_audit
      (document_id, doc_type, financial_year, doc_number, action, reason, actor_id, snapshot)
    VALUES
      (NEW.id, NEW.doc_type, NEW.financial_year, NEW.doc_number, 'number_changed', NULL, auth.uid(),
       jsonb_build_object('from', OLD.doc_number, 'to', NEW.doc_number));
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER billing_documents_number_change
  AFTER UPDATE ON public.billing_documents
  FOR EACH ROW EXECUTE FUNCTION public.billing_document_number_change();

-- 7. Cancel action
CREATE OR REPLACE FUNCTION public.cancel_billing_document(_document_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc RECORD;
  v_items jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_doc FROM public.billing_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
  IF v_doc.status = 'cancelled' THEN
    RETURN jsonb_build_object('already', true);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO v_items
  FROM public.billing_document_items i WHERE i.document_id = _document_id;

  UPDATE public.billing_documents SET status = 'cancelled' WHERE id = _document_id;

  IF v_doc.sales_invoice_id IS NOT NULL THEN
    UPDATE public.sales_invoices SET is_cancelled = true WHERE id = v_doc.sales_invoice_id;
  END IF;

  INSERT INTO public.billing_document_audit
    (document_id, doc_type, financial_year, doc_number, action, reason, actor_id, snapshot)
  VALUES
    (_document_id, v_doc.doc_type, v_doc.financial_year, v_doc.doc_number, 'cancelled', _reason, auth.uid(),
     jsonb_build_object('document', to_jsonb(v_doc), 'items', v_items));

  RETURN jsonb_build_object('cancelled', true);
END;
$function$;