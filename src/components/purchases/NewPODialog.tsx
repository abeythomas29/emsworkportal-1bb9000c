import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, UserPlus, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useParties, type Party } from '@/hooks/useBilling';
import { usePurchaseOrders, type POItem } from '@/hooks/usePurchaseOrders';
import { usePOTermTemplates } from '@/hooks/usePOTermTemplates';
import { PartyDialog } from '@/components/billing/PartyDialog';

interface Props { trigger?: React.ReactNode }

const emptyItem = (): POItem => ({
  item_name: '',
  hsn_sac: '',
  quantity: 1,
  unit: 'pcs',
  unit_price: 0,
  tax_percent: 18,
});

export function NewPODialog({ trigger }: Props) {
  const { data: parties = [] } = useParties();
  const { createPO, isCreating } = usePurchaseOrders();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([emptyItem()]);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);

  const reset = () => {
    setVendorId(null); setVendorName(''); setPoDate(new Date().toISOString().slice(0, 10));
    setExpected(''); setNotes(''); setItems([emptyItem()]);
  };

  const updateItem = (i: number, patch: Partial<POItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const totals = items.reduce(
    (acc, it) => {
      const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      const tax = gross * ((Number(it.tax_percent) || 0) / 100);
      acc.sub += gross;
      acc.tax += tax;
      return acc;
    },
    { sub: 0, tax: 0 },
  );
  const grand = totals.sub + totals.tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = vendorName.trim() || parties.find((p) => p.id === vendorId)?.name || '';
    if (!name) return;
    const cleanItems = items.filter((i) => i.item_name.trim() && Number(i.quantity) > 0);
    if (cleanItems.length === 0) return;
    await createPO({
      vendor_id: vendorId,
      vendor_name: name,
      vendor_gstin: parties.find((p) => p.id === vendorId)?.gstin ?? null,
      po_date: poDate,
      expected_delivery: expected || null,
      notes: notes.trim() || null,
      items: cleanItems,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> New PO</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
          <DialogDescription>Create a PO before making a purchase. It starts as draft.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vendor</Label>
                <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => setVendorDialogOpen(true)}>
                  <UserPlus className="w-3.5 h-3.5" /> Register vendor
                </Button>
              </div>
              <Select value={vendorId ?? 'new'} onValueChange={(v) => {
                if (v === 'new') { setVendorId(null); return; }
                setVendorId(v);
                const p = parties.find((x) => x.id === v);
                if (p) setVendorName(p.name);
              }}>
                <SelectTrigger><SelectValue placeholder="Select vendor or type new" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">— New vendor (type name) —</SelectItem>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.gstin ? ` · ${p.gstin}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!vendorId && (
                <Input placeholder="Vendor name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} required />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>PO Date</Label>
                <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyItem()])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="[&>th]:p-2 [&>th]:text-left [&>th]:font-medium [&>th]:text-xs [&>th]:text-muted-foreground">
                    <th className="min-w-[180px]">Item</th>
                    <th>HSN</th>
                    <th className="w-20">Qty</th>
                    <th className="w-20">Unit</th>
                    <th className="w-24">Price</th>
                    <th className="w-20">GST%</th>
                    <th className="w-24 text-right">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                    const tax = gross * ((Number(it.tax_percent) || 0) / 100);
                    return (
                      <tr key={i} className="[&>td]:p-1.5 border-t border-border">
                        <td><Input value={it.item_name} onChange={(e) => updateItem(i, { item_name: e.target.value })} placeholder="Item name" /></td>
                        <td><Input value={it.hsn_sac ?? ''} onChange={(e) => updateItem(i, { hsn_sac: e.target.value })} /></td>
                        <td><Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })} /></td>
                        <td><Input value={it.unit ?? ''} onChange={(e) => updateItem(i, { unit: e.target.value })} /></td>
                        <td><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })} /></td>
                        <td><Input type="number" step="0.01" value={it.tax_percent} onChange={(e) => updateItem(i, { tax_percent: parseFloat(e.target.value) || 0 })} /></td>
                        <td className="text-right tabular-nums font-medium">₹{(gross + tax).toFixed(2)}</td>
                        <td>
                          <Button type="button" size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, x) => x !== i))} disabled={items.length === 1}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="w-full md:w-64 border border-border rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">₹{totals.sub.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular-nums">₹{totals.tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span className="tabular-nums text-primary">₹{grand.toFixed(2)}</span></div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isCreating}>{isCreating ? 'Saving…' : 'Create PO'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <PartyDialog
        open={vendorDialogOpen}
        onOpenChange={setVendorDialogOpen}
        onSaved={(p: Party) => {
          setVendorId(p.id);
          setVendorName(p.name);
        }}
      />
    </Dialog>
  );
}
