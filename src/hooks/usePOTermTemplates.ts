import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface POTermTemplate {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const KEY = ['po_term_templates'];

export function usePOTermTemplates() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<POTermTemplate[]> => {
      const { data, error } = await supabase
        .from('po_term_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data ?? []) as POTermTemplate[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (
      input: { id?: string; name: string; content: string; is_default?: boolean },
    ) => {
      // If setting default, clear existing default first (unique index enforces this)
      if (input.is_default) {
        await supabase.from('po_term_templates').update({ is_default: false }).eq('is_default', true);
      }
      if (input.id) {
        const { error } = await supabase
          .from('po_term_templates')
          .update({ name: input.name, content: input.content, is_default: !!input.is_default })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('po_term_templates')
          .insert({ name: input.name, content: input.content, is_default: !!input.is_default });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Template saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('po_term_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Template deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    templates: list.data ?? [],
    isLoading: list.isLoading,
    defaultTemplate: (list.data ?? []).find((t) => t.is_default) ?? null,
    saveTemplate: upsert.mutateAsync,
    isSaving: upsert.isPending,
    deleteTemplate: remove.mutateAsync,
  };
}
