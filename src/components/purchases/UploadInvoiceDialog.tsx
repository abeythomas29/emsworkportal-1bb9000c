import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, Sparkles, FileText, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useParties } from '@/hooks/useBilling';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { usePurchaseInvoices, type PurchaseInvoiceItem } from '@/hooks/usePurchaseInvoices';

const client = supabase as any;

interface Props { trigger?: React.ReactNode }

const MAX_SIZE = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(',')[1] || '');
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function UploadInvoiceDialog({ trigger }: Props) {
  const { data: parties = [] } = useParties();
  const { orders } = usePurchaseOrders();
  const { createInvoice, isCreating } = usePurchaseInvoices();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'extracted' | 'manual' | 'failed'>('idle');
  const [extractionRaw, setExtractionRaw] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [gstin, setGstin] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [poId, setPoId] = useState<string>('none');
  const [subTotal, setSubTotal] = useState('0');
  const [totalTax, setTotalTax] = useState('0');
  const [total, setTotal] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);

  const reset = () => {
    setFile(null); setExtracting(false); setStatus('idle'); setExtractionRaw(null);
    setVendorId(null); setVendorName(''); setGstin(''); setInvoiceNo('');
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setPoId('none'); setSubTotal('0'); setTotalTax('0'); setTotal('0');
    setAmountPaid('0'); setNotes(''); setItems([]);
  };

  const handleFile = async (f: File) => {
    if (f.size > MAX_SIZE) { toast.error('Max file size is 10 MB'); return; }
    const okType = f.type === 'application/pdf' || f.type.startsWith('image/');
    if (!okType) { toast.error('Only PDF or image files'); return; }
    setFile(f);
    setExtracting(true);
    try {
      const b64 = await fileToBase64(f);
      const { data, error } = await client.functions.invoke('extract-purchase-invoice', {
        body: { fileBase64: b64, mimeType: f.type },
      });
      if (error) throw error;
      setExtractionRaw(data);
      setVendorName(data.vendor_name || '');
      setGstin(data.vendor_gstin || '');
      setInvoiceNo(data.invoice_no || '');
      if (data.invoice_date) setInvoiceDate(data.invoice_date);
      setSubTotal(String(data.sub_total || 0));
      setTotalTax(String(data.total_tax || 0));
      setTotal(String(data.total || 0));
      setItems((data.items || []).map((i: any) => ({
        item_name: i.item_name || '',
        hsn_sac: i.hsn_sac || '',
        quantity: Number(i.quantity) || 0,
        unit: i.unit || '',
        unit_price: Number(i.unit_price) || 0,
        tax_percent: Number(i.tax_percent) || 0,
        amount: Number(i.amount) || 0,
      })));
      // try matching vendor by name/GSTIN
      const match = parties.find(
        (p) => (data.vendor_gstin && p.gstin === data.vendor_gstin) ||
               (data.vendor_name && p.name.toLowerCase() === String(data.vendor_name).toLowerCase()),
      );
      if (match) setVendorId(match.id);
      setStatus('extracted');
      toast.success('Invoice data extracted — please review');
    } catch (e: any) {
      console.error(e);
      toast.error('Extraction failed — enter details manually');
      setStatus('failed');
    } finally {
      setExtracting(false);
    }
  };

  const startManual = () => { setStatus('manual'); if (items.length === 0) setItems([{ item_name: '', quantity: 1, unit_price: 0, tax_percent: 18, amount: 0 }]); };

  const updateItem = (i: number, patch: Partial<PurchaseInvoiceItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = vendorName.trim() || parties.find((p) => p.id === vendorId)?.name || '';
    if (!name) { toast.error('Vendor name required'); return; }
    const totalN = parseFloat(total) || 0;
    if (totalN <= 0) { toast.error('Total must be greater than 0'); return; }

    let attachmentPath: string | null = null;
    if (file) {
      const path = `${new Date().getFullYear()}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await client.storage.from('purchase-invoices').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) { toast.error('File upload failed: ' + upErr.message); return; }
      attachmentPath = path;
    }

    await createInvoice({
      vendor_id: vendorId,
      vendor_name: name,
      vendor_gstin: gstin.trim() || null,
      invoice_no: invoiceNo.trim() || null,
      invoice_date: invoiceDate,
      po_id: poId === 'none' ? null : poId,
      sub_total: parseFloat(subTotal) || 0,
      total_tax: parseFloat(totalTax) || 0,
      total: totalN,
      amount_paid: parseFloat(amountPaid) || 0,
      notes: notes.trim() || null,
      attachment_path: attachmentPath,
      attachment_mime: file?.type || null,
      extraction_status: status === 'extracted' ? 'extracted' : status === 'failed' ? 'failed' : 'manual',
      extraction_raw: extractionRaw,
      items: items.filter((i) => i.item_name.trim()),
    });
    reset();
    setOpen(false);
  };

  const relevantPOs = orders.filter((o) =>
    ['approved', 'sent', 'partially_received', 'received'].includes(o.status) &&
    (!vendorId || o.vendor_id === vendorId),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" className="gap-2"><Upload className="w-4 h-4" /> Upload Invoice</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> New Purchase Invoice
          </DialogTitle>
          <DialogDescription>Upload a vendor's tax invoice (PDF or image) — AI extracts the details.</DialogDescription>
        </DialogHeader>

        {status === 'idle' && (
          <div
            className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {extracting ? (
              <div className="space-y-2">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                <p className="text-sm font-medium">Reading invoice…</p>
                <p className="text-xs text-muted-foreground">This usually takes 5–15 seconds</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop invoice here or click to upload</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG · up to 10 MB</p>
                <div className="pt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); startManual(); }}>
                    or enter manually
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {(status === 'extracted' || status === 'manual' || status === 'failed') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {file && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border text-sm">
                <FileText className="w-4 h-4 text-primary" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                {status === 'extracted' && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">AI extracted</span>}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select value={vendorId ?? 'new'} onValueChange={(v) => {
                  if (v === 'new') { setVendorId(null); return; }
                  setVendorId(v);
                  const p = parties.find((x) => x.id === v);
                  if (p) { setVendorName(p.name); if (p.gstin) setGstin(p.gstin); }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">— New vendor —</SelectItem>
                    {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="15-char" />
                </div>
                <div className="space-y-2">
                  <Label>Link PO (optional)</Label>
                  <Select value={poId} onValueChange={setPoId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {relevantPOs.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} · {p.vendor_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Invoice #</Label>
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Subtotal</Label>
                <Input type="number" step="0.01" value={subTotal} onChange={(e) => setSubTotal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tax</Label>
                <Input type="number" step="0.01" value={totalTax} onChange={(e) => setTotalTax(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-primary">Total *</Label>
                <Input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} required className="border-primary/50" />
              </div>
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              </div>
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line items</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setItems((p) => [...p, { item_name: '', quantity: 1, unit_price: 0, tax_percent: 18, amount: 0 }])}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 [&_th]:p-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
                      <tr>
                        <th>Item</th><th>HSN</th><th className="w-20">Qty</th>
                        <th className="w-24">Price</th><th className="w-20">GST%</th>
                        <th className="w-24 text-right">Amount</th><th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className="[&>td]:p-1.5 border-t border-border">
                          <td><Input value={it.item_name} onChange={(e) => updateItem(i, { item_name: e.target.value })} /></td>
                          <td><Input value={it.hsn_sac ?? ''} onChange={(e) => updateItem(i, { hsn_sac: e.target.value })} /></td>
                          <td><Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })} /></td>
                          <td><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })} /></td>
                          <td><Input type="number" step="0.01" value={it.tax_percent} onChange={(e) => updateItem(i, { tax_percent: parseFloat(e.target.value) || 0 })} /></td>
                          <td><Input type="number" step="0.01" value={it.amount} onChange={(e) => updateItem(i, { amount: parseFloat(e.target.value) || 0 })} className="text-right" /></td>
                          <td>
                            <Button type="button" size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, x) => x !== i))}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating}>{isCreating ? 'Saving…' : 'Save Invoice'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
