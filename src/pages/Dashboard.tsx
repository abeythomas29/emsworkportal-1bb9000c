import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { CheckInOutCard } from '@/components/attendance/CheckInOutCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAttendance } from '@/hooks/useAttendance';
import { useLeave } from '@/hooks/useLeave';
import { useEmployees } from '@/hooks/useEmployees';
import { ProfileCompletionDialog } from '@/components/ProfileCompletionDialog';
import { BirthdayReminders } from '@/components/dashboard/BirthdayReminders';
import { OnLeaveToday } from '@/components/dashboard/OnLeaveToday';
import { ProductionOTSummary } from '@/components/dashboard/ProductionOTSummary';
import { ProductionTodayWidget } from '@/components/dashboard/ProductionTodayWidget';
import { LowStockWidget } from '@/components/dashboard/LowStockWidget';
import { SalesKpiStrip } from '@/components/dashboard/SalesKpiStrip';
import { PendingLeavesCompact } from '@/components/dashboard/PendingLeavesCompact';
import { PurchaseRequestsWidget } from '@/components/dashboard/PurchaseRequestsWidget';
import { ResearchTodayWidget } from '@/components/dashboard/ResearchTodayWidget';
import {
  Users,
  Clock,
  Calendar,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user, role } = useAuth();
  const { attendanceHistory, todayAttendance, isLoading: attendanceLoading } = useAttendance();
  const { leaveBalance, allLeaveRequests, approveLeave, rejectLeave, isLoading: leaveLoading } = useLeave();
  const { employees } = useEmployees();

  const isAdmin = role === 'admin' || role === 'manager';

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Calculate stats from real attendance data
  const daysWorkedThisMonth = attendanceHistory.filter(
    (a) =>
      new Date(a.date).getMonth() === new Date().getMonth() &&
      a.status === 'present'
  ).length;

  const totalHoursThisMonth = attendanceHistory
    .filter(
      (a) =>
        new Date(a.date).getMonth() === new Date().getMonth() &&
        a.total_hours
    )
    .reduce((sum, a) => sum + (a.total_hours || 0), 0);

  const pendingLeaveRequests = allLeaveRequests.filter(r => r.status === 'pending');

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      casual: 'Casual',
      earned: 'Earned',
      lwp: 'LWP',
    };
    return labels[type] || type;
  };

  const isLoading = attendanceLoading || leaveLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ProfileCompletionDialog />
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening today,{' '}
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge
              status={todayAttendance?.check_in ? 'present' : 'pending'}
            />
            <span className="text-sm text-muted-foreground">
              {user?.employeeType === 'online' ? 'Online Employee' : 'Offline Employee'}
            </span>
          </div>
        </div>

        {/* Admin: Sales KPI strip (full width) */}
        {role === 'admin' && (
          <SalesKpiStrip />
        )}

        {/* Employee Stats */}
        {!isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link to="/attendance" className="block">
              <StatCard
                title="Days Worked"
                value={daysWorkedThisMonth}
                subtitle="This month"
                icon={<CheckCircle2 className="w-6 h-6 text-success" />}
                variant="primary"
                className="cursor-pointer hover:shadow-lg transition-shadow"
              />
            </Link>
            <Link to="/leave" className="block">
              <StatCard
                title="Leave Balance"
                value={leaveBalance ? (leaveBalance.casual_leave + leaveBalance.earned_leave) : 37}
                subtitle="Days remaining"
                icon={<Calendar className="w-6 h-6 text-info" />}
                variant="secondary"
                className="cursor-pointer hover:shadow-lg transition-shadow"
              />
            </Link>
            {user?.employeeType === 'online' && (
              <Link to="/work-hours" className="block">
                <StatCard
                  title="Hours Logged"
                  value={totalHoursThisMonth.toFixed(1)}
                  subtitle="This month"
                  icon={<Clock className="w-6 h-6 text-primary" />}
                  variant="default"
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                />
              </Link>
            )}
            <Link to="/attendance" className="block">
              <StatCard
                title="Attendance Rate"
                value={`${daysWorkedThisMonth > 0 ? Math.round((daysWorkedThisMonth / 22) * 100) : 0}%`}
                subtitle="This month"
                icon={<TrendingUp className="w-6 h-6 text-success" />}
                trend={{ value: 2.5, isPositive: true }}
                variant="success"
                className="cursor-pointer hover:shadow-lg transition-shadow"
              />
            </Link>
          </div>
        )}

        {/* ===== ADMIN LAYOUT ===== */}
        {isAdmin && (
          <>
            {/* Production + Low Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProductionTodayWidget />
              <LowStockWidget />
            </div>

            {/* Pending Leaves + On Leave Today */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PendingLeavesCompact />
              <OnLeaveToday />
            </div>

            {/* Purchase Requests */}
            <PurchaseRequestsWidget />

            {/* Birthdays + Check In/Out */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BirthdayReminders />
              <CheckInOutCard />
            </div>
          </>
        )}

        {/* ===== EMPLOYEE LAYOUT ===== */}
        {!isAdmin && (
          <>
            {/* Birthday + On Leave Today */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BirthdayReminders />
              <OnLeaveToday />
            </div>

            {/* Production Worker widgets: OT + Low Stock alerts */}
            {user?.departments?.includes('production') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProductionOTSummary />
                <LowStockWidget />
              </div>
            )}

            {/* Research dept widget */}
            {user?.departments?.includes('research') && (
              <ResearchTodayWidget />
            )}

            {/* Purchase Requests for everyone */}
            <PurchaseRequestsWidget />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <CheckInOutCard />

              {/* Employee Quick Actions */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {user?.employeeType === 'online' && (
                      <Link to="/work-hours">
                        <div className="p-6 rounded-xl bg-gradient-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer">
                          <Clock className="w-8 h-8 mb-3" />
                          <h3 className="font-semibold text-lg">Log Work Hours</h3>
                          <p className="text-sm opacity-80">Record today's work</p>
                        </div>
                      </Link>
                    )}
                    <Link to="/leave">
                      <div className="p-6 rounded-xl bg-gradient-secondary text-secondary-foreground hover:opacity-90 transition-opacity cursor-pointer">
                        <Calendar className="w-8 h-8 mb-3" />
                        <h3 className="font-semibold text-lg">Apply for Leave</h3>
                        <p className="text-sm opacity-80">Request time off</p>
                      </div>
                    </Link>
                    <Link to="/attendance">
                      <div className="p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                        <CheckCircle2 className="w-8 h-8 mb-3 text-primary" />
                        <h3 className="font-semibold text-lg">View Attendance</h3>
                        <p className="text-sm text-muted-foreground">Check your records</p>
                      </div>
                    </Link>
                    <Link to="/settings">
                      <div className="p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                        <Users className="w-8 h-8 mb-3 text-accent" />
                        <h3 className="font-semibold text-lg">My Profile</h3>
                        <p className="text-sm text-muted-foreground">Update information</p>
                      </div>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
