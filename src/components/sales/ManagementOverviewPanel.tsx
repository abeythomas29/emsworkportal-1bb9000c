import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, TrendingDown, Wallet, Users, Package, Receipt, AlertTriangle } from 'lucide-react';

function inr(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
}
function pct(v: number) {
  return `${(v || 0).toFixed(1)}%`;
}
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fyStart(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(y, 3, 1);
}

type Preset = 'this_month' | 'last_month' | 'this_quarter' | 'this_fy' | 'last_fy' | 'custom';

function rangeFor(preset: Preset, from: string, to: string) {
  const today = new Date();
  const som = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const eom = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  switch (preset) {
    case 'this_month':
      return { from: iso(som(today)), to: iso(eom(today)) };
    case 'last_month': {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { from: iso(som(lm)), to: iso(eom(lm)) };
    }
    case 'this_quarter': {
      const qs = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      return { from: iso(qs), to: iso(new Date(qs.getFullYear(), qs.getMonth() + 3, 0)) };
    }
    case 'this_fy': {
      const s = fyStart(today);
      return { from: iso(s), to: iso(new Date(s.getFullYear() + 1, 2, 31)) };
    }
    case 'last_fy': {
      const s = fyStart(today);
      const p = new Date(s.getFullYear() - 1, 3, 1);
      return { from: iso(p), to: iso(new Date(p.getFullYear() + 1, 2, 31)) };
    }
    default:
      return { from, to };
  }
}

/** Whole (or partial) months covered by the range — used to pro-rate monthly salary cost. */
function monthsBetween(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return 0;
  const days = (b.getTime() - a.getTime()) / 86400000 + 1;
  return Math.max(days / 30.44, 0);
}

interface SaleItemRow {
  invoice_date: string;
  item_name: string;
  quantity: number;
  unit: string | null;
  amount: number;
  tax: number;
  discount: number;
  product_id: string | null;
}

function useOverviewData(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['management-overview', from, to],
    enabled,
    queryFn: async () => {
      const [itemsRes, invRes, productsRes, profilesRes, purchasesRes, reimbRes] = await Promise.all([
        supabase
          .from('sales_items')
          .select('invoice_date, item_name, quantity, unit, amount, tax, discount, product_id')
          .gte('invoice_date', from)
          .lte('invoice_date', to)
          .limit(20000),
        supabase
          .from('sales_invoices')
          .select('invoice_date, total_amount, received_amount, balance_due, is_cancelled, payment_type')
          .gte('invoice_date', from)
          .lte('invoice_date', to)
          .limit(20000),
        supabase.from('products').select('id, name, unit, cost_price'),
        supabase.from('profiles').select('id, base_salary').eq('is_active', true),
        supabase
          .from('purchase_invoices')
          .select('invoice_date, total, sub_total')
          .gte('invoice_date', from)
          .lte('invoice_date', to)
          .limit(20000),
        supabase
          .from('reimbursement_requests')
          .select('expense_date, amount, status')
          .gte('expense_date', from)
          .lte('expense_date', to)
          .limit(20000),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      return {
        items: (itemsRes.data || []) as SaleItemRow[],
        invoices: (invRes.data || []) as { total_amount: number; balance_due: number; is_cancelled: boolean }[],
        products: (productsRes.data || []) as { id: string; name: string; unit: string; cost_price: number }[],
        profiles: (profilesRes.data || []) as { id: string; base_salary: number }[],
        purchases: (purchasesRes.data || []) as { total: number; sub_total: number }[],
        reimbursements: (reimbRes.data || []) as { amount: number; status: string }[],
      };
    },
  });
}

