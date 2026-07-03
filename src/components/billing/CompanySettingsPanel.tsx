import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CompanySettings,
  useCompanySettings,
  useNumberSeries,
  useUpdateCompanySettings,
  useUpdateSeries,
} from '@/hooks/useBilling';
import { INDIAN_STATES } from '@/lib/billing/states';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const DOC_TYPE_LABEL: Record<string, string> = {
  tax_invoice: 'Tax Invoice',
  proforma: 'Proforma',
  estimate: 'Estimate',
};

export function CompanySettingsPanel() {
  const { data: company, isLoading } = useCompanySettings();
  const { data: series = [] } = useNumberSeries();
  const update = useUpdateCompanySettings();
  const updateSeries = useUpdateSeries();
  const [form, setForm] = useState<CompanySettings | null>(null);

  useEffect(() => {
    if (company) setForm(company);
  }, [company]);

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Company Details</CardTitle>
          <Button onClick={() => update.mutate(form)} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Company Name</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Input value={form.address_line || ''} onChange={(e) => set('address_line', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select
              value={form.state_code || ''}
              onValueChange={(code) => {
                const s = INDIAN_STATES.find((x) => x.code === code);
                setForm((f) => (f ? { ...f, state_code: code, state: s?.name || '' } : f));
              }}
            >
              <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.code} · {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pincode</Label>
            <Input value={form.pincode || ''} onChange={(e) => set('pincode', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>GSTIN</Label>
            <Input value={form.gstin || ''} onChange={(e) => set('gstin', e.target.value.toUpperCase())} maxLength={15} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
          </div>

          <div className="md:col-span-2 border-t pt-4">
            <h4 className="font-medium mb-3">Branding</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BrandImageField
                label="Company Logo"
                value={form.logo_url}
                onChange={(v) => set('logo_url', v)}
                hint="Shown at the top of every invoice, proforma, and estimate."
              />
              <BrandImageField
                label="Authorized Signature"
                value={form.signature_url}
                onChange={(v) => set('signature_url', v)}
                hint="Placed above 'Authorized Signatory' on every document."
              />
            </div>
          </div>

          <div className="md:col-span-2 border-t pt-4">
            <h4 className="font-medium mb-3">Bank Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={form.bank_name || ''} onChange={(e) => set('bank_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account No</Label>
                <Input value={form.bank_account || ''} onChange={(e) => set('bank_account', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>IFSC</Label>
                <Input value={form.bank_ifsc || ''} onChange={(e) => set('bank_ifsc', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>MICR</Label>
                <Input value={form.bank_micr || ''} onChange={(e) => set('bank_micr', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Branch Code</Label>
                <Input value={form.bank_branch_code || ''} onChange={(e) => set('bank_branch_code', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>SWIFT</Label>
                <Input value={form.bank_swift || ''} onChange={(e) => set('bank_swift', e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Numbering Series</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Financial Year</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Next Number</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((s) => (
                <SeriesRow key={s.id} row={s} onUpdate={(v) => updateSeries.mutate(v)} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SeriesRow({
  row,
  onUpdate,
}: {
  row: { id: string; doc_type: string; financial_year: string; prefix: string; next_number: number };
  onUpdate: (v: { id: string; prefix?: string; next_number?: number }) => void;
}) {
  const [prefix, setPrefix] = useState(row.prefix);
  const [next, setNext] = useState(row.next_number);
  const dirty = prefix !== row.prefix || next !== row.next_number;
  return (
    <TableRow>
      <TableCell>{DOC_TYPE_LABEL[row.doc_type] || row.doc_type}</TableCell>
      <TableCell className="font-mono">{row.financial_year}</TableCell>
      <TableCell><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-32" /></TableCell>
      <TableCell><Input type="number" value={next} onChange={(e) => setNext(Number(e.target.value))} className="w-24" /></TableCell>
      <TableCell>
        {dirty && (
          <Button size="sm" onClick={() => onUpdate({ id: row.id, prefix, next_number: next })}>Save</Button>
        )}
      </TableCell>
    </TableRow>
  );
}
