import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Loader2, Pencil, Trash2, FileText, Receipt, FileCheck2, FilePlus2, Copy } from 'lucide-react';
import {
  BillingDocument,
  useBillingDocument,
  useBillingDocuments,
  useDeleteBillingDocument,
  useSaveBillingDocument,
} from '@/hooks/useBilling';
import { BillingDocumentDialog } from './BillingDocumentDialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type DocType = BillingDocument['doc_type'];

const TYPE_LABEL: Record<DocType, string> = {
  tax_invoice: 'Tax Invoice',
  proforma: 'Proforma',
  estimate: 'Estimate',
};

const TYPE_LABEL_FULL: Record<DocType, string> = {
  tax_invoice: 'Tax Invoice',
  proforma: 'Proforma Invoice',
  estimate: 'Estimate',
};

const TYPE_ICON: Record<DocType, React.ComponentType<{ className?: string }>> = {
  tax_invoice: Receipt,
  proforma: FileCheck2,
  estimate: FileText,
};

const DOC_TYPES: DocType[] = ['tax_invoice', 'proforma', 'estimate'];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
}
function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function BillingListPanel() {
  const { data: docs = [], isLoading } = useBillingDocuments();
  const del = useDeleteBillingDocument();
  const [activeType, setActiveType] = useState<DocType>('tax_invoice');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialType, setInitialType] = useState<DocType>('tax_invoice');
  const [convertSourceId, setConvertSourceId] = useState<string | null>(null);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BillingDocument | null>(null);

  const openNew = (type: DocType) => {
    setInitialType(type);
    setActiveType(type);
    setEditingId(null);
    setDialogOpen(true);
  };

  const scopedDocs = useMemo(() => docs.filter((d) => d.doc_type === activeType), [docs, activeType]);
  const ActiveIcon = TYPE_ICON[activeType];

  return (
    <>
      <div className="space-y-6">
        {/* Doc type segmented pill + primary action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div
            role="tablist"
            aria-label="Document type"
            className="inline-flex flex-wrap gap-1 p-1.5 rounded-xl bg-muted/60 border border-border/60"
          >
            {DOC_TYPES.map((t) => {
              const Icon = TYPE_ICON[t];
              const active = activeType === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveType(t)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-all min-h-11',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'bg-card text-foreground shadow-sm border border-border/70'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>

          <Button
            onClick={() => openNew(activeType)}
            size="lg"
            className="font-semibold shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.55)] min-h-11"
          >
            <Plus className="w-5 h-5 mr-2" />
            New {TYPE_LABEL_FULL[activeType]}
          </Button>
        </div>

        <TypeSection
          docType={activeType}
          docs={scopedDocs}
          isLoading={isLoading}
          q={q}
          setQ={setQ}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onNew={() => openNew(activeType)}
          onEdit={(id) => { setEditingId(id); setDialogOpen(true); }}
          onDelete={(d) => setPendingDelete(d)}
          onDuplicate={(id) => setDuplicateSourceId(id)}
          ActiveIcon={ActiveIcon}
        />
      </div>

      <BillingDocumentDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}
        documentId={editingId}
        initialType={initialType}
        onConvert={(id) => setConvertSourceId(id)}
      />

      {convertSourceId && (
        <ConvertToTaxInvoiceRunner
          sourceId={convertSourceId}
          onDone={(newId) => {
            setConvertSourceId(null);
            setInitialType('tax_invoice');
            setActiveType('tax_invoice');
            setEditingId(newId);
            setDialogOpen(true);
          }}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete ? TYPE_LABEL_FULL[pendingDelete.doc_type] : ''}
              {pendingDelete?.doc_number ? ` ${pendingDelete.doc_number}` : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document and its line items.
              {pendingDelete?.doc_type === 'tax_invoice' && pendingDelete?.status === 'finalized' && (
                <> The mirrored sales invoice will also be removed and stock will be restored.</>
              )}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) del.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TypeSection({
  docType,
  docs,
  isLoading,
  q,
  setQ,
  statusFilter,
  setStatusFilter,
  onNew,
  onEdit,
  onDelete,
  ActiveIcon,
}: {
  docType: DocType;
  docs: BillingDocument[];
  isLoading: boolean;
  q: string;
  setQ: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (d: BillingDocument) => void;
  ActiveIcon: React.ComponentType<{ className?: string }>;
}) {
  const monthly = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const d of docs) {
      const k = monthKey(d.doc_date);
      const cur = map.get(k) || { total: 0, count: 0 };
      cur.total += Number(d.total) || 0;
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6);
  }, [docs]);

  const totalAll = useMemo(() => docs.reduce((s, d) => s + Number(d.total || 0), 0), [docs]);

  const filtered = docs.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (q) {
      const term = q.toLowerCase();
      const partyName = (d.party_snapshot as { name?: string } | null)?.name || '';
      if (!(d.doc_number || '').toLowerCase().includes(term) && !partyName.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  return (
    <>
      {/* Monthly totals strip */}
      {monthly.length > 0 && (
        <section aria-label="Monthly totals" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {monthly.map(([k, v], idx) => (
            <Card
              key={k}
              className={cn(
                'border-border/60 transition-colors',
                idx === 0 && 'border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card',
              )}
            >
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {monthLabel(k)}
                </p>
                <p className="text-lg font-bold mt-1.5 tabular-nums text-foreground">{formatCurrency(v.total)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.count} {v.count === 1 ? 'doc' : 'docs'}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 md:p-4">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by document number or party…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 bg-background/60 border-border/60 rounded-xl focus-visible:ring-primary/40"
            aria-label="Search documents"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-44 h-11 bg-background/60 border-border/60 rounded-xl" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="finalized">Finalized</SelectItem>
          </SelectContent>
        </Select>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground px-2 whitespace-nowrap">
          <span className="tabular-nums font-semibold text-foreground">{filtered.length}</span>
          <span>of {docs.length} · total</span>
          <span className="tabular-nums font-semibold text-primary">{formatCurrency(totalAll)}</span>
        </div>
      </div>

      {/* List */}
      <div>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : docs.length === 0 ? (
          <EmptyState docType={docType} onNew={onNew} ActiveIcon={ActiveIcon} />
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="py-12 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No matches</p>
              <p className="text-xs text-muted-foreground">Try clearing your filters or search term.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="border-border/60 overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="text-[11px] uppercase tracking-wider">Number</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Party</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Total</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d) => {
                      const partyName = (d.party_snapshot as { name?: string } | null)?.name || '—';
                      return (
                        <TableRow
                          key={d.id}
                          className="cursor-pointer border-border/50 hover:bg-muted/40 transition-colors"
                          onClick={() => onEdit(d.id)}
                        >
                          <TableCell className="font-mono text-xs font-medium">
                            {d.doc_number || <span className="text-muted-foreground italic">DRAFT</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatDate(d.doc_date)}</TableCell>
                          <TableCell className="max-w-[240px] truncate text-sm" title={partyName}>{partyName}</TableCell>
                          <TableCell>
                            {d.status === 'finalized' ? (
                              <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/20">
                                Finalized
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-border/60 text-muted-foreground">Draft</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-primary">
                            {formatCurrency(Number(d.total))}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onEdit(d.id)}
                                aria-label={`Edit ${d.doc_number || 'draft'}`}
                                className="min-h-9 min-w-9"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onDelete(d)}
                                aria-label={`Delete ${d.doc_number || 'draft'}`}
                                className="min-h-9 min-w-9 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2.5">
              {filtered.map((d) => {
                const partyName = (d.party_snapshot as { name?: string } | null)?.name || '—';
                return (
                  <Card
                    key={d.id}
                    className="border-border/60 cursor-pointer active:bg-muted/40 transition-colors"
                    onClick={() => onEdit(d.id)}
                  >
                    <CardContent className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-semibold truncate">
                            {d.doc_number || <span className="text-muted-foreground italic">DRAFT</span>}
                          </p>
                          <p className="text-sm font-medium mt-0.5 truncate" title={partyName}>{partyName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(d.doc_date)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold tabular-nums text-primary">{formatCurrency(Number(d.total))}</p>
                          <div className="mt-1">
                            {d.status === 'finalized' ? (
                              <Badge className="bg-success/15 text-success border border-success/30 text-[10px]">Finalized</Badge>
                            ) : (
                              <Badge variant="outline" className="border-border/60 text-muted-foreground text-[10px]">Draft</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => onEdit(d.id)} className="h-9 gap-1.5">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(d)} className="h-9 gap-1.5 hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

      </div>
    </>
  );
}

function EmptyState({
  docType,
  onNew,
  ActiveIcon,
}: {
  docType: DocType;
  onNew: () => void;
  ActiveIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-dashed border-2 border-border/60 bg-gradient-to-br from-card via-card to-muted/20">
      <CardContent className="py-16 flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" aria-hidden />
          <div className="relative w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <ActiveIcon className="w-8 h-8" />
          </div>
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="text-lg font-semibold text-foreground">Ready to bill?</h3>
          <p className="text-sm text-muted-foreground">
            Your {TYPE_LABEL_FULL[docType].toLowerCase()}s will appear here. Start your first one now.
          </p>
        </div>
        <Button onClick={onNew} size="lg" className="mt-2 font-semibold min-h-11">
          <FilePlus2 className="w-5 h-5 mr-2" />
          Create your first {TYPE_LABEL_FULL[docType]}
        </Button>
      </CardContent>
    </Card>
  );
}

// Non-visual helper that reads source doc + items, saves them as a new draft tax invoice, then calls onDone.
function ConvertToTaxInvoiceRunner({ sourceId, onDone }: { sourceId: string; onDone: (id: string) => void }) {
  const { data } = useBillingDocument(sourceId);
  const save = useSaveBillingDocument();
  const [ran, setRan] = useState(false);

  if (data && !ran) {
    setRan(true);
    (async () => {
      const { doc, items } = data;
      const newId = await save.mutateAsync({
        header: {
          doc_type: 'tax_invoice',
          doc_date: new Date().toISOString().slice(0, 10),
          party_id: doc.party_id,
          party_snapshot: doc.party_snapshot as Record<string, unknown>,
          place_of_supply_state: doc.place_of_supply_state,
          place_of_supply_code: doc.place_of_supply_code,
          payment_mode: 'Credit',
          terms: doc.terms,
          notes: `Converted from ${doc.doc_number || 'draft'}`,
          sub_total: doc.sub_total,
          total_discount: doc.total_discount,
          total_tax: doc.total_tax,
          round_off: doc.round_off,
          total: doc.total,
          total_in_words: doc.total_in_words,
          tax_summary: doc.tax_summary as never,
          financial_year: doc.financial_year,
        },
        items: items.map((i, idx) => ({
          position: idx,
          product_id: i.product_id,
          item_name: i.item_name,
          description: i.description,
          hsn_sac: i.hsn_sac,
          quantity: i.quantity,
          unit: i.unit,
          unit_price: i.unit_price,
          discount_percent: i.discount_percent,
          discount_amount: i.discount_amount,
          tax_percent: i.tax_percent,
          taxable_value: i.taxable_value,
          cgst: i.cgst,
          sgst: i.sgst,
          igst: i.igst,
          tax_amount: i.tax_amount,
          amount: i.amount,
        })),
      });
      await supabase.from('billing_documents').update({ converted_to_id: newId } as never).eq('id', sourceId);
      onDone(newId);
    })();
  }

  return null;
}