export function ManagementOverviewPanel() {
  const { session } = useAuth();
  const [preset, setPreset] = useState<Preset>('this_fy');
  const today = new Date();
  const [customFrom, setCustomFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customTo, setCustomTo] = useState(iso(today));
  const { from, to } = rangeFor(preset, customFrom, customTo);

  const { data, isLoading } = useOverviewData(from, to, !!session);

  const m = useMemo(() => {
    const items = data?.items || [];
    const products = data?.products || [];
    const costById = new Map(products.map((p) => [p.id, Number(p.cost_price) || 0]));
    const costByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), Number(p.cost_price) || 0]));

    let revenue = 0;
    let cogs = 0;
    let costedRevenue = 0;
    const byProduct = new Map<
      string,
      { name: string; unit: string; qty: number; revenue: number; cost: number; hasCost: boolean }
    >();

    for (const it of items) {
      const net = (Number(it.amount) || 0) - (Number(it.tax) || 0);
      revenue += net;
      const qty = Number(it.quantity) || 0;
      const unitCost = it.product_id
        ? costById.get(it.product_id) ?? 0
        : costByName.get((it.item_name || '').trim().toLowerCase()) ?? 0;
      const lineCost = unitCost * qty;
      cogs += lineCost;
      if (unitCost > 0) costedRevenue += net;

      const key = it.product_id || (it.item_name || '').trim().toLowerCase();
      const prev = byProduct.get(key) || {
        name: it.item_name || 'Unnamed',
        unit: it.unit || '',
        qty: 0,
        revenue: 0,
        cost: 0,
        hasCost: unitCost > 0,
      };
      prev.qty += qty;
      prev.revenue += net;
      prev.cost += lineCost;
      prev.hasCost = prev.hasCost || unitCost > 0;
      byProduct.set(key, prev);
    }

    const grossProfit = revenue - cogs;
    const months = monthsBetween(from, to);
    const monthlySalary = (data?.profiles || []).reduce((s, p) => s + (Number(p.base_salary) || 0), 0);
    const salaryCost = monthlySalary * months;
    const purchases = (data?.purchases || []).reduce((s, p) => s + (Number(p.sub_total) || Number(p.total) || 0), 0);
    const reimbursements = (data?.reimbursements || [])
      .filter((r) => r.status === 'approved' || r.status === 'paid')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const opex = salaryCost + reimbursements;
    const netProfit = grossProfit - opex;

    const outstanding = (data?.invoices || [])
      .filter((i) => !i.is_cancelled)
      .reduce((s, i) => s + (Number(i.balance_due) || 0), 0);

    const uncosted = Array.from(byProduct.values()).filter((p) => !p.hasCost).length;

    return {
      revenue,
      cogs,
      grossProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      salaryCost,
      purchases,
      reimbursements,
      opex,
      netProfit,
      netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      outstanding,
      months,
      uncosted,
      coverage: revenue > 0 ? (costedRevenue / revenue) * 100 : 0,
      products: Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue),
    };
  }, [data, from, to]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1 sm:w-56">
            <Label className="text-xs">Period</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="this_quarter">This quarter</SelectItem>
                <SelectItem value="this_fy">This financial year</SelectItem>
                <SelectItem value="last_fy">Last financial year</SelectItem>
                <SelectItem value="custom">Custom dates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground sm:ml-auto">
            Showing {new Date(from).toLocaleDateString('en-GB')} – {new Date(to).toLocaleDateString('en-GB')}
          </p>
        </CardContent>
      </Card>

      {m.uncosted > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden />
          <p className="text-muted-foreground">
            {m.uncosted} item{m.uncosted > 1 ? 's' : ''} sold in this period have no cost price set, so profit is
            overstated. Add cost per unit in the Production catalogue for accurate margins.
          </p>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Kpi title="Revenue (net of GST)" value={inr(m.revenue)} icon={<Receipt className="w-5 h-5" />} />
        <Kpi title="Cost of goods sold" value={inr(m.cogs)} icon={<Package className="w-5 h-5" />} />
        <Kpi
          title="Gross profit"
          value={inr(m.grossProfit)}
          sub={`${pct(m.grossMargin)} margin`}
          positive={m.grossProfit >= 0}
          icon={m.grossProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        />
        <Kpi
          title="Salaries (est.)"
          value={inr(m.salaryCost)}
          sub={`${m.months.toFixed(1)} month(s) of payroll`}
          icon={<Users className="w-5 h-5" />}
        />
        <Kpi
          title="Other expenses"
          value={inr(m.reimbursements)}
          sub="Approved reimbursements"
          icon={<Wallet className="w-5 h-5" />}
        />
        <Kpi
          title="Net profit"
          value={inr(m.netProfit)}
          sub={`${pct(m.netMargin)} of revenue`}
          positive={m.netProfit >= 0}
          highlight
          icon={m.netProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        />
      </div>

      {/* Secondary figures */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniStat label="Vendor purchases billed" value={inr(m.purchases)} />
        <MiniStat label="Total operating expenses" value={inr(m.opex)} />
        <MiniStat label="Outstanding from customers" value={inr(m.outstanding)} />
      </div>

      {/* Product profitability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product profitability</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty sold</TableHead>
                <TableHead className="text-right">Avg selling price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No sales in this period
                  </TableCell>
                </TableRow>
              )}
              {m.products.map((p) => {
                const profit = p.revenue - p.cost;
                const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                return (
                  <TableRow key={p.name + p.unit}>
                    <TableCell className="font-medium">
                      {p.name}
                      {!p.hasCost && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          no cost set
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.qty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {p.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.qty > 0 ? inr(p.revenue / p.qty) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.hasCost ? inr(p.cost) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(p.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.hasCost ? inr(profit) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.hasCost ? pct(margin) : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
  icon,
  positive,
  highlight,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  positive?: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/50 shadow-[0_0_24px_hsl(var(--primary)/0.15)]' : undefined}>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <span className={positive === false ? 'text-destructive' : 'text-primary'} aria-hidden>
            {icon}
          </span>
        </div>
        <p
          className={`text-2xl font-bold tabular-nums ${
            positive === false ? 'text-destructive' : 'text-foreground'
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}
