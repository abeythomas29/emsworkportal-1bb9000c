import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillingModule } from '@/components/billing/BillingModule';
import { SalesReportsPanel } from '@/components/sales/SalesReportsPanel';
import { Loader2, IndianRupee, FileSpreadsheet, Receipt } from 'lucide-react';

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
          <p className="text-muted-foreground mt-1">
            Create GST invoices and track revenue, customers, and top products.
          </p>
        </div>

        <Tabs defaultValue="billing" className="space-y-4">
          <TabsList>
            <TabsTrigger value="billing"><Receipt className="w-4 h-4 mr-2" /> Billing</TabsTrigger>
            <TabsTrigger value="reports"><FileSpreadsheet className="w-4 h-4 mr-2" /> Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="billing"><BillingModule /></TabsContent>
          <TabsContent value="reports"><SalesReportsPanel /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
