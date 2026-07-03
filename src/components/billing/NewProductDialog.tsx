import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export interface NewProductValues {
  id: string;
  name: string;
  unit: string;
  hsn_sac: string;
  unit_price: number;
  tax_percent: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultName?: string;
  onCreated: (v: NewProductValues) => void;
}

export function NewProductDialog({ open, onOpenChange, defaultName = '', onCreated }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [unit, setUnit] = useState('kg');
  const [hsn, setHsn] = useState('');
  const [price, setPrice] = useState('0');
  const [tax, setTax] = useState('18');
  const [stock, setStock] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setUnit('kg');
      setHsn('');
      setPrice('0');
      setTax('18');
      setStock('0');
    }
  }, [open, defaultName]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Product name is required'); return; }
    if (!unit.trim()) { toast.error('Unit is required'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({ name: trimmed, unit: unit.trim(), current_stock: parseFloat(stock) || 0 })
        .select('id, name, unit')
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['billing_products'] });
      toast.success('Product added');
      onCreated({
        id: data.id,
        name: data.name,
        unit: data.unit,
        hsn_sac: hsn.trim(),
        unit_price: parseFloat(price) || 0,
        tax_percent: parseFloat(tax) || 0,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Save this item to the product catalog so you can reuse it on future invoices.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, pcs…" required />
            </div>
            <div className="space-y-2">
              <Label>HSN / SAC</Label>
              <Input value={hsn} onChange={(e) => setHsn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit Price</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>GST %</Label>
              <Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Opening Stock</Label>
              <Input type="number" step="0.01" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Save Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
