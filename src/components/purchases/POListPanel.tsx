import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ClipboardList, Loader2, MoreHorizontal, CheckCircle2, Send, PackageCheck, XCircle, Trash2, FileDown,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { usePurchaseOrders, type POStatus } from '@/hooks/usePurchaseOrders';
import { useCompanySettings, useParties } from '@/hooks/useBilling';
import { generatePOPdf } from '@/lib/purchases/poPdf';
import { toast } from 'sonner';
import { NewPODialog } from './NewPODialog';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
const monthKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const STATUS_META: Record<POStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  approved: { label: 'Approved', className: 'bg-primary/15 text-primary border-primary/30' },
  sent: { label: 'Sent', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  partially_received: { label: 'Partial', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  received: { label: 'Received', className: 'bg-success/15 text-success border-success/30' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export function POListPanel() {
  const { orders, isLoading, updateStatus, removePO, getWithItems } = usePurchaseOrders();
  const { data: company } = useCompanySettings();
  const { data: parties = [] } = useParties();
  const [selectedMonth, setSelectedMonth] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');

  const handleDownloadPdf = async (poId: string, poNumber: string | null, vendorId: string | null) => {
    try {
      const full = await getWithItems(poId);
      const vendor = vendorId ? parties.find((p) => p.id === vendorId) ?? null : null;
      const pdf = await generatePOPdf(full, company ?? null, vendor);
      pdf.save(`${poNumber || 'PO'}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate PDF');
    }
  };

  const months = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => s.add(monthKey(o.po_date)));
    return Array.from(s).sort((a, b) => (a < b ? 1 : -1));
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter(
      (o) =>
        (selectedMonth === 'all' || monthKey(o.po_date) === selectedMonth) &&
        (statusFilter === 'all' || o.status === statusFilter),
    );
  }, [orders, selectedMonth, statusFilter]);

  const monthTotal = filtered.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0), 0);
  const openCount = filtered.filter((o) => !['received', 'cancelled'].includes(o.status)).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-secondary/5 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-primary" /> Purchase Orders
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl md:text-4xl font-bold tabular-nums">{inr(monthTotal)}</span>
              <span className="text-sm text-muted-foreground">{filtered.length} POs · {openCount} open</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedMonth === 'all' ? 'All time' : monthLabel(selectedMonth)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NewPODialog />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
              <NewPODialog trigger={<Button size="sm">Create first PO</Button>} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((po) => {
                  const meta = STATUS_META[po.status];
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-xs">{po.po_number ?? '—'}</TableCell>
                      <TableCell className="font-medium">{po.vendor_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(po.po_date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString('en-GB') : '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={meta.className}>{meta.label}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{inr(Number(po.total))}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {po.status === 'draft' && (
                              <DropdownMenuItem onClick={() => updateStatus({ id: po.id, status: 'approved' })}>
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                              </DropdownMenuItem>
                            )}
                            {po.status === 'approved' && (
                              <DropdownMenuItem onClick={() => updateStatus({ id: po.id, status: 'sent' })}>
                                <Send className="w-4 h-4 mr-2" /> Mark sent to vendor
                              </DropdownMenuItem>
                            )}
                            {(po.status === 'sent' || po.status === 'approved' || po.status === 'partially_received') && (
                              <DropdownMenuItem onClick={() => updateStatus({ id: po.id, status: 'received' })}>
                                <PackageCheck className="w-4 h-4 mr-2" /> Mark received
                              </DropdownMenuItem>
                            )}
                            {po.status !== 'cancelled' && po.status !== 'received' && (
                              <DropdownMenuItem onClick={() => updateStatus({ id: po.id, status: 'cancelled' })}>
                                <XCircle className="w-4 h-4 mr-2" /> Cancel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (confirm(`Delete PO ${po.po_number}?`)) removePO(po.id);
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
