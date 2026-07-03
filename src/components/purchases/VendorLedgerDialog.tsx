import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Receipt, ClipboardList, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Party } from '@/hooks/useBilling';

const client = supabase as any;

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
  kind: 'po' | 'invoice';
  status: string;
  total: number;
  paid: number;
  balance: number;
};

const KIND_META: Record<LedgerRow['kind'], { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  invoice: { label: 'Invoice', icon: Receipt, tone: 'bg-primary/15 text-primary border-primary/30' },
  po: { label: 'Purchase Order', icon: ClipboardList, tone: 'bg-secondary/15 text-secondary-foreground border-secondary/30' },
};

export function VendorLedgerDialog({
  vendor,
  open,
  onOpenChange,
}: {
  vendor: Party | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const vendorId = vendor?.id ?? null;
  const vendorName = vendor?.name ?? '';

  const { data: pos = [], isLoading: loadingPOs } = useQuery({
    queryKey: ['vendor-ledger-pos', vendorId, vendorName],
    enabled: !!vendor && open,
    queryFn: async () => {
      const { data, error } = await client
        .from('purchase_orders')
        .select('id, po_number, po_date, status, total, vendor_id, vendor_name')
        .or(`vendor_id.eq.${vendorId},vendor_name.eq.${vendorName}`)
        .order('po_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoices = [], isLoading: loadingInvs } = useQuery({
    queryKey: ['vendor-ledger-invoices', vendorId, vendorName],
    enabled: !!vendor && open,
    queryFn: async () => {
      const { data, error } = await client
        .from('purchase_invoices')
        .select('id, invoice_no, invoice_date, total, amount_paid, payment_status, vendor_id, vendor_name')
        .or(`vendor_id.eq.${vendorId},vendor_name.eq.${vendorName}`)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingPOs || loadingInvs;

  const { rows, summary } = useMemo(() => {
    const list: LedgerRow[] = [];

    for (const inv of invoices) {
      const total = Number(inv.total) || 0;
      const paid = Number(inv.amount_paid) || 0;
      list.push({
        id: `i-${inv.id}`,
        date: inv.invoice_date,
        number: inv.invoice_no || 'DRAFT',
        kind: 'invoice',
        status: inv.payment_status,
        total,
        paid,
        balance: Math.max(0, total - paid),
      });
    }
    for (const po of pos) {
      list.push({
        id: `p-${po.id}`,
        date: po.po_date,
        number: po.po_number || 'DRAFT',
        kind: 'po',
        status: po.status,
        total: Number(po.total) || 0,
        paid: 0,
        balance: 0,
      });
    }
    list.sort((a, b) => (a.date < b.date ? 1 : -1));

    let invoiced = 0;
    let paid = 0;
    let outstanding = 0;
    for (const inv of invoices) {
      const t = Number(inv.total) || 0;
      const p = Number(inv.amount_paid) || 0;
      invoiced += t;
      paid += p;
      outstanding += Math.max(0, t - p);
    }
    const orderedTotal = pos.reduce((s, po) => s + (Number(po.total) || 0), 0);
    const pendingCount = invoices.filter((i) => i.payment_status !== 'paid').length;

    return {
      rows: list,
      summary: { invoiced, paid, outstanding, ordered: orderedTotal, pendingCount, txCount: list.length },
    };
  }, [pos, invoices]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Vendor Ledger — {vendorName || '—'}</DialogTitle>
          <DialogDescription>All purchase orders, invoices, and outstanding balances for this vendor.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <SummaryTile label="Total Ordered" value={inr(summary.ordered)} tone="muted" />
          <SummaryTile label="Total Invoiced" value={inr(summary.invoiced)} tone="muted" />
          <SummaryTile label="Paid" value={inr(summary.paid)} tone="success" icon={<CheckCircle2 className="w-4 h-4" />} />
          <SummaryTile
            label="Outstanding"
            value={inr(summary.outstanding)}
            tone={summary.outstanding > 0 ? 'warning' : 'success'}
            icon={summary.outstanding > 0 ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            hint={`${summary.pendingCount} pending · ${summary.txCount} txns`}
          />
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border/60 rounded-xl">
              No transactions recorded for this vendor yet.
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
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Paid</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const meta = KIND_META[r.kind];
                      const Icon = meta.icon;
                      const isOutstanding = r.balance > 0;
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
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{inr(r.total)}</TableCell>
                          <TableCell className="text-right tabular-nums text-success">
                            {r.paid > 0 ? inr(r.paid) : '—'}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums font-semibold ${isOutstanding ? 'text-warning' : 'text-muted-foreground'}`}>
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
  label, value, hint, tone, icon,
}: {
  label: string; value: string; hint?: string; tone: 'muted' | 'success' | 'warning'; icon?: React.ReactNode;
}) {
  const tones = {
    muted: 'border-border/60 bg-card',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/40 bg-warning/10',
  } as const;
  const textTones = { muted: 'text-foreground', success: 'text-success', warning: 'text-warning' } as const;
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
        {icon}{label}
      </div>
      <p className={`mt-2 text-lg font-bold tabular-nums ${textTones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Paid', className: 'bg-success/15 text-success border-success/30' },
    partial: { label: 'Partial', className: 'bg-warning/15 text-warning border-warning/40' },
    unpaid: { label: 'Unpaid', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
    approved: { label: 'Approved', className: 'bg-primary/15 text-primary border-primary/30' },
    sent: { label: 'Sent', className: 'bg-primary/15 text-primary border-primary/30' },
    partially_received: { label: 'Partial recv', className: 'bg-warning/15 text-warning border-warning/40' },
    received: { label: 'Received', className: 'bg-success/15 text-success border-success/30' },
    cancelled: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge className={`border ${s.className} hover:${s.className}`}>{s.label}</Badge>;
}
