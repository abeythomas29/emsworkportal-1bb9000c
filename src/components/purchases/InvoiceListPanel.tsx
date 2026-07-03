import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Receipt, Loader2, MoreHorizontal, Trash2, FileText, ExternalLink, Wallet,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { usePurchaseInvoices, type PaymentStatus } from '@/hooks/usePurchaseInvoices';
import { UploadInvoiceDialog } from './UploadInvoiceDialog';
import { toast } from 'sonner';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
const inrCompact = (v: number) => {
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return inr(v);
};
const monthKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const PAY_META: Record<PaymentStatus, { label: string; className: string }> = {
  unpaid: { label: 'Unpaid', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  partial: { label: 'Partial', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  paid: { label: 'Paid', className: 'bg-success/15 text-success border-success/30' },
};

export function InvoiceListPanel() {
  const { invoices, isLoading, updatePayment, removeInvoice, getSignedUrl } = usePurchaseInvoices();
  const [selectedMonth, setSelectedMonth] = useState<string | 'all'>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [search, setSearch] = useState('');

  const months = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach((i) => s.add(monthKey(i.invoice_date)));
    return Array.from(s).sort((a, b) => (a < b ? 1 : -1));
  }, [invoices]);

  const filtered = useMemo(
    () => invoices.filter((i) =>
      (selectedMonth === 'all' || monthKey(i.invoice_date) === selectedMonth) &&
      (!search || i.vendor_name.toLowerCase().includes(search.toLowerCase()) || (i.invoice_no ?? '').toLowerCase().includes(search.toLowerCase())),
    ),
    [invoices, selectedMonth, search],
  );

  const totalSpend = filtered.reduce((s, i) => s + Number(i.total || 0), 0);
  const outstanding = filtered.reduce((s, i) => s + (Number(i.total || 0) - Number(i.amount_paid || 0)), 0);

  const openAttachment = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) window.open(url, '_blank');
    else toast.error('Could not open attachment');
  };

  const markPaid = (id: string, total: number) => updatePayment({ id, amount_paid: total, total });
  const markUnpaid = (id: string, total: number) => updatePayment({ id, amount_paid: 0, total });

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-background to-secondary/10 p-6">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-primary" /> Total Purchases
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-4xl md:text-5xl font-bold tabular-nums">{inrCompact(totalSpend)}</span>
              <span className="text-sm text-muted-foreground">{filtered.length} invoices</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedMonth === 'all' ? 'All time' : monthLabel(selectedMonth)} · Outstanding {inr(outstanding)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v as any)}>
              <SelectTrigger className="w-48 bg-background/70 backdrop-blur border-primary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <UploadInvoiceDialog />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Input
              placeholder="Search vendor or invoice #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="text-xs text-muted-foreground">
              Outstanding: <span className="font-semibold text-warning">{inr(outstanding)}</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Receipt className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No invoices for this period.</p>
              <UploadInvoiceDialog trigger={<Button size="sm">Upload first invoice</Button>} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const meta = PAY_META[inv.payment_status];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {inv.invoice_no ?? '—'}
                          {inv.attachment_path && (
                            <button
                              type="button"
                              onClick={() => openAttachment(inv.attachment_path!)}
                              className="text-primary hover:underline"
                              title="Open attachment"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{inv.vendor_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell><Badge variant="outline" className={meta.className}>{meta.label}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{inr(Number(inv.amount_paid))}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{inr(Number(inv.total))}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {inv.payment_status !== 'paid' && (
                              <DropdownMenuItem onClick={() => markPaid(inv.id, Number(inv.total))}>
                                <Wallet className="w-4 h-4 mr-2" /> Mark fully paid
                              </DropdownMenuItem>
                            )}
                            {inv.payment_status !== 'unpaid' && (
                              <DropdownMenuItem onClick={() => markUnpaid(inv.id, Number(inv.total))}>
                                <Wallet className="w-4 h-4 mr-2" /> Mark unpaid
                              </DropdownMenuItem>
                            )}
                            {inv.attachment_path && (
                              <DropdownMenuItem onClick={() => openAttachment(inv.attachment_path!)}>
                                <ExternalLink className="w-4 h-4 mr-2" /> Open attachment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (confirm(`Delete invoice from ${inv.vendor_name}?`)) removeInvoice(inv);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
