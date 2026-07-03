import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import {
  useProducts,
  useRawMaterials,
  useCreateProductionLog,
  useUpdateProductionLog,
  type ProductionLog,
} from '@/hooks/useProduction';
import { format } from 'date-fns';

interface MaterialRow {
  raw_material_id: string;
  quantity_consumed: string;
}

interface ProductRow {
  product_id: string;
  quantity_consumed: string;
}

interface Props {
  trigger?: React.ReactNode;
  editLog?: ProductionLog | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LogProductionDialog({ trigger, editLog, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const isEdit = !!editLog;
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([{ raw_material_id: '', quantity_consumed: '' }]);
  const [productsUsed, setProductsUsed] = useState<ProductRow[]>([]);

  const { data: products = [] } = useProducts();
  const { data: rawMaterials = [] } = useRawMaterials();
  const createLog = useCreateProductionLog();
  const updateLog = useUpdateProductionLog();

  useEffect(() => {
    if (open && editLog) {
      setDate(editLog.date);
      setProductId(editLog.product_id);
      setQuantity(String(editLog.quantity_produced));
      setNotes(editLog.notes || '');
      const mats = (editLog.materials || []).map((m) => ({
        raw_material_id: m.raw_material_id,
        quantity_consumed: String(m.quantity_consumed),
      }));
      setMaterials(mats.length > 0 ? mats : [{ raw_material_id: '', quantity_consumed: '' }]);
      const pcs = (editLog.products_consumed || []).map((p) => ({
        product_id: p.product_id,
        quantity_consumed: String(p.quantity_consumed),
      }));
      setProductsUsed(pcs);
    } else if (open && !editLog) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editLog]);

  const reset = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setProductId('');
    setQuantity('');
    setNotes('');
    setMaterials([{ raw_material_id: '', quantity_consumed: '' }]);
    setProductsUsed([]);
  };

  const handleSubmit = async () => {
    if (!productId || !quantity) return;
    const payload = {
      date,
      product_id: productId,
      quantity_produced: parseFloat(quantity),
      notes,
      materials: materials.map((m) => ({
        raw_material_id: m.raw_material_id,
        quantity_consumed: parseFloat(m.quantity_consumed) || 0,
      })),
      products_consumed: productsUsed.map((p) => ({
        product_id: p.product_id,
        quantity_consumed: parseFloat(p.quantity_consumed) || 0,
      })),
    };
    if (isEdit && editLog) {
      await updateLog.mutateAsync({ id: editLog.id, ...payload });
    } else {
      await createLog.mutateAsync(payload);
    }
    reset();
    setOpen(false);
  };

  const isPending = createLog.isPending || updateLog.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined || !isEdit ? (
        <DialogTrigger asChild>{trigger || <Button><Plus className="mr-2 h-4 w-4" />Log Production</Button>}</DialogTrigger>
      ) : null}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Production Log' : 'Log Production Output'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.filter((p) => p.is_active || p.id === productId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Quantity Produced (kg)</Label>
            <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.00" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Raw Materials Consumed</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMaterials([...materials, { raw_material_id: '', quantity_consumed: '' }])}
              >
                <Plus className="mr-1 h-3 w-3" />Add
              </Button>
            </div>
            {materials.map((m, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_120px_40px] gap-2 items-end">
                <Select
                  value={m.raw_material_id}
                  onValueChange={(v) => {
                    const next = [...materials];
                    next[idx].raw_material_id = v;
                    setMaterials(next);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                  <SelectContent>
                    {rawMaterials.filter((r) => r.is_active || r.id === m.raw_material_id).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name} ({r.unit}) — stock: {r.current_stock}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Qty"
                  value={m.quantity_consumed}
                  onChange={(e) => {
                    const next = [...materials];
                    next[idx].quantity_consumed = e.target.value;
                    setMaterials(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMaterials(materials.filter((_, i) => i !== idx))}
                  disabled={materials.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Finished Products Used <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProductsUsed([...productsUsed, { product_id: '', quantity_consumed: '' }])}
              >
                <Plus className="mr-1 h-3 w-3" />Add
              </Button>
            </div>
            {productsUsed.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add a finished product here if a previously produced item was consumed as an input (e.g. colour series blends).
              </p>
            ) : (
              productsUsed.map((p, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_120px_40px] gap-2 items-end">
                  <Select
                    value={p.product_id}
                    onValueChange={(v) => {
                      const next = [...productsUsed];
                      next[idx].product_id = v;
                      setProductsUsed(next);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select finished product" /></SelectTrigger>
                    <SelectContent>
                      {products
                        .filter((pr) => (pr.is_active || pr.id === p.product_id) && pr.id !== productId)
                        .map((pr) => (
                          <SelectItem key={pr.id} value={pr.id}>
                            {pr.name} ({pr.unit}) — stock: {pr.current_stock}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    value={p.quantity_consumed}
                    onChange={(e) => {
                      const next = [...productsUsed];
                      next[idx].quantity_consumed = e.target.value;
                      setProductsUsed(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setProductsUsed(productsUsed.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>


          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Batch info, observations..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!productId || !quantity || isPending}>
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Production Log'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
