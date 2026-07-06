import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INDIAN_STATES } from '@/lib/billing/states';
import { Party, useUpsertParty } from '@/hooks/useBilling';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  party?: Party | null;
  onSaved?: (party: Party) => void;
}

const empty = {
  name: '',
  gstin: '',
  phone: '',
  gst_type: 'unregistered',
  billing_street: '',
  billing_city: '',
  billing_state: '',
  billing_state_code: '',
  billing_pincode: '',
  billing_country: 'India',
  shipping_same: true,
  shipping_street: '',
  shipping_city: '',
  shipping_state: '',
  shipping_state_code: '',
  shipping_pincode: '',
  shipping_country: 'India',
  notes: '',
};

export function PartyDialog({ open, onOpenChange, party, onSaved }: Props) {
  const [form, setForm] = useState<typeof empty>(empty);
  const [fetching, setFetching] = useState(false);
  const upsert = useUpsertParty();

  useEffect(() => {
    if (open) {
      if (party) {
        // Coerce null/undefined DB fields to empty strings so inputs stay
        // controlled — otherwise switching parties leaves stale DOM values.
        const cleaned: Record<string, unknown> = {};
        for (const k of Object.keys(empty) as (keyof typeof empty)[]) {
          const v = (party as unknown as Record<string, unknown>)[k];
          if (k === 'shipping_same') {
            cleaned[k] = typeof v === 'boolean' ? v : true;
          } else {
            cleaned[k] = v == null ? '' : v;
          }
        }
        setForm({ ...empty, ...(cleaned as typeof empty) });
      } else {
        setForm(empty);
      }
    }
  }, [open, party]);

  const setField = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const gstinValid = form.gstin && form.gstin.length === 15;

  const fetchFromGst = async () => {
    if (!gstinValid) return;
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-gstin', {
        body: { gstin: form.gstin.toUpperCase() },
      });
      if (error) throw error;
      const r = data as { legal_name?: string; trade_name?: string; state?: string; address?: string; cached?: boolean };
      const stateMatch = INDIAN_STATES.find(
        (s) => r.state && s.name.toLowerCase() === r.state.toLowerCase()
      );
      setForm((f) => ({
        ...f,
        name: r.trade_name || r.legal_name || f.name,
        billing_street: r.address || f.billing_street,
        billing_state: stateMatch?.name || f.billing_state,
        billing_state_code: stateMatch?.code || f.billing_state_code,
        gst_type: 'registered',
      }));
      toast.success(r.cached ? 'Fetched (cached result)' : 'Fetched from GST portal');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'GST lookup failed');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Party name is required');
      return;
    }
    const payload: Partial<Party> & { name: string } = {
      ...form,
      ...(party?.id ? { id: party.id } : {}),
    } as Partial<Party> & { name: string };
    const saved = (await upsert.mutateAsync(payload)) as Party | undefined;
    onOpenChange(false);
    if (saved && onSaved) onSaved(saved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{party ? 'Edit Party' : 'Add Party'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Party Name *</Label>
            <Input value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>GSTIN</Label>
            <div className="flex gap-2">
              <Input
                value={form.gstin}
                maxLength={15}
                onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
                placeholder="15-character GSTIN"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!gstinValid || fetching}
                onClick={fetchFromGst}
                title="Fetch via GST"
              >
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>GST Type</Label>
            <Select value={form.gst_type} onValueChange={(v) => setField('gst_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unregistered">Unregistered / Consumer</SelectItem>
                <SelectItem value="registered">Registered Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-sm">Billing Address</h4>
          <Textarea
            rows={2}
            value={form.billing_street}
            onChange={(e) => setField('billing_street', e.target.value)}
            placeholder="Street / Area"
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="City" value={form.billing_city} onChange={(e) => setField('billing_city', e.target.value)} />
            <Select
              value={form.billing_state_code}
              onValueChange={(code) => {
                const s = INDIAN_STATES.find((x) => x.code === code);
                setForm((f) => ({ ...f, billing_state_code: code, billing_state: s?.name || '' }));
              }}
            >
              <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.code} · {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Pincode" value={form.billing_pincode} onChange={(e) => setField('billing_pincode', e.target.value)} />
            <Input placeholder="Country" value={form.billing_country} onChange={(e) => setField('billing_country', e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h4 className="font-medium text-sm">Shipping Address</h4>
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={form.shipping_same} onCheckedChange={(v) => setField('shipping_same', v)} />
            <span>Same as billing</span>
          </div>
        </div>

        {!form.shipping_same && (
          <div className="mt-2 space-y-2">
            <Textarea
              rows={2}
              value={form.shipping_street}
              onChange={(e) => setField('shipping_street', e.target.value)}
              placeholder="Street / Area"
            />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input placeholder="City" value={form.shipping_city} onChange={(e) => setField('shipping_city', e.target.value)} />
              <Select
                value={form.shipping_state_code}
                onValueChange={(code) => {
                  const s = INDIAN_STATES.find((x) => x.code === code);
                  setForm((f) => ({ ...f, shipping_state_code: code, shipping_state: s?.name || '' }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.code} · {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Pincode" value={form.shipping_pincode} onChange={(e) => setField('shipping_pincode', e.target.value)} />
              <Input placeholder="Country" value={form.shipping_country} onChange={(e) => setField('shipping_country', e.target.value)} />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
