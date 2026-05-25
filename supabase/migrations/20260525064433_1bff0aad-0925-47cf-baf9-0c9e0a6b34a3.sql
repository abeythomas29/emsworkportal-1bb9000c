
-- Parcels table
CREATE TABLE public.parcels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  courier TEXT NOT NULL,
  courier_tracking_url TEXT,
  photo_url TEXT,
  client_name TEXT,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  dispatched_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parcels_user ON public.parcels(user_id);
CREATE INDEX idx_parcels_sample ON public.parcels(is_sample) WHERE is_sample = true;
CREATE INDEX idx_parcels_dispatched ON public.parcels(dispatched_date DESC);

ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all parcels"
  ON public.parcels FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create their own parcels"
  ON public.parcels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parcels or admins"
  ON public.parcels FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own parcels or admins"
  ON public.parcels FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_parcels_updated_at
  BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for parcel label photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('parcels', 'parcels', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read parcel photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parcels');

CREATE POLICY "Authenticated can upload parcel photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parcels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own parcel photos or admins"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'parcels' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));
