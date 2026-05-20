import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, isLoading, profile, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Block access until admin approves the account
  if (profile && profile.is_active === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Awaiting Admin Approval</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Your account has been created but is not active yet. An administrator must approve
                your account and assign your department before you can access the portal.
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Please check back later or contact your admin.
              </p>
            </div>
            <Button variant="outline" className="gap-2" onClick={logout}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 pt-16 lg:pt-8 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
