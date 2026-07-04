import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, FileDown, Eye, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  BillingDocument,
  BillingDocumentItem,
  Party,
  useBillingDocument,
  useCompanySettings,
  useFinalizeDocument,
  useParties,
  useSaveBillingDocument,
} from '@/hooks/useBilling';
import { INDIAN_STATES } from '@/lib/billing/states';
import { computeLine, computeTotals, financialYearOf, buildHsnSummary } from '@/lib/billing/calc';
import { numberToIndianWords } from '@/lib/billing/numberToWords';
import { generateBillingPdf, prepareBrandingAssets, preloadCompanyImages } from '@/lib/billing/pdf';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { PartyDialog } from './PartyDialog';
import { NewProductDialog } from './NewProductDialog';

type DocType = 'tax_invoice' | 'proforma' | 'estimate';

const TITLE: Record<DocType, string> = {
  tax_invoice: 'Tax Invoice',
  proforma: 'Proforma Invoice',
  estimate: 'Estimate',
};

const DEFAULT_TERMS: Record<DocType, string> = {
  tax_invoice:
    '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged on delayed payments.\n3. Subject to Karnataka jurisdiction only.',
  proforma:
    'This is a Proforma Invoice, not a Tax Invoice. Prices and taxes are indicative and subject to confirmation.',
  estimate: 'This is only an estimate. Prices and availability are subject to change without notice.',
};

interface LineRow {
  key: string;
  product_id: string | null;
  item_name: string;
  description: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
}

const blankLine = (): LineRow => ({
  key: crypto.randomUUID(),
  product_id: null,
  item_name: '',
  description: '',
  hsn_sac: '',
  quantity: 1,
  unit: 'kg',
  unit_price: 0,
  discount_percent: 0,
  tax_percent: 18,
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  documentId?: string | null;
  initialType?: DocType;
  onConvert?: (fromId: string) => void;
}

function useProductsList() {
  return useQuery({
    queryKey: ['billing_products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, unit, current_stock').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []) as { id: string; name: string; unit: string; current_stock: number }[];
    },
  });
}

const EMS_HSN = '32061110';
const EMS_SERIES_PRICE: Record<string, number> = { '1': 400, '2': 750, '3': 600, '4': 860, '5': 650 };
const isEms = (name: string) => name.trim().toLowerCase().startsWith('ems');
const autoHsn = (name: string, current: string) => (isEms(name) ? EMS_HSN : current);
const emsSeriesDigit = (name: string): string | null => {
  if (!isEms(name)) return null;
  const rest = name.trim().slice(3).replace(/[^0-9]/g, '');
  return rest.length > 0 ? rest[0] : null;
};
const autoPrice = (name: string, current: number) => {
  const d = emsSeriesDigit(name);
  if (d && EMS_SERIES_PRICE[d] !== undefined && (!current || current === 0)) return EMS_SERIES_PRICE[d];
  return current;
};
const autoGst = (name: string, current: number) => (isEms(name) ? 18 : current);

const SHIPPING_LABEL = 'Shipping Charges';
const SHIPPING_HSN = '996812';
const SHIPPING_GST = 18;





