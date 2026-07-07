import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Receipt, FileText, FileCheck2, AlertCircle, CheckCircle2, FileDown } from 'lucide-react';
import { Party } from '@/hooks/useBilling';
import { BillingDocumentDialog } from './BillingDocumentDialog';

function inr(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type LedgerRow = {
  id: string;
  date: string;
  number: string;
  kind: 'tax_invoice' | 'proforma' | 'estimate' | 'sales_invoice';
  status: string;
  total: number;
  received: number;
  balance: number;
  cancelled?: boolean;
};

const KIND_META: Record<
  LedgerRow['kind'],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  tax_invoice: { label: 'Tax Invoice', icon: Receipt, tone: 'bg-primary/15 text-primary border-primary/30' },
  sales_invoice: { label: 'Sale', icon: Receipt, tone: 'bg-primary/15 text-primary border-primary/30' },
  proforma: { label: 'Proforma', icon: FileCheck2, tone: 'bg-secondary/15 text-secondary-foreground border-secondary/30' },
  estimate: { label: 'Estimate', icon: FileText, tone: 'bg-muted text-muted-foreground border-border' },
};

export function PartyLedgerDialog({
  party,
  open,
  onOpenChange,
}: {
  party: Party | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const partyId = party?.id ?? null;
  const partyName = party?.name ?? '';

  const { data: billingDocs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['party-ledger-docs', partyId],
    enabled: !!partyId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_documents')
        .select('id, doc_number, doc_date, doc_type, status, total, sales_invoice_id')
        .eq('party_id', partyId!)
        .order('doc_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: salesInvoices = [], isLoading: loadingSales } = useQuery({
    queryKey: ['party-ledger-sales', partyName],
    enabled: !!partyName && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, invoice_no, invoice_date, total_amount, received_amount, balance_due, is_cancelled, payment_type')
        .eq('party_name', partyName)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingDocs || loadingSales;

  const { rows, summary } = useMemo(() => {
    // Sales invoices dominate for finalized tax-invoice tracking. Skip billing docs that are already mirrored.
    const mirroredSalesIds = new Set(
      billingDocs.filter((d) => d.sales_invoice_id).map((d) => d.sales_invoice_id as string),
    );

    const list: LedgerRow[] = [];

    for (const s of salesInvoices) {
      list.push({
        id: `s-${s.id}`,
        date: s.invoice_date,
        number: s.invoice_no,
        kind: 'sales_invoice',
        status: s.is_cancelled ? 'cancelled' : Number(s.balance_due) <= 0 ? 'paid' : 'pending',
        total: Number(s.total_amount) || 0,
        received: Number(s.received_amount) || 0,
        balance: Number(s.balance_due) || 0,
        cancelled: s.is_cancelled,
      });
    }

    for (const d of billingDocs) {
      // Skip finalized tax invoices already represented by their sales_invoices row
      if (d.doc_type === 'tax_invoice' && d.sales_invoice_id && mirroredSalesIds.has(d.sales_invoice_id)) continue;
      list.push({
        id: `d-${d.id}`,
        date: d.doc_date,
        number: d.doc_number || 'DRAFT',
        kind: d.doc_type as LedgerRow['kind'],
        status: d.status,
        total: Number(d.total) || 0,
        received: 0,
        balance: d.doc_type === 'tax_invoice' && d.status === 'finalized' ? Number(d.total) || 0 : 0,
      });
    }

    list.sort((a, b) => (a.date < b.date ? 1 : -1));

    // Financial summary — only real sales count as ledger obligations
    let invoiced = 0;
    let received = 0;
    let outstanding = 0;
    for (const s of salesInvoices) {
      if (s.is_cancelled) continue;
      invoiced += Number(s.total_amount) || 0;
      received += Number(s.received_amount) || 0;
      outstanding += Number(s.balance_due) || 0;
    }
    const pendingCount = salesInvoices.filter((s) => !s.is_cancelled && Number(s.balance_due) > 0).length;

    return { rows: list, summary: { invoiced, received, outstanding, pendingCount, txCount: list.length } };
  }, [billingDocs, salesInvoices]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Party Ledger — {partyName || '—'}</DialogTitle>
          <DialogDescription>
            All transactions and outstanding balances for this customer.
          </DialogDescription>
        </DialogHeader>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <SummaryTile label="Total Invoiced" value={inr(summary.invoiced)} tone="muted" />
          <SummaryTile label="Received" value={inr(summary.received)} tone="success" icon={<CheckCircle2 className="w-4 h-4" />} />
          <SummaryTile
            label="Outstanding"
            value={inr(summary.outstanding)}
            tone={summary.outstanding > 0 ? 'warning' : 'success'}
            icon={summary.outstanding > 0 ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          />
          <SummaryTile
            label="Pending Bills"
            value={String(summary.pendingCount)}
            hint={`${summary.txCount} total transactions`}
            tone={summary.pendingCount > 0 ? 'warning' : 'muted'}
          />
        </div>

        {/* Transactions */}
        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border/60 rounded-xl">
              No transactions recorded for this party yet.
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60 bg-muted/40">
                      <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Document</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Received</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const meta = KIND_META[r.kind];
                      const Icon = meta.icon;
                      const isOutstanding = r.balance > 0 && !r.cancelled;
                      return (
                        <TableRow key={r.id} className="border-border/50">
                          <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.date)}</TableCell>
                          <TableCell className="font-mono text-xs font-medium">{r.number}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${meta.tone}`}>
                              <Icon className="w-3 h-3" />
                              {meta.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{inr(r.total)}</TableCell>
                          <TableCell className="text-right tabular-nums text-success">
                            {r.received > 0 ? inr(r.received) : '—'}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-semibold ${
                              isOutstanding ? 'text-warning' : 'text-muted-foreground'
                            }`}
                          >
                            {isOutstanding ? inr(r.balance) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'muted' | 'success' | 'warning';
  icon?: React.ReactNode;
}) {
  const tones = {
    muted: 'border-border/60 bg-card',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/40 bg-warning/10',
  } as const;
  const textTones = {
    muted: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
  } as const;
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-lg font-bold tabular-nums ${textTones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Paid', className: 'bg-success/15 text-success border-success/30' },
    pending: { label: 'Pending', className: 'bg-warning/15 text-warning border-warning/40' },
    cancelled: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    finalized: { label: 'Finalized', className: 'bg-success/15 text-success border-success/30' },
    draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge className={`border ${s.className} hover:${s.className}`}>{s.label}</Badge>;
}
