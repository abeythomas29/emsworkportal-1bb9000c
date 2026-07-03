import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logError } from '@/lib/logger';

export interface Product {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  is_active: boolean;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'lt';
  current_stock: number;
  is_active: boolean;
}

export interface ProductionLog {
  id: string;
  user_id: string;
  date: string;
  product_id: string;
  quantity_produced: number;
  notes: string | null;
  created_at: string;
  product?: { name: string; unit: string };
  logger?: { full_name: string };
  materials?: Array<{
    id: string;
    raw_material_id: string;
    quantity_consumed: number;
    raw_material?: { name: string; unit: string };
  }>;
  products_consumed?: Array<{
    id: string;
    product_id: string;
    quantity_consumed: number;
    product?: { name: string; unit: string };
  }>;
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as Product[];
    },
  });
}

export function useRawMaterials() {
  return useQuery({
    queryKey: ['raw_materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as RawMaterial[];
    },
  });
}

export function useProductionLogs() {
  return useQuery({
    queryKey: ['production_logs'],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('production_logs')
        .select('*, product:products(name, unit)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const ids = (logs || []).map((l) => l.id);
      if (ids.length === 0) return [] as ProductionLog[];

      const [matsRes, prodConsRes, profilesRes] = await Promise.all([
        supabase
          .from('production_log_materials')
          .select('*, raw_material:raw_materials(name, unit)')
          .in('production_log_id', ids),
        supabase
          .from('production_log_products_consumed')
          .select('*, product:products(name, unit)')
          .in('production_log_id', ids),
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(new Set((logs || []).map((l) => l.user_id)))),
      ]);

      const matsByLog = new Map<string, any[]>();
      (matsRes.data || []).forEach((m: any) => {
        const arr = matsByLog.get(m.production_log_id) || [];
        arr.push(m);
        matsByLog.set(m.production_log_id, arr);
      });
      const prodConsByLog = new Map<string, any[]>();
      (prodConsRes.data || []).forEach((p: any) => {
        const arr = prodConsByLog.get(p.production_log_id) || [];
        arr.push(p);
        prodConsByLog.set(p.production_log_id, arr);
      });
      const profileMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p: any) => profileMap.set(p.id, p.full_name));

      return (logs || []).map((l: any) => ({
        ...l,
        materials: matsByLog.get(l.id) || [],
        products_consumed: prodConsByLog.get(l.id) || [],
        logger: { full_name: profileMap.get(l.user_id) || 'Unknown' },
      })) as ProductionLog[];
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; unit: string; current_stock?: number }) => {
      const { error } = await supabase.from('products').insert({
        name: input.name,
        unit: input.unit,
        current_stock: input.current_stock ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product added' });
    },
    onError: (e: any) => {
      logError('createProduct', e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });
}

export function useCreateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; unit: 'kg' | 'lt'; current_stock?: number }) => {
      const { error } = await supabase.from('raw_materials').insert({
        name: input.name,
        unit: input.unit,
        current_stock: input.current_stock ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw_materials'] });
      toast({ title: 'Raw material added' });
    },
    onError: (e: any) => {
      logError('createRawMaterial', e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; unit?: string; current_stock?: number }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from('products').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; unit?: 'kg' | 'lt'; current_stock?: number }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from('raw_materials').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw_materials'] });
      toast({ title: 'Raw material updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product removed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('raw_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw_materials'] });
      toast({ title: 'Raw material removed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useCreateProductionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      product_id: string;
      quantity_produced: number;
      notes?: string;
      materials: Array<{ raw_material_id: string; quantity_consumed: number }>;
      products_consumed?: Array<{ product_id: string; quantity_consumed: number }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: log, error: logErr } = await supabase
        .from('production_logs')
        .insert({
          user_id: user.id,
          date: input.date,
          product_id: input.product_id,
          quantity_produced: input.quantity_produced,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (logErr) throw logErr;

      const validMats = input.materials.filter(
        (m) => m.raw_material_id && m.quantity_consumed > 0
      );
      if (validMats.length > 0) {
        const { error: matErr } = await supabase.from('production_log_materials').insert(
          validMats.map((m) => ({
            production_log_id: log.id,
            raw_material_id: m.raw_material_id,
            quantity_consumed: m.quantity_consumed,
          }))
        );
        if (matErr) throw matErr;
      }

      const validProds = (input.products_consumed || []).filter(
        (p) => p.product_id && p.quantity_consumed > 0
      );
      if (validProds.length > 0) {
        const { error: pErr } = await supabase.from('production_log_products_consumed').insert(
          validProds.map((p) => ({
            production_log_id: log.id,
            product_id: p.product_id,
            quantity_consumed: p.quantity_consumed,
          }))
        );
        if (pErr) throw pErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production_logs'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['raw_materials'] });
      toast({ title: 'Production logged', description: 'Inventory updated automatically.' });
    },
    onError: (e: any) => {
      logError('createProductionLog', e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });
}

export function useUpdateProductionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      date: string;
      product_id: string;
      quantity_produced: number;
      notes?: string;
      materials: Array<{ raw_material_id: string; quantity_consumed: number }>;
      products_consumed?: Array<{ product_id: string; quantity_consumed: number }>;
    }) => {
      const { error: updErr } = await supabase
        .from('production_logs')
        .update({
          date: input.date,
          product_id: input.product_id,
          quantity_produced: input.quantity_produced,
          notes: input.notes || null,
        })
        .eq('id', input.id);
      if (updErr) throw updErr;

      const { error: delErr } = await supabase
        .from('production_log_materials')
        .delete()
        .eq('production_log_id', input.id);
      if (delErr) throw delErr;

      const validMats = input.materials.filter(
        (m) => m.raw_material_id && m.quantity_consumed > 0
      );
      if (validMats.length > 0) {
        const { error: matErr } = await supabase.from('production_log_materials').insert(
          validMats.map((m) => ({
            production_log_id: input.id,
            raw_material_id: m.raw_material_id,
            quantity_consumed: m.quantity_consumed,
          }))
        );
        if (matErr) throw matErr;
      }

      const { error: delProdErr } = await supabase
        .from('production_log_products_consumed')
        .delete()
        .eq('production_log_id', input.id);
      if (delProdErr) throw delProdErr;

      const validProds = (input.products_consumed || []).filter(
        (p) => p.product_id && p.quantity_consumed > 0
      );
      if (validProds.length > 0) {
        const { error: pErr } = await supabase.from('production_log_products_consumed').insert(
          validProds.map((p) => ({
            production_log_id: input.id,
            product_id: p.product_id,
            quantity_consumed: p.quantity_consumed,
          }))
        );
        if (pErr) throw pErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production_logs'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['raw_materials'] });
      toast({ title: 'Production log updated', description: 'Inventory adjusted.' });
    },
    onError: (e: any) => {
      logError('updateProductionLog', e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });
}

export function useDeleteProductionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('production_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production_logs'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['raw_materials'] });
      toast({ title: 'Production log deleted', description: 'Inventory reverted.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
