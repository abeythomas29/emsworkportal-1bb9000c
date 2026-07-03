
CREATE TABLE public.po_term_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_term_templates TO authenticated;
GRANT ALL ON public.po_term_templates TO service_role;

ALTER TABLE public.po_term_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage po term templates"
  ON public.po_term_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX po_term_templates_only_one_default
  ON public.po_term_templates ((true)) WHERE is_default;

CREATE TRIGGER update_po_term_templates_updated_at
  BEFORE UPDATE ON public.po_term_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS terms text;

INSERT INTO public.po_term_templates (name, content, is_default) VALUES (
  'Standard Purchase Terms',
$$Pricing & Payment: Prices are fixed, inclusive of all taxes. 50% payment is due upon receipt of proforma invoice; 50% is due before dispatch.

Delivery: Goods must be delivered on time to the specified location. Seller must notify delays promptly. Buyer may reject or cancel late/non-conforming goods.

Quality: Goods must meet PO specifications. Buyer may inspect and reject defective goods for repair, replacement, or refund at Seller's cost.

Warranty: Goods are warranted free of defects for [12 months] from receipt. Seller will repair/replace/refund defective goods at no cost to Buyer.

Compliance: Seller warrants compliance with all applicable laws and will provide certifications on request.

Indemnity: Seller will indemnify Buyer against claims from Seller's breach, negligence, or non-compliance.

Termination: Buyer may terminate for convenience or Seller's breach with notice. Buyer owes only for completed work.

Governing Law: This PO is governed by Karnataka law. Disputes resolved in Karnataka, India jurisdiction.$$,
  true
);
