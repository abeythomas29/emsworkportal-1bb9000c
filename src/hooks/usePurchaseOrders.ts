import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type POStatus = 'draft' | 'approved' | 'sent' | 'partially_received' | 'received' | 'cancelled';

export interface POItem {
  id?: string;
  item_name: string;
  hsn_sac?: string | null;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  tax_percent: number;
  taxable_value?: number;
  tax_amount?: number;
  amount?: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string | null;
  vendor_id: string | null;
  vendor_name: string;
  vendor_gstin: string | null;
  po_date: string;
  expected_delivery: string | null;
  status: POStatus;
  notes: string | null;
  sub_total: number;
  total_tax: number;
  total: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  items?: POItem[];
}

const client = supabase as any;

export function usePurchaseOrders() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const list = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async (): Promise<PurchaseOrder[]> => {
      const { data, error } = await client
        .from('purchase_orders')
        .select('*')
        .order('po_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PurchaseOrder[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: {
      vendor_id?: string | null;
      vendor_name: string;
      vendor_gstin?: string | null;
      po_date: string;
      expected_delivery?: string | null;
      notes?: string | null;
      items: POItem[];
    }) => {
      const cleanItems = input.items.map((i) => {
        const gross = (Number(i.quantity) || 0) * (Number(i.unit_price) || 0);
        const taxable = gross;
        const tax = taxable * ((Number(i.tax_percent) || 0) / 100);
        return {
          item_name: i.item_name,
          hsn_sac: i.hsn_sac || null,
          description: i.description || null,
          quantity: Number(i.quantity) || 0,
          unit: i.unit || null,
          unit_price: Number(i.unit_price) || 0,
          tax_percent: Number(i.tax_percent) || 0,
          taxable_value: taxable,
          tax_amount: tax,
          amount: taxable + tax,
        };
      });
      const sub_total = cleanItems.reduce((s, i) => s + i.taxable_value, 0);
      const total_tax = cleanItems.reduce((s, i) => s + i.tax_amount, 0);
      const total = sub_total + total_tax;

      const yr = new Date(input.po_date).getFullYear();
      const m = new Date(input.po_date).getMonth() + 1;
      const fyStart = m >= 4 ? yr : yr - 1;
      const fy = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;

      const { data: po, error } = await client
        .from('purchase_orders')
        .insert({
          vendor_id: input.vendor_id ?? null,
          vendor_name: input.vendor_name,
          vendor_gstin: input.vendor_gstin ?? null,
          po_date: input.po_date,
          expected_delivery: input.expected_delivery ?? null,
          notes: input.notes ?? null,
          sub_total,
          total_tax,
          total,
          financial_year: fy,
          created_by: user?.id ?? null,
          status: 'draft',
          po_number: `PO-${fy}-${Date.now().toString().slice(-6)}`,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (cleanItems.length > 0) {
        const { error: itErr } = await client
          .from('purchase_order_items')
          .insert(cleanItems.map((it) => ({ ...it, po_id: po.id })));
        if (itErr) throw itErr;
      }
      return po.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order created');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create PO'),
  });

  const updateStatus = useMutation({
    mutationFn: async (input: { id: string; status: POStatus }) => {
      const patch: any = { status: input.status };
      if (input.status === 'approved') {
        patch.approved_by = user?.id ?? null;
        patch.approved_at = new Date().toISOString();
      }
      const { error } = await client.from('purchase_orders').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order deleted');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete'),
  });

  const getWithItems = async (id: string): Promise<PurchaseOrder & { items: POItem[] }> => {
    const { data: po, error } = await client.from('purchase_orders').select('*').eq('id', id).single();
    if (error) throw error;
    const { data: items } = await client.from('purchase_order_items').select('*').eq('po_id', id);
    return { ...(po as PurchaseOrder), items: (items ?? []) as POItem[] };
  };

  return {
    orders: list.data ?? [],
    isLoading: list.isLoading,
    createPO: create.mutateAsync,
    isCreating: create.isPending,
    updateStatus: updateStatus.mutateAsync,
    removePO: remove.mutateAsync,
    getWithItems,
  };
}
