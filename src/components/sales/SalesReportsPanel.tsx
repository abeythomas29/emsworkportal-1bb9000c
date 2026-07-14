import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  Search,
  TrendingUp,
  TrendingDown,
  Receipt,
  Crown,
  Wallet,
  ArrowUpRight,
  Sparkles,
  Package,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSalesInvoices, useSalesUploads, useUploadSalesExcel } from '@/hooks/useSales';

type Invoice = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  party_name: string;
  payment_type: string | null;
  total_amount: number;
  is_cancelled: boolean;
};

type ItemRow = {
  invoice_date: string;
  item_name: string;
  quantity: number;
  amount: number;
};

function inr(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
}
function inrCompact(v: number) {
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return inr(v);
}
function dateShort(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string, opts: { short?: boolean } = {}) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', {
    month: opts.short ? 'short' : 'long',
    year: 'numeric',
  });
}

function quarterKey(d: string) {
  const dt = new Date(d);
  const q = Math.floor(dt.getMonth() / 3) + 1;
  return `${dt.getFullYear()}-Q${q}`;
}
function quarterLabel(key: string) {
  return key.replace('-', ' ');
}
function yearKey(d: string) {
  return String(new Date(d).getFullYear());
}

function useSalesItemsLite() {
  return useQuery({
    queryKey: ['sales-items-lite'],
    queryFn: async (): Promise<ItemRow[]> => {
      const { data, error } = await supabase
        .from('sales_items')
        .select('invoice_date, item_name, quantity, amount')
        .order('invoice_date', { ascending: false })
        .limit(20000);
      if (error) throw error;
      return (data || []) as ItemRow[];
    },
  });
}

