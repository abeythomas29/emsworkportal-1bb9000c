import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, FileText, FileCheck2, AlertCircle, CheckCircle2, FileDown, Download, Phone, MapPin, Building2, Pencil, MessageCircle } from 'lucide-react';
import { Party } from '@/hooks/useBilling';
import { BillingDocumentDialog } from './BillingDocumentDialog';
import { PartyDialog } from './PartyDialog';

function inr(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function normalizePhoneForWa(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function buildInquiryMessage(partyName: string): string {
  const first = (partyName || '').trim().split(/\s+/)[0] || 'there';
  return `${greetingForNow()}, ${first}!\n\nThis is Abey from Esoteric Mineral Solutions. Hope you're doing well.\n\nJust checking in to see if you have any upcoming requirements we can help you with. Happy to share updated pricing, samples, or our latest catalogue if useful: https://esotericminerals.com/\n\nLooking forward to hearing from you.`;
}

type LedgerRow = {
  id: string;
  docId: string | null; // linked billing_documents.id for PDF preview (if any)
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
    // Map sales_invoice_id -> billing_document.id so ledger rows can open the source doc
    const salesIdToDocId = new Map<string, string>();
    for (const d of billingDocs) {
      if (d.sales_invoice_id) salesIdToDocId.set(d.sales_invoice_id as string, d.id);
    }

    const list: LedgerRow[] = [];

    for (const s of salesInvoices) {
      list.push({
        id: `s-${s.id}`,
        docId: salesIdToDocId.get(s.id) ?? null,
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
        docId: d.id,
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

  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleRowClick = (r: LedgerRow) => {
    if (r.docId) {
      setOpenDocId(r.docId);
    } else {
      toast.info('PDF not available for this legacy invoice.');
    }
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.info('No transactions to export.');
      return;
    }
    const sheetRows = rows.map((r) => ({
      Date: fmtDate(r.date),
      'Document #': r.number,
      Type: KIND_META[r.kind].label,
      Status: r.cancelled ? 'Cancelled' : r.status,
      Amount: r.total,
      Received: r.received,
      Balance: r.balance,
    }));
    sheetRows.push({
      Date: '', 'Document #': '', Type: '', Status: 'TOTAL',
      Amount: summary.invoiced, Received: summary.received, Balance: summary.outstanding,
    } as any);
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    const safeName = (partyName || 'Party').replace(/[\/\\:*?"<>|]+/g, '_').slice(0, 60);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    XLSX.writeFile(wb, `Ledger_${safeName}_${stamp}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">

        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xl">Party Ledger — {partyName || '—'}</DialogTitle>
              <DialogDescription>
                All transactions and outstanding balances for this customer.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                size="sm"
                onClick={() => {
                  const wa = normalizePhoneForWa(party?.phone || '');
                  if (!wa) { toast.error('No phone number on this party. Add one first.'); return; }
                  const msg = buildInquiryMessage(partyName);
                  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                }}
                disabled={!party?.phone}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                title={party?.phone ? 'Send WhatsApp inquiry' : 'Add a phone number to enable WhatsApp'}
              >
                <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={!party}>
                <Pencil className="w-4 h-4 mr-1.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={isLoading || rows.length === 0}>
                <Download className="w-4 h-4 mr-1.5" /> Excel
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Contact & Address */}
        <PartyContactCard party={party} />

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
                      <TableHead className="text-right text-[11px] uppercase tracking-wider w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const meta = KIND_META[r.kind];
                      const Icon = meta.icon;
                      const isOutstanding = r.balance > 0 && !r.cancelled;
                      const clickable = !!r.docId;
                      return (
                        <TableRow
                          key={r.id}
                          onClick={() => handleRowClick(r)}
                          className={`border-border/50 ${clickable ? 'cursor-pointer hover:bg-muted/40 transition-colors' : 'cursor-not-allowed opacity-80'}`}
                          title={clickable ? 'Open document' : 'PDF not available for this legacy invoice'}
                        >
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
                          <TableCell className="text-right">
                            {clickable ? (
                              <FileDown className="w-4 h-4 inline text-muted-foreground" aria-label="Open PDF" />
                            ) : null}
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

      <BillingDocumentDialog
        open={!!openDocId}
        onOpenChange={(o) => { if (!o) setOpenDocId(null); }}
        documentId={openDocId}
        initialType="tax_invoice"
      />

      <PartyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        party={party}
      />
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

function PartyContactCard({ party }: { party: Party | null }) {
  if (!party) return null;
  const billingParts = [
    party.billing_street,
    party.billing_city,
    party.billing_state,
    party.billing_pincode,
    party.billing_country,
  ].filter(Boolean);
  const billing = billingParts.join(', ');
  const shipping = party.shipping_same
    ? ''
    : [
        party.shipping_street,
        party.shipping_city,
        party.shipping_state,
        party.shipping_pincode,
        party.shipping_country,
      ].filter(Boolean).join(', ');

  const hasAny = party.phone || party.gstin || billing || shipping;
  if (!hasAny) return null;

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-4 grid gap-3 md:grid-cols-2">
      <div className="space-y-2 text-sm">
        {party.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <a href={`tel:${party.phone}`} className="hover:underline tabular-nums">{party.phone}</a>
          </div>
        )}
        {party.gstin && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <span className="font-mono text-xs">{party.gstin}</span>
            <Badge variant="outline" className="text-[10px] uppercase">{party.gst_type}</Badge>
          </div>
        )}
      </div>
      <div className="space-y-2 text-sm">
        {billing && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Billing address</p>
              <p className="text-foreground">{billing}</p>
            </div>
          </div>
        )}
        {shipping && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Shipping address</p>
              <p className="text-foreground">{shipping}</p>
            </div>
          </div>
        )}
      </div>
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
