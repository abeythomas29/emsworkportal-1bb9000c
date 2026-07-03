import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface FlowRateCalibration {
  id: string;
  user_id: string;
  mica_name: string | null;
  d90_microns: number;
  weight_g: number;
  flow_rate_ml_min: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useFlowRateCalibrations() {
  return useQuery({
    queryKey: ['flow_rate_calibrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_rate_calibrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        d90_microns: Number(r.d90_microns),
        weight_g: Number(r.weight_g),
        flow_rate_ml_min: Number(r.flow_rate_ml_min),
      })) as FlowRateCalibration[];
    },
  });
}

export function useCreateCalibration() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      mica_name?: string | null;
      d90_microns: number;
      weight_g: number;
      flow_rate_ml_min: number;
      notes?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('flow_rate_calibrations')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Calibration point saved');
      qc.invalidateQueries({ queryKey: ['flow_rate_calibrations'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCalibration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('flow_rate_calibrations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['flow_rate_calibrations'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Fit ln(flow/weight) = ln(a) + b * ln(D90) via OLS. Returns null if <2 valid points. */
export function fitPowerLaw(points: { d90_microns: number; weight_g: number; flow_rate_ml_min: number }[]) {
  const pts = points.filter(
    (p) => p.d90_microns > 0 && p.weight_g > 0 && p.flow_rate_ml_min > 0,
  );
  if (pts.length < 2) return null;
  const xs = pts.map((p) => Math.log(p.d90_microns));
  const ys = pts.map((p) => Math.log(p.flow_rate_ml_min / p.weight_g));
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const b = num / den;
  const lnA = meanY - b * meanX;
  const a = Math.exp(lnA);
  // R²
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = lnA + b * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { a, b, r2, n };
}