export function BillingDocumentDialog({ open, onOpenChange, documentId, initialType = 'tax_invoice', onConvert }: Props) {
  const { data: existing } = useBillingDocument(documentId ?? null);
  const { data: parties = [] } = useParties();
  const { data: company } = useCompanySettings();
  const { data: products = [] } = useProductsList();
  const save = useSaveBillingDocument();
  const finalize = useFinalizeDocument();

  const [docType, setDocType] = useState<DocType>(initialType);
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [partyId, setPartyId] = useState<string>('');
  const [posState, setPosState] = useState<string>('');
  const [posCode, setPosCode] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('Credit');
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS[initialType]);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);
  const [status, setStatus] = useState<'draft' | 'finalized'>('draft');
  const [docNumber, setDocNumber] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(documentId ?? null);
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductForLine, setNewProductForLine] = useState<number | null>(null);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [shippingAmount, setShippingAmount] = useState<number>(0);

  // load existing
  useEffect(() => {
    if (existing?.doc) {

      const d = existing.doc;
      setDocType(d.doc_type);
      setDocDate(d.doc_date);
      setPartyId(d.party_id || '');
      setPosState(d.place_of_supply_state || '');
      setPosCode(d.place_of_supply_code || '');
      setPaymentMode(d.payment_mode || 'Credit');
      setTerms(d.terms || DEFAULT_TERMS[d.doc_type]);
      setNotes(d.notes || '');
      setStatus(d.status);
      setDocNumber(d.doc_number);
      setSavedId(d.id);
      const its: BillingDocumentItem[] = existing.items || [];
      setLines(
        its.length
          ? its.map((i) => ({
              key: i.id,
              product_id: i.product_id,
              item_name: i.item_name,
              description: i.description || '',
              hsn_sac: i.hsn_sac || '',
              quantity: Number(i.quantity),
              unit: i.unit || 'kg',
              unit_price: Number(i.unit_price),
              discount_percent: Number(i.discount_percent),
              tax_percent: Number(i.tax_percent),
            }))
          : [blankLine()]
      );
    }
  }, [existing]);

  // reset when opening fresh
  useEffect(() => {
    if (open && !documentId) {
      setDocType(initialType);
      setDocDate(new Date().toISOString().slice(0, 10));
      setPartyId('');
      setPosState('');
      setPosCode('');
      setPaymentMode('Credit');
      setTerms(DEFAULT_TERMS[initialType]);
      setNotes('');
      setLines([blankLine()]);
      setStatus('draft');
      setDocNumber(null);
      setSavedId(null);
    }
  }, [open, documentId, initialType]);

  const selectedParty: Party | undefined = useMemo(
    () => parties.find((p) => p.id === partyId),
    [parties, partyId]
  );

  // default POS from party state
  useEffect(() => {
    if (selectedParty && !posCode) {
      setPosState(selectedParty.billing_state || '');
      setPosCode(selectedParty.billing_state_code || '');
    }
  }, [selectedParty, posCode]);

  const companyStateCode = company?.state_code || '29';
  const sameState = !!posCode && posCode === companyStateCode;

  const computed = useMemo(
    () =>
      lines.map((l) =>
        computeLine(
          {
            item_name: l.item_name,
            hsn_sac: l.hsn_sac,
            quantity: l.quantity,
            unit: l.unit,
            unit_price: l.unit_price,
            discount_percent: l.discount_percent,
            tax_percent: l.tax_percent,
            product_id: l.product_id,
            description: l.description,
          },
          sameState
        )
      ),
    [lines, sameState]
  );

  const totals = useMemo(() => computeTotals(computed), [computed]);
  const hsnRows = useMemo(() => buildHsnSummary(computed, sameState), [computed, sameState]);
  const [unlocked, setUnlocked] = useState(false);
  const readOnly = status === 'finalized' && !unlocked;

  const setLine = (idx: number, patch: Partial<LineRow>) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const buildPartySnapshot = () => (selectedParty ? { ...selectedParty } : null);

  const buildHeader = (): Partial<BillingDocument> & { doc_type: DocType; doc_date: string } => ({
    doc_type: docType,
    doc_date: docDate,
    party_id: partyId || null,
    party_snapshot: buildPartySnapshot() as unknown as Record<string, unknown>,
    place_of_supply_state: posState,
    place_of_supply_code: posCode,
    payment_mode: docType === 'tax_invoice' ? paymentMode : null,
    terms,
    notes,
    sub_total: totals.total_taxable,
    total_discount: totals.total_discount,
    total_tax: totals.total_tax,
    round_off: totals.round_off,
    total: totals.total,
    total_in_words: numberToIndianWords(totals.total),
    tax_summary: hsnRows as unknown as never,
    financial_year: financialYearOf(docDate),
  });

  const validate = (): string | null => {
    if (!partyId) return 'Select a party';
    if (!posCode) return 'Select Place of Supply';
    if (!lines.length || lines.every((l) => !l.item_name.trim())) return 'Add at least one line item';
    for (const l of lines) {
      if (l.item_name.trim() && (!l.quantity || l.quantity <= 0)) return `Quantity required for ${l.item_name}`;
    }
    return null;
  };

  const doSave = async (finalizeAfter = false) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const items = computed
      .filter((l) => l.item_name.trim())
      .map((l, i) => ({
        position: i,
        product_id: l.product_id || null,
        item_name: l.item_name,
        description: l.description || null,
        hsn_sac: l.hsn_sac || null,
        quantity: l.quantity,
        unit: l.unit || null,
        unit_price: l.unit_price,
        discount_percent: l.discount_percent,
        discount_amount: l.discount_amount,
        tax_percent: l.tax_percent,
        taxable_value: l.taxable_value,
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        tax_amount: l.tax_amount,
        amount: l.amount,
      }));

    const id = await save.mutateAsync({
      id: savedId ?? undefined,
      header: buildHeader(),
      items,
    });
    setSavedId(id);
    toast.success('Draft saved');
    if (finalizeAfter) {
      const res = await finalize.mutateAsync({ id, doc_type: docType });
      setStatus('finalized');
      setDocNumber(res.doc_number);
    }
  };

  const buildPdfInput = () => ({
    doc_type: docType,
    doc_number: docNumber || 'DRAFT',
    doc_date: docDate,
    place_of_supply_state: posState,
    place_of_supply_code: posCode,
    payment_mode: paymentMode,
    terms,
    company: company!,
    party: (buildPartySnapshot() as never) || { name: 'Unknown' },
    lines: computed.filter((l) => l.item_name.trim()),
    sameState,
  });

  const downloadPdf = async () => {
    if (!company) return;
    await Promise.all([prepareBrandingAssets(), preloadCompanyImages(company)]);
    const pdf = generateBillingPdf(buildPdfInput());
    pdf.save(`${docNumber || 'DRAFT'}.pdf`);
  };

  const previewPdf = async () => {
    if (!company) return;
    await Promise.all([prepareBrandingAssets(), preloadCompanyImages(company)]);
    const pdf = generateBillingPdf(buildPdfInput());
    window.open(pdf.output('bloburl'), '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[calc(100vw-1rem)] sm:w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 sm:gap-3 text-base sm:text-lg pr-6">
            {TITLE[docType]}
            {status === 'finalized' ? (
              <Badge className="bg-success text-success-foreground">Finalized · {docNumber}</Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
            {status === 'finalized' && (
              <Button
                type="button"
                size="sm"
                variant={unlocked ? 'secondary' : 'outline'}
                onClick={() => setUnlocked((u) => !u)}
              >
                {unlocked ? 'Lock' : 'Edit'}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>


        {/* Header row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={(v) => { setDocType(v as DocType); setTerms(DEFAULT_TERMS[v as DocType]); }} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tax_invoice">Tax Invoice</SelectItem>
                <SelectItem value="proforma">Proforma Invoice</SelectItem>
                <SelectItem value="estimate">Estimate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Party *</Label>
            <div className="flex gap-2">
              <Select value={partyId} onValueChange={(v) => { setPartyId(v); setPosCode(''); }} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!readOnly && (
                <Button type="button" variant="outline" onClick={() => setPartyDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Place of Supply *</Label>
            <Select
              value={posCode}
              onValueChange={(code) => {
                const s = INDIAN_STATES.find((x) => x.code === code);
                setPosCode(code);
                setPosState(s?.name || '');
              }}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Place of supply" /></SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.code} · {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {sameState ? 'Same-state → CGST + SGST split' : 'Inter-state → IGST'}
            </p>
          </div>
          {docType === 'tax_invoice' && (
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Line items — desktop table */}
        <Card className="mt-4 hidden md:block">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead className="min-w-[220px]">Item</TableHead>
                  <TableHead className="w-[110px]">HSN/SAC</TableHead>
                  <TableHead className="w-[110px]">Qty</TableHead>
                  <TableHead className="w-[90px]">Unit</TableHead>

                  <TableHead className="w-[110px]">Price</TableHead>
                  <TableHead className="w-[100px]">GST %</TableHead>
                  <TableHead className="w-[110px] text-right">Amount</TableHead>
                  {!readOnly && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, idx) => {
                  const c = computed[idx];
                  const matched = products.find((p) => p.name.toLowerCase() === l.item_name.trim().toLowerCase());
                  const stock = matched ? Number(matched.current_stock || 0) : null;
                  return (
                    <TableRow key={l.key}>
                      <TableCell className="text-muted-foreground align-top pt-4">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <Input
                              value={l.item_name}
                              list={`products-list-${l.key}`}
                              onChange={(e) => {
                                const name = e.target.value;
                                const p = products.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
                                setLine(idx, {
                                  item_name: name,
                                  product_id: p ? p.id : null,
                                  unit: p ? p.unit : l.unit,
                                  hsn_sac: autoHsn(name, l.hsn_sac),
                                  unit_price: autoPrice(name, l.unit_price),
                                  tax_percent: autoGst(name, l.tax_percent),
                                });
                              }}
                              placeholder="Type product code…"
                              disabled={readOnly}
                            />
                            <datalist id={`products-list-${l.key}`}>
                              {products.map((p) => (
                                <option key={p.id} value={p.name}>
                                  {`Stock: ${Number(p.current_stock || 0).toFixed(2)} ${p.unit || 'kg'}`}
                                </option>
                              ))}
                            </datalist>
                            <Select
                              value={l.product_id || ''}
                              onValueChange={(pid) => {
                                const p = products.find((x) => x.id === pid);
                                if (p) setLine(idx, {
                                  product_id: pid,
                                  item_name: p.name,
                                  unit: p.unit,
                                  hsn_sac: autoHsn(p.name, l.hsn_sac),
                                  unit_price: autoPrice(p.name, l.unit_price),
                                  tax_percent: autoGst(p.name, l.tax_percent),
                                });
                              }}

                              disabled={readOnly}
                            >
                              <SelectTrigger className="w-[42px] p-0 justify-center" aria-label="Pick product" />
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} · {Number(p.current_stock || 0).toFixed(2)} {p.unit || 'kg'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {!readOnly && l.item_name.trim() && !matched && (
                            <button
                              type="button"
                              onClick={() => { setNewProductForLine(idx); setNewProductOpen(true); }}
                              className="text-xs text-primary hover:underline self-start"
                            >
                              + Add "{l.item_name.trim()}" as new product
                            </button>
                          )}
                          {stock !== null && (
                            <div className="flex items-center gap-2 text-xs">
                              <Badge
                                variant="outline"
                                className={stock <= 0 ? 'text-destructive border-destructive' : stock < l.quantity ? 'text-warning border-warning' : 'text-success border-success'}
                              >
                                In stock: {stock.toFixed(2)} {matched?.unit || 'kg'}
                              </Badge>
                              {stock < l.quantity && stock > 0 && <span className="text-warning">Insufficient stock</span>}
                              {stock <= 0 && <span className="text-destructive">Out of stock</span>}
                            </div>
                          )}
                          <Input
                            value={l.description}
                            onChange={(e) => setLine(idx, { description: e.target.value })}
                            placeholder="Description (optional)"
                            className="text-xs h-8"
                            disabled={readOnly}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input value={l.hsn_sac} onChange={(e) => setLine(idx, { hsn_sac: e.target.value })} disabled={readOnly} />
                      </TableCell>

                      <TableCell>
                        <Input type="number" step="0.001" inputMode="decimal" value={l.quantity}
                          onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} disabled={readOnly} />
                      </TableCell>
                      <TableCell>
                        <Input value={l.unit} onChange={(e) => setLine(idx, { unit: e.target.value })} disabled={readOnly} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" inputMode="decimal" value={l.unit_price}
                          onChange={(e) => setLine(idx, { unit_price: Number(e.target.value) })} disabled={readOnly} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" inputMode="decimal" value={l.tax_percent}
                          onChange={(e) => setLine(idx, { tax_percent: Number(e.target.value) })} disabled={readOnly} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Line items — mobile stacked cards */}
        <div className="mt-4 space-y-3 md:hidden">
          {lines.map((l, idx) => {
            const c = computed[idx];
            const matched = products.find((p) => p.name.toLowerCase() === l.item_name.trim().toLowerCase());
            const stock = matched ? Number(matched.current_stock || 0) : null;
            return (
              <Card key={l.key} className="border-border/60">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Item #{idx + 1}</span>
                    {!readOnly && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Item</Label>
                    <div className="flex gap-1">
                      <Input
                        value={l.item_name}
                        list={`products-list-m-${l.key}`}
                        onChange={(e) => {
                          const name = e.target.value;
                          const p = products.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
                          setLine(idx, {
                            item_name: name,
                            product_id: p ? p.id : null,
                            unit: p ? p.unit : l.unit,
                            hsn_sac: autoHsn(name, l.hsn_sac),
                            unit_price: autoPrice(name, l.unit_price),
                            tax_percent: autoGst(name, l.tax_percent),
                          });
                        }}
                        placeholder="Type product code…"
                        disabled={readOnly}
                      />
                      <datalist id={`products-list-m-${l.key}`}>
                        {products.map((p) => (
                          <option key={p.id} value={p.name}>
                            {`Stock: ${Number(p.current_stock || 0).toFixed(2)} ${p.unit || 'kg'}`}
                          </option>
                        ))}
                      </datalist>
                      <Select
                        value={l.product_id || ''}
                        onValueChange={(pid) => {
                          const p = products.find((x) => x.id === pid);
                          if (p) setLine(idx, {
                            product_id: pid,
                            item_name: p.name,
                            unit: p.unit,
                            hsn_sac: autoHsn(p.name, l.hsn_sac),
                            unit_price: autoPrice(p.name, l.unit_price),
                            tax_percent: autoGst(p.name, l.tax_percent),
                          });
                        }}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="w-[44px] p-0 justify-center" aria-label="Pick product" />
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} · {Number(p.current_stock || 0).toFixed(2)} {p.unit || 'kg'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!readOnly && l.item_name.trim() && !matched && (
                      <button
                        type="button"
                        onClick={() => { setNewProductForLine(idx); setNewProductOpen(true); }}
                        className="text-xs text-primary hover:underline"
                      >
                        + Add "{l.item_name.trim()}" as new product
                      </button>
                    )}
                    {stock !== null && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          variant="outline"
                          className={stock <= 0 ? 'text-destructive border-destructive' : stock < l.quantity ? 'text-warning border-warning' : 'text-success border-success'}
                        >
                          Stock: {stock.toFixed(2)} {matched?.unit || 'kg'}
                        </Badge>
                        {stock < l.quantity && stock > 0 && <span className="text-warning">Insufficient</span>}
                        {stock <= 0 && <span className="text-destructive">Out of stock</span>}
                      </div>
                    )}
                    <Input
                      value={l.description}
                      onChange={(e) => setLine(idx, { description: e.target.value })}
                      placeholder="Description (optional)"
                      className="text-xs h-9"
                      disabled={readOnly}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">HSN/SAC</Label>
                      <Input value={l.hsn_sac} onChange={(e) => setLine(idx, { hsn_sac: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input value={l.unit} onChange={(e) => setLine(idx, { unit: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" step="0.001" inputMode="decimal" value={l.quantity}
                        onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} disabled={readOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Price</Label>
                      <Input type="number" step="0.01" inputMode="decimal" value={l.unit_price}
                        onChange={(e) => setLine(idx, { unit_price: Number(e.target.value) })} disabled={readOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">GST %</Label>
                      <Input type="number" step="0.01" inputMode="decimal" value={l.tax_percent}
                        onChange={(e) => setLine(idx, { tax_percent: Number(e.target.value) })} disabled={readOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <div className="h-10 px-3 flex items-center justify-end rounded-md border border-border bg-muted/40 font-semibold tabular-nums">
                        {c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>


        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])} className="mt-2">
            <Plus className="w-4 h-4 mr-1" /> Add Line
          </Button>
        )}

        {/* HSN summary + totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="md:col-span-2 order-2 md:order-1">

            <CardContent className="p-3 overflow-x-auto">
              <div className="text-sm font-medium mb-2">HSN / Tax Summary</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>HSN/SAC</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    {sameState ? (
                      <>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                      </>
                    ) : (
                      <TableHead className="text-right">IGST</TableHead>
                    )}
                    <TableHead className="text-right">Total Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hsnRows.map((r) => (
                    <TableRow key={r.hsn}>
                      <TableCell>{r.hsn}</TableCell>
                      <TableCell className="text-right">{r.taxable.toFixed(2)}</TableCell>
                      {sameState ? (
                        <>
                          <TableCell className="text-right">{r.cgst.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{r.sgst.toFixed(2)}</TableCell>
                        </>
                      ) : (
                        <TableCell className="text-right">{r.igst.toFixed(2)}</TableCell>
                      )}
                      <TableCell className="text-right">{r.total_tax.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{totals.total_taxable.toFixed(2)}</TableCell>
                    {sameState ? (
                      <>
                        <TableCell className="text-right">{totals.total_cgst.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{totals.total_sgst.toFixed(2)}</TableCell>
                      </>
                    ) : (
                      <TableCell className="text-right">{totals.total_igst.toFixed(2)}</TableCell>
                    )}
                    <TableCell className="text-right">{totals.total_tax.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="order-1 md:order-2">
            <CardContent className="p-4 space-y-2 text-sm">
              <Row label="Sub Total" value={totals.total_taxable} />
              {sameState ? (
                <>
                  <Row label="CGST" value={totals.total_cgst} />
                  <Row label="SGST" value={totals.total_sgst} />
                </>
              ) : (
                <Row label="IGST" value={totals.total_igst} />
              )}
              <Row label="Round Off" value={totals.round_off} signed />
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Total</span>
                <span>₹ {totals.total.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-muted-foreground italic pt-1">{numberToIndianWords(totals.total)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Terms & notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Terms & Conditions</Label>
            <Textarea rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} />
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 sm:py-4 mt-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex flex-col-reverse sm:flex-row sm:flex-wrap gap-2 sm:justify-end z-10">
          {status !== 'finalized' ? (
            <>
              <Button variant="outline" onClick={() => doSave(false)} disabled={save.isPending || finalize.isPending} className="w-full sm:w-auto min-h-11">
                {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Draft
              </Button>
              <Button onClick={() => doSave(true)} disabled={save.isPending || finalize.isPending} className="w-full sm:w-auto min-h-11">
                {finalize.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Finalize
              </Button>
            </>
          ) : (
            <>
              {unlocked && (
                <Button onClick={async () => { await doSave(false); setUnlocked(false); }} disabled={save.isPending} className="w-full sm:w-auto min-h-11">
                  {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              )}
              <Button variant="outline" onClick={previewPdf} className="w-full sm:w-auto min-h-11"><Eye className="w-4 h-4 mr-2" /> Preview PDF</Button>
              <Button onClick={downloadPdf} className="w-full sm:w-auto min-h-11"><FileDown className="w-4 h-4 mr-2" /> Download PDF</Button>
              {(docType === 'proforma' || docType === 'estimate') && savedId && onConvert && (
                <Button variant="secondary" onClick={() => onConvert(savedId)} className="w-full sm:w-auto min-h-11">
                  <Copy className="w-4 h-4 mr-2" /> Convert to Tax Invoice
                </Button>
              )}
            </>
          )}

        </div>


        <PartyDialog
          open={partyDialogOpen}
          onOpenChange={setPartyDialogOpen}
          onSaved={(p) => { setPartyId(p.id); setPosState(p.billing_state || ''); setPosCode(p.billing_state_code || ''); }}
        />

        <NewProductDialog
          open={newProductOpen}
          onOpenChange={(o) => { setNewProductOpen(o); if (!o) setNewProductForLine(null); }}
          defaultName={newProductForLine !== null ? (lines[newProductForLine]?.item_name || '') : ''}
          onCreated={(p) => {
            if (newProductForLine === null) return;
            setLine(newProductForLine, {
              product_id: p.id,
              item_name: p.name,
              unit: p.unit,
              hsn_sac: p.hsn_sac || autoHsn(p.name, ''),
              unit_price: p.unit_price || autoPrice(p.name, 0),
              tax_percent: p.tax_percent || autoGst(p.name, 18),
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{signed && value > 0 ? '+' : ''}{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  );
}