export function SalesReportsPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: invoicesRaw = [], isLoading: invLoading } = useSalesInvoices();
  const { data: itemsRaw = [] } = useSalesItemsLite();
  const { data: uploads = [] } = useSalesUploads();
  const upload = useUploadSalesExcel();
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [topPeriod, setTopPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [predictHorizon, setPredictHorizon] = useState<'quarter' | 'year'>('quarter');

  const invoices = invoicesRaw as unknown as Invoice[];

  // Aggregate per month
  const monthly = useMemo(() => {
    const m = new Map<string, { revenue: number; invoices: number; customers: Set<string> }>();
    for (const i of invoices) {
      if (i.is_cancelled) continue;
      const k = monthKey(i.invoice_date);
      const cur = m.get(k) || { revenue: 0, invoices: 0, customers: new Set<string>() };
      cur.revenue += Number(i.total_amount) || 0;
      cur.invoices += 1;
      cur.customers.add(i.party_name);
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, revenue: v.revenue, invoices: v.invoices, customers: v.customers.size }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [invoices]);

  const availableMonths = useMemo(() => monthly.map((m) => m.key).reverse(), [monthly]);
  const activeMonth = selectedMonth ?? availableMonths[0] ?? null;

  const trend12 = useMemo(() => {
    return monthly.slice(-12).map((m) => ({ ...m, label: monthLabel(m.key, { short: true }) }));
  }, [monthly]);

  const activeStats = useMemo(() => {
    if (!activeMonth) return null;
    const monthInvoices = invoices.filter((i) => !i.is_cancelled && monthKey(i.invoice_date) === activeMonth);
    const revenue = monthInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const count = monthInvoices.length;
    const avg = count ? revenue / count : 0;

    // Top customer
    const custMap = new Map<string, number>();
    monthInvoices.forEach((i) => custMap.set(i.party_name, (custMap.get(i.party_name) || 0) + Number(i.total_amount || 0)));
    let topCustomer: { name: string; revenue: number } | null = null;
    custMap.forEach((v, k) => {
      if (!topCustomer || v > topCustomer.revenue) topCustomer = { name: k, revenue: v };
    });

    // Prior month for delta
    const idx = monthly.findIndex((m) => m.key === activeMonth);
    const prev = idx > 0 ? monthly[idx - 1] : null;
    const delta = prev && prev.revenue > 0 ? ((revenue - prev.revenue) / prev.revenue) * 100 : null;

    // Top products
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    itemsRaw
      .filter((it) => monthKey(it.invoice_date) === activeMonth)
      .forEach((it) => {
        const cur = prodMap.get(it.item_name) || { qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity || 0);
        cur.revenue += Number(it.amount || 0);
        prodMap.set(it.item_name, cur);
      });
    const topProducts = Array.from(prodMap.entries())
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { revenue, count, avg, topCustomer, delta, topProducts, monthInvoices };

  // Top products by period (monthly/quarterly/annually)
  const topProductsByPeriod = useMemo(() => {
    if (!activeMonth) return { periodLabel: '', products: [] as { name: string; qty: number; revenue: number }[] };
    const dt = new Date(`${activeMonth}-01`);
    let filterFn: (it: ItemRow) => boolean;
    let periodLabel = '';
    if (topPeriod === 'month') {
      filterFn = (it) => monthKey(it.invoice_date) === activeMonth;
      periodLabel = monthLabel(activeMonth);
    } else if (topPeriod === 'quarter') {
      const qk = quarterKey(`${activeMonth}-01`);
      filterFn = (it) => quarterKey(it.invoice_date) === qk;
      periodLabel = quarterLabel(qk);
    } else {
      const yk = String(dt.getFullYear());
      filterFn = (it) => yearKey(it.invoice_date) === yk;
      periodLabel = yk;
    }
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    itemsRaw.filter(filterFn).forEach((it) => {
      const cur = prodMap.get(it.item_name) || { qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity || 0);
      cur.revenue += Number(it.amount || 0);
      prodMap.set(it.item_name, cur);
    });
    const products = Array.from(prodMap.entries())
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    return { periodLabel, products };
  }, [activeMonth, itemsRaw, topPeriod]);

  // Demand predictor: compare recent period vs prior baseline
  const predictions = useMemo(() => {
    if (itemsRaw.length === 0) return [];
    const keyFn = predictHorizon === 'quarter' ? quarterKey : yearKey;
    // Bucket qty & revenue per product per period
    const perProduct = new Map<string, Map<string, { qty: number; revenue: number }>>();
    const allPeriods = new Set<string>();
    for (const it of itemsRaw) {
      const pk = keyFn(it.invoice_date);
      allPeriods.add(pk);
      if (!perProduct.has(it.item_name)) perProduct.set(it.item_name, new Map());
      const pmap = perProduct.get(it.item_name)!;
      const cur = pmap.get(pk) || { qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity || 0);
      cur.revenue += Number(it.amount || 0);
      pmap.set(pk, cur);
    }
    const sortedPeriods = Array.from(allPeriods).sort();
    if (sortedPeriods.length < 2) return [];
    const recent = sortedPeriods[sortedPeriods.length - 1];
    const baseline = sortedPeriods.slice(0, -1).slice(-3); // up to 3 prior periods

    const results = Array.from(perProduct.entries()).map(([name, pmap]) => {
      const recentQty = pmap.get(recent)?.qty || 0;
      const recentRev = pmap.get(recent)?.revenue || 0;
      const baseVals = baseline.map((k) => pmap.get(k)?.qty || 0);
      const baseAvg = baseVals.length ? baseVals.reduce((a, b) => a + b, 0) / baseVals.length : 0;
      // Linear trend: simple slope over last N periods including recent
      const trendWindow = [...baseline, recent];
      const y = trendWindow.map((k) => pmap.get(k)?.qty || 0);
      const n = y.length;
      const meanX = (n - 1) / 2;
      const meanY = y.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      y.forEach((v, i) => { num += (i - meanX) * (v - meanY); den += (i - meanX) ** 2; });
      const slope = den > 0 ? num / den : 0;
      const forecast = Math.max(0, y[n - 1] + slope);
      const growthPct = baseAvg > 0 ? ((recentQty - baseAvg) / baseAvg) * 100 : recentQty > 0 ? 100 : 0;
      // Score = forecast * (1 + growth), weighted by recent revenue for relevance
      const score = forecast * (1 + Math.max(-0.5, growthPct / 100)) * Math.log(1 + recentRev);
      return { name, recentQty, baseAvg, forecast, growthPct, recentRev, score };
    });
    return results
      .filter((r) => r.forecast > 0 && r.growthPct > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [itemsRaw, predictHorizon]);


  const filteredMonthInvoices = useMemo(() => {
    if (!activeStats) return [] as Invoice[];
    return activeStats.monthInvoices.filter(
      (i) =>
        !search ||
        i.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
        i.party_name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [activeStats, search]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file);
    e.target.value = '';
  };

  if (invLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-4">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold">No sales data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a monthly sales report to unlock revenue insights and trends.
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload Sales Excel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* HERO — big total sales for the selected month */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-background to-secondary/10 p-6 md:p-8">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              Total Sales
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground tabular-nums">
                {inrCompact(activeStats?.revenue || 0)}
              </h2>
              {activeStats?.delta !== null && activeStats?.delta !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    activeStats.delta >= 0
                      ? 'bg-success/15 text-success border border-success/30'
                      : 'bg-destructive/15 text-destructive border border-destructive/30'
                  }`}
                >
                  {activeStats.delta >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {activeStats.delta >= 0 ? '+' : ''}
                  {activeStats.delta.toFixed(1)}% vs prev month
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {activeMonth ? monthLabel(activeMonth) : '—'} · {inr(activeStats?.revenue || 0)}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Month</span>
              <Select value={activeMonth || undefined} onValueChange={(v) => setSelectedMonth(v)}>
                <SelectTrigger className="w-48 bg-background/70 backdrop-blur border-primary/30">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {availableMonths.map((k) => (
                    <SelectItem key={k} value={k}>
                      {monthLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} variant="outline" className="bg-background/70 backdrop-blur">
              {upload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {upload.isPending ? 'Importing…' : 'Upload Excel'}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={<Receipt className="w-5 h-5" />}
          label="Invoices"
          value={String(activeStats?.count || 0)}
          hint={`in ${activeMonth ? monthLabel(activeMonth, { short: true }) : '—'}`}
          accent="teal"
        />
        <KpiCard
          icon={<Wallet className="w-5 h-5" />}
          label="Avg Invoice Value"
          value={inrCompact(activeStats?.avg || 0)}
          hint={inr(activeStats?.avg || 0)}
          accent="gold"
        />
        <KpiCard
          icon={<Crown className="w-5 h-5" />}
          label="Top Customer"
          value={activeStats?.topCustomer?.name || '—'}
          hint={activeStats?.topCustomer ? inr(activeStats.topCustomer.revenue) : 'No sales yet'}
          accent="muted"
          truncate
        />
      </div>

      {/* Trend + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Revenue — Last 12 Months</CardTitle>
            <span className="text-xs text-muted-foreground">Tap a bar to focus that month</span>
          </CardHeader>
          <CardContent>
            {trend12.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Not enough data.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend12} onClick={(e: unknown) => {
                    const ev = e as { activePayload?: Array<{ payload?: { key?: string } }> } | null;
                    const k = ev?.activePayload?.[0]?.payload?.key;
                    if (k) setSelectedMonth(k);
                  }}>
                    <defs>
                      <linearGradient id="barActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="barIdle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => (v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : `${(v / 1e3).toFixed(0)}k`)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                      formatter={(v: number) => [inr(v), 'Revenue']}
                      labelFormatter={(l) => `Month: ${l}`}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 10,
                      }}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {trend12.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={entry.key === activeMonth ? 'url(#barActive)' : 'url(#barIdle)'}
                          className="cursor-pointer"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {!activeStats?.topProducts.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No product data for this month.</p>
            ) : (
              <div className="space-y-2">
                {activeStats.topProducts.map((p, idx) => {
                  const max = activeStats.topProducts[0].revenue || 1;
                  const pct = Math.max(6, (p.revenue / max) * 100);
                  return (
                    <div key={p.name} className="relative overflow-hidden rounded-lg border border-border p-3">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/10"
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium truncate" title={p.name}>{p.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold tabular-nums">{inrCompact(p.revenue)}</p>
                          <p className="text-[10px] text-muted-foreground">{p.qty.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices for the selected month */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Invoices · {activeMonth ? monthLabel(activeMonth) : '—'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredMonthInvoices.length} of {activeStats?.count || 0} shown
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoice or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredMonthInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No invoices match this view.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMonthInvoices.slice(0, 300).map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap">{dateShort(inv.invoice_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_no}</TableCell>
                      <TableCell className="max-w-[240px] truncate" title={inv.party_name}>{inv.party_name}</TableCell>
                      <TableCell>{inv.payment_type || '—'}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{inr(Number(inv.total_amount))}</TableCell>
                      <TableCell>
                        {inv.is_cancelled ? (
                          <Badge variant="destructive">Cancelled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-success border-success">Completed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredMonthInvoices.length > 300 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Showing first 300 of {filteredMonthInvoices.length} invoices.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload history */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" /> Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Inserted</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Matched</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.slice(0, 5).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(u.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{u.file_name}</TableCell>
                      <TableCell className="text-right">{u.invoices_inserted}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{u.invoices_skipped}</TableCell>
                      <TableCell className="text-right">{u.items_inserted}</TableCell>
                      <TableCell className="text-right">{u.items_matched_to_products}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
  truncate,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent: 'gold' | 'teal' | 'muted';
  truncate?: boolean;
}) {
  const styles = {
    gold: 'from-primary/15 via-primary/5 to-transparent border-primary/25 text-primary',
    teal: 'from-secondary/20 via-secondary/5 to-transparent border-secondary/30 text-secondary-foreground',
    muted: 'from-muted/40 via-muted/10 to-transparent border-border text-muted-foreground',
  }[accent];

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 ${styles}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
        {icon}
        <span>{label}</span>
      </div>
      <p
        className={`mt-3 text-2xl font-bold text-foreground tabular-nums ${truncate ? 'truncate' : ''}`}
        title={truncate ? value : undefined}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
    </div>
  );
}
