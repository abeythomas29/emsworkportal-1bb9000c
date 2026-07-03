
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Storage policies for company-assets: admins manage; anyone can read (public bucket)
DROP POLICY IF EXISTS "company-assets read" ON storage.objects;
DROP POLICY IF EXISTS "company-assets admin write" ON storage.objects;
DROP POLICY IF EXISTS "company-assets admin update" ON storage.objects;
DROP POLICY IF EXISTS "company-assets admin delete" ON storage.objects;

CREATE POLICY "company-assets read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

CREATE POLICY "company-assets admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "company-assets admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "company-assets admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'::app_role));
