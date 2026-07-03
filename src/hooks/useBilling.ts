import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ---------- Company settings ----------
export interface CompanySettings {
  id: string;
  name: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  country: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  bank_micr: string | null;
  bank_branch_code: string | null;
  bank_swift: string | null;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company_settings'],
    queryFn: async (): Promise<CompanySettings | null> => {
      const { data, error } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<CompanySettings> & { id: string }) => {
      const { id, ...rest } = values;
      const { error } = await supabase.from('company_settings').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company_settings'] });
      toast.success('Company details saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Parties ----------
export interface Party {
  id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  gst_type: string;
  billing_street: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_state_code: string | null;
  billing_pincode: string | null;
  billing_country: string | null;
  shipping_same: boolean;
  shipping_street: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_state_code: string | null;
  shipping_pincode: string | null;
  shipping_country: string | null;
  notes: string | null;
}

export function useParties() {
  return useQuery({
    queryKey: ['parties'],
    queryFn: async (): Promise<Party[]> => {
      const { data, error } = await supabase.from('parties').select('*').order('name');
      if (error) throw error;
      return (data || []) as Party[];
    },
  });
}

export function useUpsertParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Party> & { name: string }) => {
      if (values.id) {
        const { id, ...rest } = values;
        const { error } = await supabase.from('parties').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('parties')
          .insert({ ...values, created_by: userData.user?.id } as never)
          .select()
          .single();
        if (error) throw error;
        return data as Party;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parties'] });
      toast.success('Party saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parties'] });
      toast.success('Party deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Number series ----------
export interface NumberSeries {
  id: string;
  doc_type: string;
  financial_year: string;
  prefix: string;
  next_number: number;
}

export function useNumberSeries() {
  return useQuery({
    queryKey: ['billing_number_series'],
    queryFn: async (): Promise<NumberSeries[]> => {
      const { data, error } = await supabase
        .from('billing_number_series')
        .select('*')
        .order('doc_type')
        .order('financial_year');
      if (error) throw error;
      return (data || []) as NumberSeries[];
    },
  });
}

export function useUpdateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; prefix?: string; next_number?: number }) => {
      const { id, ...rest } = v;
      const { error } = await supabase.from('billing_number_series').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_number_series'] });
      toast.success('Series updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Billing documents ----------
export interface BillingDocument {
  id: string;
  doc_type: 'tax_invoice' | 'proforma' | 'estimate';
  status: 'draft' | 'finalized';
  doc_number: string | null;
  financial_year: string | null;
  doc_date: string;
  party_id: string | null;
  party_snapshot: Record<string, unknown> | null;
  place_of_supply_state: string | null;
  place_of_supply_code: string | null;
  payment_mode: string | null;
  terms: string | null;
  notes: string | null;
  sub_total: number;
  total_discount: number;
  total_tax: number;
  round_off: number;
  total: number;
  total_in_words: string | null;
  tax_summary: unknown;
  sales_invoice_id: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingDocumentItem {
  id: string;
  document_id: string;
  position: number;
  product_id: string | null;
  item_name: string;
  description: string | null;
  hsn_sac: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax_amount: number;
  amount: number;
}

export function useBillingDocuments() {
  return useQuery({
    queryKey: ['billing_documents'],
    queryFn: async (): Promise<BillingDocument[]> => {
      const { data, error } = await supabase
        .from('billing_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BillingDocument[];
    },
  });
}

export function useBillingDocument(id: string | null) {
  return useQuery({
    enabled: !!id,
    queryKey: ['billing_documents', id],
    queryFn: async () => {
      const { data: doc, error } = await supabase.from('billing_documents').select('*').eq('id', id!).single();
      if (error) throw error;
      const { data: items, error: e2 } = await supabase
        .from('billing_document_items')
        .select('*')
        .eq('document_id', id!)
        .order('position');
      if (e2) throw e2;
      return { doc: doc as BillingDocument, items: (items || []) as BillingDocumentItem[] };
    },
  });
}

export interface SaveDocumentInput {
  id?: string;
  header: Partial<BillingDocument> & { doc_type: BillingDocument['doc_type']; doc_date: string };
  items: Omit<BillingDocumentItem, 'id' | 'document_id'>[];
}

export function useSaveBillingDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, header, items }: SaveDocumentInput): Promise<string> => {
      const { data: userData } = await supabase.auth.getUser();
      let docId = id;
      if (docId) {
        const { error } = await supabase.from('billing_documents').update(header as never).eq('id', docId);
        if (error) throw error;
        await supabase.from('billing_document_items').delete().eq('document_id', docId);
      } else {
        const { data, error } = await supabase
          .from('billing_documents')
          .insert({ ...header, created_by: userData.user?.id } as never)
          .select('id')
          .single();
        if (error) throw error;
        docId = (data as { id: string }).id;
      }
      if (items.length) {
        const rows = items.map((it, i) => ({ ...it, position: i, document_id: docId! }));
        const { error } = await supabase.from('billing_document_items').insert(rows as never);
        if (error) throw error;
      }
      return docId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_documents'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFinalizeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, doc_type }: { id: string; doc_type: BillingDocument['doc_type'] }) => {
      const fn = doc_type === 'tax_invoice' ? 'finalize_tax_invoice' : 'finalize_billing_document';
      const { data, error } = await supabase.rpc(fn, { _document_id: id });
      if (error) throw error;
      return data as { doc_number: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['billing_documents'] });
      qc.invalidateQueries({ queryKey: ['sales_invoices'] });
      toast.success(`Finalized as ${data.doc_number}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBillingDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('billing_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_documents'] });
      toast.success('Document deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
