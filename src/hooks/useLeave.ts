import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';
import { leaveRequestSchema, validateLeaveDays } from '@/lib/validations';

export interface LeaveBalance {
  id: string;
  user_id: string;
  casual_leave: number;
  earned_leave: number;
  lwp_taken: number;
  consecutive_work_days: number;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: 'casual' | 'earned' | 'lwp';
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  profiles?: {
    full_name: string;
    employee_id: string | null;
    department: string | null;
  };
}

export function useLeave() {
  const { user } = useAuth();
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaveBalance = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      logError('useLeave.fetchBalance', error);
      return;
    }
    setLeaveBalance(data);
  };

  const fetchLeaveRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logError('useLeave.fetchRequests', error);
      return;
    }
    setLeaveRequests((data || []) as LeaveRequest[]);
  };

  const fetchAllLeaveRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        profiles!leave_requests_user_id_fkey (
          full_name,
          employee_id,
          department
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logError('useLeave.fetchAllRequests', error);
      toast.error('Failed to load leave requests');
      return;
    }

    setAllLeaveRequests((data || []) as unknown as LeaveRequest[]);
  };

  const applyLeave = async (data: {
    leaveType: string;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    reason: string;
  }) => {
    if (!user) return { error: 'Not authenticated' };

    // Validate input
    const validation = leaveRequestSchema.safeParse(data);
    if (!validation.success) {
      const msg = validation.error.issues[0].message;
      toast.error(msg);
      return { error: msg };
    }

    const start = new Date(data.startDate);
    const end = data.endDate ? new Date(data.endDate) : start;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const days = data.isHalfDay ? 0.5 : diffDays;

    const daysError = validateLeaveDays(days);
    if (daysError) {
      toast.error(daysError);
      return { error: daysError };
    }

    // Probation rules: during first 6 months from joining_date,
    // no earned leave allowed and casual leave capped at 1 per calendar month.
    const { data: profile } = await supabase
      .from('profiles')
      .select('joining_date')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.joining_date) {
      const join = new Date(profile.joining_date);
      const probationEnd = new Date(join);
      probationEnd.setMonth(probationEnd.getMonth() + 6);
      const startDate = new Date(data.startDate);

      if (startDate < probationEnd) {
        if (data.leaveType === 'earned') {
          const msg = 'Earned leave is not available during the 6-month probation period.';
          toast.error(msg);
          return { error: msg };
        }
        if (data.leaveType === 'casual') {
          const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
            .toISOString().slice(0, 10);
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
            .toISOString().slice(0, 10);

          const { data: existing } = await supabase
            .from('leave_requests')
            .select('days, status')
            .eq('user_id', user.id)
            .eq('leave_type', 'casual')
            .neq('status', 'rejected')
            .gte('start_date', monthStart)
            .lte('start_date', monthEnd);

          const usedThisMonth = (existing || []).reduce((s, r: any) => s + Number(r.days || 0), 0);
          if (usedThisMonth + days > 1) {
            const msg = 'During probation you can take only 1 casual leave per month.';
            toast.error(msg);
            return { error: msg };
          }
        }
      }
    }

    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      leave_type: data.leaveType,
      start_date: data.startDate,
      end_date: data.endDate || data.startDate,
      is_half_day: data.isHalfDay,
      days: days,
      reason: data.reason,
    });

    if (error) {
      logError('useLeave.applyLeave', error);
      toast.error('Failed to apply for leave');
      return { error: 'Failed to apply for leave. Please try again.' };
    }

    toast.success('Leave application submitted!');
    fetchLeaveRequests();
    return { error: null };
  };

  const approveLeave = async (requestId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) {
      logError('useLeave.approveLeave', error);
      toast.error('Failed to approve leave');
      return;
    }
    toast.success('Leave request approved');
    fetchAllLeaveRequests();
  };

  const rejectLeave = async (requestId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) {
      logError('useLeave.rejectLeave', error);
      toast.error('Failed to reject leave');
      return;
    }
    toast.error('Leave request rejected');
    fetchAllLeaveRequests();
  };

  const cancelLeave = async (requestId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (error) {
      logError('useLeave.cancelLeave', error);
      toast.error('Failed to cancel leave request');
      return;
    }
    toast.success('Leave request cancelled');
    fetchLeaveRequests();
    fetchLeaveBalance();
  };

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      Promise.all([fetchLeaveBalance(), fetchLeaveRequests(), fetchAllLeaveRequests()]).finally(
        () => setIsLoading(false)
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('leave-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchLeaveRequests();
        fetchAllLeaveRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return {
    leaveBalance, leaveRequests, allLeaveRequests, isLoading,
    applyLeave, approveLeave, rejectLeave, cancelLeave,
    refetch: () => { fetchLeaveBalance(); fetchLeaveRequests(); fetchAllLeaveRequests(); },
  };
}
