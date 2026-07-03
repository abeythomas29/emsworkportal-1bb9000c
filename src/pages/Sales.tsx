import { Navigate } from 'react-router-dom';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { BillingModule } from '@/components/billing/BillingModule';
import { SalesReportsPanel } from '@/components/sales/SalesReportsPanel';
import { Loader2, IndianRupee, FileSpreadsheet, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

type SalesTab = 'billing' | 'reports';

export default function SalesPage() {
  const { role, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<SalesTab>('billing');

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
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between border-b border-border/60 pb-6">
          <div className="space-y-4 min-w-0">
            <div role="tablist" aria-label="Sales sections" className="flex items-center gap-2">
              <PillTab active={tab === 'billing'} onClick={() => setTab('billing')} icon={<Receipt className="w-4 h-4" />}>
                Billing
              </PillTab>
              <PillTab active={tab === 'reports'} onClick={() => setTab('reports')} icon={<FileSpreadsheet className="w-4 h-4" />}>
                Reports
              </PillTab>
            </div>
            <div className="flex items-center gap-3">
              <IndianRupee className="w-7 h-7 md:w-8 md:h-8 text-primary" aria-hidden />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Sales Portal</h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
              Create GST invoices and track revenue, customers, and top products.
            </p>
          </div>
        </header>

        {tab === 'billing' ? <BillingModule /> : <SalesReportsPanel />}
      </div>
    </DashboardLayout>
  );
}

function PillTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold tracking-wide transition-all min-h-11',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
