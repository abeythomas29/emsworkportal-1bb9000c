
-- Enums
CREATE TYPE public.purchase_order_status AS ENUM ('draft','approved','sent','partially_received','received','cancelled');
CREATE TYPE public.purchase_invoice_payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE public.purchase_invoice_extraction_status AS ENUM ('pending','extracted','manual','failed');

-- Purchase Orders
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT UNIQUE,
  financial_year TEXT,
  vendor_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  vendor_gstin TEXT,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  status public.purchase_order_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  sub_total NUMERIC NOT NULL DEFAULT 0,
  total_tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage purchase orders" ON public.purchase_orders FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PO Items
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  hsn_sac TEXT,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  taxable_value NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage PO items" ON public.purchase_order_items FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Purchase Invoices
CREATE TABLE public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  vendor_gstin TEXT,
  invoice_no TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  sub_total NUMERIC NOT NULL DEFAULT 0,
  total_tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_status public.purchase_invoice_payment_status NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  attachment_path TEXT,
  attachment_mime TEXT,
  extraction_status public.purchase_invoice_extraction_status NOT NULL DEFAULT 'manual',
  extraction_raw JSONB,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT ALL ON public.purchase_invoices TO service_role;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage purchase invoices" ON public.purchase_invoices FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER update_purchase_invoices_updated_at BEFORE UPDATE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice Items
CREATE TABLE public.purchase_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  hsn_sac TEXT,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  taxable_value NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoice_items TO authenticated;
GRANT ALL ON public.purchase_invoice_items TO service_role;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage purchase invoice items" ON public.purchase_invoice_items FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Storage policies for the private purchase-invoices bucket (bucket created separately via tool)
CREATE POLICY "Admins read purchase invoice files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'purchase-invoices' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins upload purchase invoice files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-invoices' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update purchase invoice files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'purchase-invoices' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete purchase invoice files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'purchase-invoices' AND public.has_role(auth.uid(),'admin'::app_role));

-- Indexes
CREATE INDEX idx_purchase_orders_date ON public.purchase_orders(po_date DESC);
CREATE INDEX idx_purchase_orders_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_invoices_date ON public.purchase_invoices(invoice_date DESC);
CREATE INDEX idx_purchase_invoices_vendor ON public.purchase_invoices(vendor_id);
CREATE INDEX idx_purchase_invoice_items_invoice ON public.purchase_invoice_items(invoice_id);
CREATE INDEX idx_purchase_order_items_po ON public.purchase_order_items(po_id);
