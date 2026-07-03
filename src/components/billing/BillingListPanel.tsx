import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Plus, Search, Loader2, Pencil, Trash2, FileText, Receipt, FileCheck2 } from 'lucide-react';
import {
  BillingDocument,
  useBillingDocument,
  useBillingDocuments,
  useDeleteBillingDocument,
  useSaveBillingDocument,
} from '@/hooks/useBilling';
import { BillingDocumentDialog } from './BillingDocumentDialog';

type DocType = BillingDocument['doc_type'];

const TYPE_LABEL: Record<DocType, string> = {
  tax_invoice: 'Tax Invoice',
  proforma: 'Proforma Invoice',
  estimate: 'Estimate',
};

const TYPE_ICON: Record<DocType, React.ComponentType<{ className?: string }>> = {
  tax_invoice: Receipt,
  proforma: FileCheck2,
  estimate: FileText,
};

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
  const [pendingDelete, setPendingDelete] = useState<BillingDocument | null>(null);

  const openNew = (type: DocType) => {
    setInitialType(type);
    setActiveType(type);
    setEditingId(null);
    setDialogOpen(true);
  };

  return (
    <>
      <Tabs value={activeType} onValueChange={(v) => setActiveType(v as DocType)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          {(['tax_invoice', 'proforma', 'estimate'] as DocType[]).map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <TabsTrigger key={t} value={t} className="gap-2">
                <Icon className="w-4 h-4" /> {TYPE_LABEL[t]}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(['tax_invoice', 'proforma', 'estimate'] as DocType[]).map((t) => (
          <TabsContent key={t} value={t} className="space-y-4">
            <TypeSection
              docType={t}
              docs={docs.filter((d) => d.doc_type === t)}
              isLoading={isLoading}
              q={q}
              setQ={setQ}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onNew={() => openNew(t)}
              onEdit={(id) => { setEditingId(id); setDialogOpen(true); }}
              onDelete={(d) => setPendingDelete(d)}
            />
          </TabsContent>
        ))}
      </Tabs>

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
              Delete {pendingDelete ? TYPE_LABEL[pendingDelete.doc_type] : ''}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {monthly.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No {TYPE_LABEL[docType].toLowerCase()}s yet.
            </CardContent>
          </Card>
        ) : (
          monthly.map(([k, v]) => (
            <Card key={k}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{monthLabel(k)}</p>
                <p className="text-lg font-semibold mt-1">{formatCurrency(v.total)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.count} {v.count === 1 ? 'doc' : 'docs'}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-lg font-semibold">All {TYPE_LABEL[docType]}s</CardTitle>
          <Button onClick={onNew}>
            <Plus className="w-4 h-4 mr-1" /> New {TYPE_LABEL[docType]}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search number or party…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="finalized">Finalized</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No documents found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    const partyName = (d.party_snapshot as { name?: string } | null)?.name || '—';
                    return (
                      <TableRow key={d.id} className="cursor-pointer" onClick={() => onEdit(d.id)}>
                        <TableCell className="font-mono text-xs">{d.doc_number || <span className="text-muted-foreground">DRAFT</span>}</TableCell>
                        <TableCell>{formatDate(d.doc_date)}</TableCell>
                        <TableCell className="max-w-[240px] truncate">{partyName}</TableCell>
                        <TableCell>
                          {d.status === 'finalized' ? (
                            <Badge className="bg-success text-success-foreground">Finalized</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(d.total))}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" onClick={() => onEdit(d.id)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => onDelete(d)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
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
      onDone(newId);
    })();
  }

  return null;
}
