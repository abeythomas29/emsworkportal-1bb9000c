import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, Receipt, Wallet, Building2 } from 'lucide-react';
import { usePurchaseInvoices } from '@/hooks/usePurchaseInvoices';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
const inrCompact = (v: number) => {
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return inr(v);
};
const monthKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

export function PurchaseReportsPanel() {
  const { invoices, isLoading } = usePurchaseInvoices();

  const stats = useMemo(() => {
    const monthly = new Map<string, { spend: number; count: number; vendors: Map<string, number> }>();
    for (const i of invoices) {
      const k = monthKey(i.invoice_date);
      const cur = monthly.get(k) || { spend: 0, count: 0, vendors: new Map() };
      cur.spend += Number(i.total || 0);
      cur.count += 1;
      cur.vendors.set(i.vendor_name, (cur.vendors.get(i.vendor_name) || 0) + Number(i.total || 0));
      monthly.set(k, cur);
    }
    const trend = Array.from(monthly.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-12)
      .map(([k, v]) => ({ key: k, label: monthLabel(k), spend: v.spend, count: v.count }));

    const total = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const outstanding = invoices.reduce((s, i) => s + (Number(i.total || 0) - Number(i.amount_paid || 0)), 0);

    const vendorMap = new Map<string, number>();
    invoices.forEach((i) => vendorMap.set(i.vendor_name, (vendorMap.get(i.vendor_name) || 0) + Number(i.total || 0)));
    const topVendors = Array.from(vendorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, spend]) => ({ name, spend }));

    return { trend, total, outstanding, topVendors, count: invoices.length };
  }, [invoices]);

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Loading…</div>;

  if (invoices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-2">
          <Receipt className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Upload purchase invoices to see reports.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi icon={<TrendingDown className="w-5 h-5" />} label="Total Spend" value={inrCompact(stats.total)} hint={`${stats.count} invoices`} />
        <Kpi icon={<Wallet className="w-5 h-5" />} label="Outstanding" value={inrCompact(stats.outstanding)} hint="Unpaid + partial" accent="warning" />
        <Kpi icon={<Building2 className="w-5 h-5" />} label="Top Vendor" value={stats.topVendors[0]?.name || '—'} hint={stats.topVendors[0] ? inr(stats.topVendors[0].spend) : ''} truncate />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-semibold">Spend — Last 12 Months</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.trend}>
                  <defs>
                    <linearGradient id="pbar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => (v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : `${(v / 1e3).toFixed(0)}k`)} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                    formatter={(v: number) => [inr(v), 'Spend']}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10 }}
                  />
                  <Bar dataKey="spend" radius={[6, 6, 0, 0]} fill="url(#pbar)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Top Vendors</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topVendors.map((v, idx) => {
                const max = stats.topVendors[0].spend || 1;
                const pct = Math.max(6, (v.spend / max) * 100);
                return (
                  <div key={v.name} className="relative overflow-hidden rounded-lg border border-border p-3">
                    <div className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                        <span className="text-sm font-medium truncate">{v.name}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{inrCompact(v.spend)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint, accent, truncate }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: 'warning'; truncate?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent === 'warning' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>{icon}</span>
        </div>
        <p className={`text-2xl font-bold tabular-nums ${truncate ? 'truncate' : ''}`} title={truncate ? value : undefined}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
