import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface Parcel {
  id: string;
  user_id: string;
  tracking_id: string;
  courier: string;
  courier_tracking_url: string | null;
  photo_url: string | null;
  client_name: string | null;
  is_sample: boolean;
  dispatched_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useParcels(opts?: { samplesOnly?: boolean }) {
  return useQuery({
    queryKey: ['parcels', opts?.samplesOnly ?? false],
    queryFn: async () => {
      let q = supabase.from('parcels').select('*').order('dispatched_date', { ascending: false });
      if (opts?.samplesOnly) q = q.eq('is_sample', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Parcel[];
    },
  });
}

export function useCreateParcel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Omit<Parcel, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('parcels')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Parcel added');
      qc.invalidateQueries({ queryKey: ['parcels'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Parcel> & { id: string }) => {
      const { data, error } = await supabase.from('parcels').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['parcels'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parcels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['parcels'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function uploadParcelPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('parcels').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('parcels').getPublicUrl(path);
  // bucket is private, but we store path; for display use signed URLs
  return path;
}

export async function getSignedParcelUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from('parcels').createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function extractParcelFromImage(file: File): Promise<{ tracking_id: string; courier: string; confidence: string }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const { data, error } = await supabase.functions.invoke('extract-parcel-info', {
    body: { imageBase64: base64 },
  });
  if (error) throw error;
  return data;
}
