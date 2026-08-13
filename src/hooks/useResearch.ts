import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { type Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface ResearchSeries {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchTest {
  id: string;
  user_id: string;
  series_id: string | null;
  test_date: string;
  title: string | null;
  instructions: string;
  observation: string | null;
  next_test_changes: string | null;
  result_recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useResearchSeries() {
  return useQuery({
    queryKey: ['research_series'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_series')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as ResearchSeries[];
    },
  });
}

export function useCreateSeries() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string | null }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('research_series')
        .insert({ ...payload, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Series added');
      qc.invalidateQueries({ queryKey: ['research_series'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; description?: string | null }) => {
      const { data, error } = await supabase
        .from('research_series')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Series updated');
      qc.invalidateQueries({ queryKey: ['research_series'] });
      qc.invalidateQueries({ queryKey: ['research_tests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Detaches tests (kept, moved to "No series") then removes the series
      const { error } = await supabase.rpc('delete_research_series', { _series_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Series deleted');
      qc.invalidateQueries({ queryKey: ['research_series'] });
      qc.invalidateQueries({ queryKey: ['research_tests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResearchTests(opts?: { todayOnly?: boolean; mineOnly?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['research_tests', opts?.todayOnly ?? false, opts?.mineOnly ?? false, user?.id],
    queryFn: async () => {
      let q = supabase.from('research_tests').select('*').order('test_date', { ascending: false }).order('created_at', { ascending: false });
      if (opts?.todayOnly) {
        const today = new Date().toISOString().slice(0, 10);
        q = q.eq('test_date', today);
      }
      if (opts?.mineOnly && user) q = q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as ResearchTest[];
    },
  });
}

export function useCreateTest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      title?: string | null;
      instructions: string;
      series_id?: string | null;
      test_date?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('research_tests')
        .insert({
          user_id: user.id,
          instructions: payload.instructions,
          title: payload.title ?? null,
          series_id: payload.series_id ?? null,
          test_date: payload.test_date ?? new Date().toISOString().slice(0, 10),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Test logged');
      qc.invalidateQueries({ queryKey: ['research_tests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ResearchTest> & { id: string }) => {
      const { data, error } = await supabase
        .from('research_tests')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['research_tests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('research_tests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['research_tests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface ResearchMessage {
  id: string;
  user_id: string;
  series_id: string | null;
  message_date: string;
  content: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export function useResearchMessages(opts?: { date?: string; series_id?: string }) {
  return useQuery({
    queryKey: ['research_messages', opts?.date, opts?.series_id],
    queryFn: async () => {
      let q = supabase.from('research_messages').select('*').order('message_date', { ascending: false });
      if (opts?.date) q = (q as any).eq('message_date', opts.date);
      if (opts?.series_id) q = (q as any).eq('message_date', opts.series_id);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateResearchMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      content: string;
      message_date: string;
      series_id?: string | null;
      source?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('research_messages')
        .insert({
          user_id: user.id,
          content: payload.content,
          message_date: payload.message_date,
          series_id: payload.series_id ?? null,
          source: payload.source ?? 'whatsapp',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Messages saved to portal');
      qc.invalidateQueries({ queryKey: ['research_messages'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
