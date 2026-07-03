import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Loader2, Pencil, Trash2 } from 'lucide-react';
import { BillingDocument, useBillingDocument, useBillingDocuments, useDeleteBillingDocument, useSaveBillingDocument } from '@/hooks/useBilling';
import { BillingDocumentDialog } from './BillingDocumentDialog';

const TYPE_LABEL: Record<string, string> = {
  tax_invoice: 'Tax Invoice',
  proforma: 'Proforma',
  estimate: 'Estimate',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
}

export function BillingListPanel() {
  const { data: docs = [], isLoading } = useBillingDocuments();
  const del = useDeleteBillingDocument();
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialType, setInitialType] = useState<BillingDocument['doc_type']>('tax_invoice');
  const [convertSourceId, setConvertSourceId] = useState<string | null>(null);

  const filtered = docs.filter((d) => {
    if (typeFilter !== 'all' && d.doc_type !== typeFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (q) {
      const term = q.toLowerCase();
      const partyName = (d.party_snapshot as { name?: string } | null)?.name || '';
      if (!(d.doc_number || '').toLowerCase().includes(term) && !partyName.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const openNew = (type: BillingDocument['doc_type']) => {
    setInitialType(type);
    setEditingId(null);
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-lg font-semibold">Billing Documents</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openNew('estimate')}>
              <Plus className="w-4 h-4 mr-1" /> Estimate
            </Button>
            <Button variant="outline" onClick={() => openNew('proforma')}>
              <Plus className="w-4 h-4 mr-1" /> Proforma
            </Button>
            <Button onClick={() => openNew('tax_invoice')}>
              <Plus className="w-4 h-4 mr-1" /> Tax Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search number or party…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="tax_invoice">Tax Invoice</SelectItem>
                <SelectItem value="proforma">Proforma</SelectItem>
                <SelectItem value="estimate">Estimate</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    const partyName = (d.party_snapshot as { name?: string } | null)?.name || '—';
                    return (
                      <TableRow key={d.id} className="cursor-pointer" onClick={() => { setEditingId(d.id); setDialogOpen(true); }}>
                        <TableCell>{TYPE_LABEL[d.doc_type]}</TableCell>
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
                          <Button size="icon" variant="ghost" onClick={() => { setEditingId(d.id); setDialogOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {d.status === 'draft' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { if (confirm('Delete draft?')) del.mutate(d.id); }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
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
            setEditingId(newId);
            setDialogOpen(true);
          }}
        />
      )}
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
