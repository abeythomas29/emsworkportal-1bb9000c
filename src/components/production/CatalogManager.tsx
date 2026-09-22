import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react';
import {
  useProducts,
  useRawMaterials,
  useCreateProduct,
  useCreateRawMaterial,
  useUpdateProduct,
  useUpdateRawMaterial,
  useDeleteProduct,
  useDeleteRawMaterial,
  type Product,
  type RawMaterial,
} from '@/hooks/useProduction';

function ProductRow({ p }: { p: Product }) {
  const update = useUpdateProduct();
  const del = useDeleteProduct();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [unit, setUnit] = useState(p.unit);
  const [stock, setStock] = useState(String(p.current_stock));
  const [cost, setCost] = useState(String(p.cost_price ?? 0));

  const save = async () => {
    if (!name.trim()) return;
    await update.mutateAsync({
      id: p.id,
      name: name.trim(),
      unit,
      current_stock: parseFloat(stock) || 0,
      cost_price: parseFloat(cost) || 0,
    });
    setEditing(false);
  };

  const cancel = () => {
    setName(p.name); setUnit(p.unit); setStock(String(p.current_stock)); setCost(String(p.cost_price ?? 0));
    setEditing(false);
  };

  if (editing) {
    return (
      <TableRow>
        <TableCell><Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" /></TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Input type="number" step="0.01" value={stock} onChange={(e) => setStock(e.target.value)} className="h-8 w-24" />
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lt">lt</SelectItem>
                <SelectItem value="pcs">pcs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TableCell>
        <TableCell>
          <Input type="number" step="0.01" aria-label="Cost per unit" value={cost} onChange={(e) => setCost(e.target.value)} className="h-8 w-24" />
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={save} disabled={update.isPending}><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={cancel}><X className="h-4 w-4" /></Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{p.name}</TableCell>
      <TableCell>{Number(p.current_stock).toFixed(2)} {p.unit}</TableCell>
      <TableCell className="tabular-nums">
        {p.cost_price ? `₹ ${Number(p.cost_price).toFixed(2)}` : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RawMaterialRow({ r }: { r: RawMaterial }) {
  const update = useUpdateRawMaterial();
  const del = useDeleteRawMaterial();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [unit, setUnit] = useState<'kg' | 'lt'>(r.unit);
  const [stock, setStock] = useState(String(r.current_stock));
  const [cost, setCost] = useState(String(r.cost_price ?? 0));

  const save = async () => {
    if (!name.trim()) return;
    await update.mutateAsync({
      id: r.id,
      name: name.trim(),
      unit,
      current_stock: parseFloat(stock) || 0,
      cost_price: parseFloat(cost) || 0,
    });
    setEditing(false);
  };

  const cancel = () => {
    setName(r.name); setUnit(r.unit); setStock(String(r.current_stock)); setCost(String(r.cost_price ?? 0));
    setEditing(false);
  };

  if (editing) {
    return (
      <TableRow>
        <TableCell><Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" /></TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Input type="number" step="0.01" value={stock} onChange={(e) => setStock(e.target.value)} className="h-8 w-24" />
            <Select value={unit} onValueChange={(v) => setUnit(v as 'kg' | 'lt')}>
              <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lt">lt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TableCell>
        <TableCell>
          <Input type="number" step="0.01" aria-label="Cost per unit" value={cost} onChange={(e) => setCost(e.target.value)} className="h-8 w-24" />
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={save} disabled={update.isPending}><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={cancel}><X className="h-4 w-4" /></Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{r.name}</TableCell>
      <TableCell>
        <span className={r.current_stock < 0 ? 'text-destructive font-semibold' : ''}>
          {Number(r.current_stock).toFixed(2)} {r.unit}
        </span>
      </TableCell>
      <TableCell className="tabular-nums">
        {r.cost_price ? `₹ ${Number(r.cost_price).toFixed(2)}` : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CatalogManager() {
  const { data: products = [] } = useProducts();
  const { data: rawMaterials = [] } = useRawMaterials();
  const createProduct = useCreateProduct();
  const createRaw = useCreateRawMaterial();

  const [pName, setPName] = useState('');
  const [pStock, setPStock] = useState('');
  const [rName, setRName] = useState('');
  const [rUnit, setRUnit] = useState<'kg' | 'lt'>('kg');
  const [rStock, setRStock] = useState('');

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Products (Finished Goods)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Product name" value={pName} onChange={(e) => setPName(e.target.value)} className="flex-1 min-w-[140px]" />
            <Input type="number" step="0.01" placeholder="Initial stock (kg)" value={pStock} onChange={(e) => setPStock(e.target.value)} className="w-40" />
            <Button
              onClick={async () => {
                if (!pName) return;
                await createProduct.mutateAsync({ name: pName, unit: 'kg', current_stock: parseFloat(pStock) || 0 });
                setPName(''); setPStock('');
              }}
              disabled={!pName || createProduct.isPending}
            >
              <Plus className="mr-1 h-4 w-4" />Add
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Stock</TableHead><TableHead className="w-24" /></TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => <ProductRow key={p.id} p={p} />)}
              {products.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No products yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Raw Materials</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Material name" value={rName} onChange={(e) => setRName(e.target.value)} className="flex-1 min-w-[140px]" />
            <Select value={rUnit} onValueChange={(v) => setRUnit(v as 'kg' | 'lt')}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lt">lt</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" step="0.01" placeholder="Initial stock" value={rStock} onChange={(e) => setRStock(e.target.value)} className="w-32" />
            <Button
              onClick={async () => {
                if (!rName) return;
                await createRaw.mutateAsync({ name: rName, unit: rUnit, current_stock: parseFloat(rStock) || 0 });
                setRName(''); setRStock('');
              }}
              disabled={!rName || createRaw.isPending}
            >
              <Plus className="mr-1 h-4 w-4" />Add
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Stock</TableHead><TableHead className="w-24" /></TableRow>
            </TableHeader>
            <TableBody>
              {rawMaterials.map((r) => <RawMaterialRow key={r.id} r={r} />)}
              {rawMaterials.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No raw materials yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
