
CREATE TABLE public.production_log_products_consumed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_log_id uuid NOT NULL REFERENCES public.production_logs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_consumed numeric NOT NULL CHECK (quantity_consumed > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plpc_log ON public.production_log_products_consumed(production_log_id);
CREATE INDEX idx_plpc_product ON public.production_log_products_consumed(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_log_products_consumed TO authenticated;
GRANT ALL ON public.production_log_products_consumed TO service_role;

ALTER TABLE public.production_log_products_consumed ENABLE ROW LEVEL SECURITY;

-- Mirror policies from production_log_materials
CREATE POLICY "Production and admins can view consumed products"
  ON public.production_log_products_consumed FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_production_user(auth.uid())
  );

CREATE POLICY "Production and admins can insert consumed products"
  ON public.production_log_products_consumed FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_production_user(auth.uid())
  );

CREATE POLICY "Production and admins can update consumed products"
  ON public.production_log_products_consumed FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_production_user(auth.uid())
  );

CREATE POLICY "Production and admins can delete consumed products"
  ON public.production_log_products_consumed FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_production_user(auth.uid())
  );

-- Stock adjustment trigger
CREATE OR REPLACE FUNCTION public.apply_product_consumption_to_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
    SET current_stock = current_stock - NEW.quantity_consumed
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
    SET current_stock = current_stock + OLD.quantity_consumed
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_apply_product_consumption
  AFTER INSERT OR DELETE ON public.production_log_products_consumed
  FOR EACH ROW EXECUTE FUNCTION public.apply_product_consumption_to_stock();
