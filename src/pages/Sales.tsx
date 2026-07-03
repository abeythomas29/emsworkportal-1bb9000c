import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSalesInvoices, useSalesUploads, useUploadSalesExcel } from '@/hooks/useSales';
import { SalesOverviewWidget } from '@/components/dashboard/SalesOverviewWidget';
import { BillingModule } from '@/components/billing/BillingModule';
import { Upload, Loader2, FileSpreadsheet, IndianRupee, Search, Receipt } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ReportsTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const { data: invoices = [], isLoading: invLoading } = useSalesInvoices();
  const { data: uploads = [] } = useSalesUploads();
  const upload = useUploadSalesExcel();

  const handlePick = () => fileRef.current?.click();
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file);
    e.target.value = '';
  };

  const filtered = invoices.filter(
    (i) =>
      !search ||
      i.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      i.party_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <Button onClick={handlePick} disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {upload.isPending ? 'Importing…' : 'Upload Sales Excel'}
        </Button>
      </div>

      <SalesOverviewWidget />

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-lg font-semibold">Recent Invoices</CardTitle>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search invoice or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {invLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No invoices yet.</p>
            </div>
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
                  {filtered.slice(0, 200).map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(inv.invoice_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_no}</TableCell>
                      <TableCell className="max-w-[240px] truncate" title={inv.party_name}>{inv.party_name}</TableCell>
                      <TableCell>{inv.payment_type || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(inv.total_amount))}</TableCell>
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
              {filtered.length > 200 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">Showing latest 200 of {filtered.length} invoices.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Upload History</CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No uploads yet.</p>
          ) : (
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
                    <TableHead className="text-right">Stock Deducted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(u.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{u.file_name}</TableCell>
                      <TableCell className="text-right">{u.invoices_inserted}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{u.invoices_skipped}</TableCell>
                      <TableCell className="text-right">{u.items_inserted}</TableCell>
                      <TableCell className="text-right">{u.items_matched_to_products}</TableCell>
                      <TableCell className="text-right">{Number(u.stock_deducted_total).toFixed(2)} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SalesPage() {
  const { role, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <IndianRupee className="w-8 h-8 text-primary" />
            Sales Portal
          </h1>
          <p className="text-muted-foreground mt-1">Create GST invoices and track revenue, customers, and top products.</p>
        </div>

        <Tabs defaultValue="billing" className="space-y-4">
          <TabsList>
            <TabsTrigger value="billing"><Receipt className="w-4 h-4 mr-2" /> Billing</TabsTrigger>
            <TabsTrigger value="reports"><FileSpreadsheet className="w-4 h-4 mr-2" /> Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="billing"><BillingModule /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
