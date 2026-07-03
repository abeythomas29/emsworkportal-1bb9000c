import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type ExtractionStatus = 'pending' | 'extracted' | 'manual' | 'failed';

export interface PurchaseInvoiceItem {
  id?: string;
  item_name: string;
  hsn_sac?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  tax_percent: number;
  taxable_value?: number;
  tax_amount?: number;
  amount: number;
}

export interface PurchaseInvoice {
  id: string;
  vendor_id: string | null;
  vendor_name: string;
  vendor_gstin: string | null;
  invoice_no: string | null;
  invoice_date: string;
  po_id: string | null;
  sub_total: number;
  total_tax: number;
  total: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  notes: string | null;
  attachment_path: string | null;
  attachment_mime: string | null;
  extraction_status: ExtractionStatus;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

const client = supabase as any;

export interface CreateInvoiceInput {
  vendor_id?: string | null;
  vendor_name: string;
  vendor_gstin?: string | null;
  invoice_no?: string | null;
  invoice_date: string;
  po_id?: string | null;
  sub_total: number;
  total_tax: number;
  total: number;
  amount_paid?: number;
  payment_status?: PaymentStatus;
  notes?: string | null;
  attachment_path?: string | null;
  attachment_mime?: string | null;
  extraction_status?: ExtractionStatus;
  extraction_raw?: any;
  items: PurchaseInvoiceItem[];
}

export function usePurchaseInvoices() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const list = useQuery({
    queryKey: ['purchase-invoices'],
    queryFn: async (): Promise<PurchaseInvoice[]> => {
      const { data, error } = await client
        .from('purchase_invoices')
        .select('*')
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PurchaseInvoice[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const paid = Number(input.amount_paid || 0);
      const ps: PaymentStatus =
        input.payment_status ?? (paid <= 0 ? 'unpaid' : paid >= input.total ? 'paid' : 'partial');

      const { data: inv, error } = await client
        .from('purchase_invoices')
        .insert({
          vendor_id: input.vendor_id ?? null,
          vendor_name: input.vendor_name,
          vendor_gstin: input.vendor_gstin ?? null,
          invoice_no: input.invoice_no ?? null,
          invoice_date: input.invoice_date,
          po_id: input.po_id ?? null,
          sub_total: input.sub_total,
          total_tax: input.total_tax,
          total: input.total,
          amount_paid: paid,
          payment_status: ps,
          notes: input.notes ?? null,
          attachment_path: input.attachment_path ?? null,
          attachment_mime: input.attachment_mime ?? null,
          extraction_status: input.extraction_status ?? 'manual',
          extraction_raw: input.extraction_raw ?? null,
          uploaded_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (input.items.length > 0) {
        const rows = input.items.map((i) => {
          const gross = (Number(i.quantity) || 0) * (Number(i.unit_price) || 0);
          const taxable = gross;
          const tax = taxable * ((Number(i.tax_percent) || 0) / 100);
          return {
            invoice_id: inv.id,
            item_name: i.item_name,
            hsn_sac: i.hsn_sac ?? null,
            quantity: Number(i.quantity) || 0,
            unit: i.unit ?? null,
            unit_price: Number(i.unit_price) || 0,
            tax_percent: Number(i.tax_percent) || 0,
            taxable_value: taxable,
            tax_amount: tax,
            amount: Number(i.amount) || taxable + tax,
          };
        });
        const { error: iErr } = await client.from('purchase_invoice_items').insert(rows);
        if (iErr) throw iErr;
      }
      return inv.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Purchase invoice saved');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save invoice'),
  });

  const updatePayment = useMutation({
    mutationFn: async (input: { id: string; amount_paid: number; total: number }) => {
      const ps: PaymentStatus =
        input.amount_paid <= 0 ? 'unpaid' : input.amount_paid >= input.total ? 'paid' : 'partial';
      const { error } = await client
        .from('purchase_invoices')
        .update({ amount_paid: input.amount_paid, payment_status: ps })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Payment updated');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const remove = useMutation({
    mutationFn: async (inv: PurchaseInvoice) => {
      if (inv.attachment_path) {
        await client.storage.from('purchase-invoices').remove([inv.attachment_path]);
      }
      const { error } = await client.from('purchase_invoices').delete().eq('id', inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Invoice deleted');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete'),
  });

  const getSignedUrl = async (path: string) => {
    const { data } = await client.storage.from('purchase-invoices').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  return {
    invoices: list.data ?? [],
    isLoading: list.isLoading,
    createInvoice: create.mutateAsync,
    isCreating: create.isPending,
    updatePayment: updatePayment.mutateAsync,
    removeInvoice: remove.mutateAsync,
    getSignedUrl,
  };
}
