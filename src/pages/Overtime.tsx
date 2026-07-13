import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOTRequests } from '@/hooks/useOTRequests';
import { useAttendance } from '@/hooks/useAttendance';
import { useMonthlyOTSummary } from '@/hooks/useOTCalculation';
import { OTSummaryCard } from '@/components/overtime/OTSummaryCard';
import { OTHistoryCard } from '@/components/overtime/OTHistoryCard';

import { WorkingHoursInfo } from '@/components/overtime/WorkingHoursInfo';
import { Navigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PendingOTItem {
  id: string;
  user_id: string;
  date: string;
  ot_type: string;
  ot_minutes: number;
  status: string;
  notes: string | null;
  created_at: string;
  employee_name?: string;
}

export default function OvertimePage() {
  const { user, role } = useAuth();
  const isAdminOrManager = role === 'admin' || role === 'manager';

  // Employee's own OT data (always call hooks)
  const { otRequests, baseSalary, isLoading: otLoading, submitOTRequest, deleteOTRequest } = useOTRequests();
  const { attendanceHistory, isLoading: attLoading } = useAttendance();
  const monthlyStats = useMonthlyOTSummary(baseSalary, 8.5, 1.5, attendanceHistory, otRequests);

  // Admin: all pending OT requests
  const [allPendingOT, setAllPendingOT] = useState<PendingOTItem[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const fetchAllPendingOT = useCallback(async () => {
    if (!isAdminOrManager) return;
    setAdminLoading(true);
    try {
      const { data: otData, error } = await supabase
        .from('ot_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch employee names
      const userIds = [...new Set((otData || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, department, additional_departments')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setAllPendingOT(
        (otData || [])
          .filter(r => {
            const profile: any = profileMap.get(r.user_id);
            if (!profile) return false;
            const depts = [profile.department, ...((profile.additional_departments as string[] | null) || [])]
              .map((d: string | null) => (d || '').toLowerCase());
            return depts.includes('production');
          })
          .map(r => ({
            ...r,
            employee_name: profileMap.get(r.user_id)?.full_name || 'Unknown',
          }))
      );
    } catch (err) {
      console.error('Error fetching OT requests:', err);
    } finally {
      setAdminLoading(false);
    }
  }, [isAdminOrManager]);

  useEffect(() => {
    fetchAllPendingOT();
  }, [fetchAllPendingOT]);

  const handleOTAction = async (otId: string, action: 'approved' | 'rejected') => {
    if (!user) return;
    const { error } = await supabase
      .from('ot_requests')
      .update({
        status: action,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', otId);

    if (error) {
      toast.error(`Failed to ${action} OT request`);
      return;
    }
    toast.success(`OT request ${action}`);
    fetchAllPendingOT();
  };

  // Only production employees can see their own OT; admins/managers see the admin view
  const isProductionEmployee = user?.departments?.includes('production');
  if (user && !isAdminOrManager && !isProductionEmployee) {
    return <Navigate to="/dashboard" replace />;
  }

  if (otLoading || attLoading || adminLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const pendingRequests = allPendingOT.filter(r => r.status === 'pending');
  const recentHistory = allPendingOT.slice(0, 20);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Overtime Management</h1>
            <p className="text-muted-foreground">
              {isAdminOrManager
                ? 'Manage overtime requests for production workers'
                : 'OT is auto-tracked from your check-in/out times. Extra time after 6 PM goes to admin for approval.'}
            </p>
          </div>
        </div>

        {/* Employee's own OT view */}
        {isProductionEmployee && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OTSummaryCard
                monthlyOTMinutes={monthlyStats.totalMonthlyOTMinutes}
                pendingOTMinutes={monthlyStats.monthlyPendingOT}
                totalPayment={monthlyStats.totalMonthlyPayment}
                otHourlyRate={monthlyStats.otHourlyRate}
                formattedMonthlyOT={monthlyStats.formattedMonthlyOT}
                formattedPendingOT={monthlyStats.formattedPendingOT}
                daysWorked={monthlyStats.daysWorked}
              />
              <WorkingHoursInfo
                baseSalary={baseSalary}
                workingHours={8.5}
                otMultiplier={1.5}
                otHourlyRate={monthlyStats.otHourlyRate}
              />
            </div>
            <OTHistoryCard otRequests={otRequests} onDelete={deleteOTRequest} />
          </>
        )}

        {/* Admin/Manager view - Pending approvals */}
        {isAdminOrManager && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pending OT Approvals
                  {pendingRequests.length > 0 && (
                    <Badge variant="destructive">{pendingRequests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No pending OT requests</p>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div className="space-y-1">
                          <p className="font-medium">{req.employee_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(req.date), 'dd MMM yyyy')} • {req.ot_type === 'auto_30min' ? 'Auto 30min' : req.ot_type === 'auto_after_6pm' ? 'After 6 PM (Auto)' : req.ot_type === 'auto_before_9am' ? 'Before 9 AM (Auto)' : req.ot_type === 'before_9am' ? 'Before 9 AM' : 'After 6 PM'} • {Math.floor(req.ot_minutes / 60)}h {req.ot_minutes % 60}m
                          </p>
                          {req.notes && <p className="text-xs text-muted-foreground">{req.notes}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => handleOTAction(req.id, 'approved')}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => handleOTAction(req.id, 'rejected')}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent OT History (Production)</CardTitle>
              </CardHeader>
              <CardContent>
                {recentHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No OT records found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Employee</th>
                          <th className="text-left py-2 px-3 font-medium">Date</th>
                          <th className="text-left py-2 px-3 font-medium">Type</th>
                          <th className="text-left py-2 px-3 font-medium">Duration</th>
                          <th className="text-left py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentHistory.map(req => (
                          <tr key={req.id} className="border-b last:border-0">
                            <td className="py-2 px-3">{req.employee_name}</td>
                            <td className="py-2 px-3">{format(new Date(req.date), 'dd MMM yyyy')}</td>
                            <td className="py-2 px-3 capitalize">{req.ot_type === 'auto_30min' ? 'Auto 30min' : req.ot_type === 'auto_after_6pm' ? 'After 6 PM (Auto)' : req.ot_type === 'auto_before_9am' ? 'Before 9 AM (Auto)' : req.ot_type === 'before_9am' ? 'Before 9 AM' : 'After 6 PM'}</td>
                            <td className="py-2 px-3">{Math.floor(req.ot_minutes / 60)}h {req.ot_minutes % 60}m</td>
                            <td className="py-2 px-3">
                              <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                                {req.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
