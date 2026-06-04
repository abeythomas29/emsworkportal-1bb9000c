import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  employee_id: string | null;
  department: string | null;
  employee_type: 'online' | 'offline';
  joining_date: string | null;
  avatar_url: string | null;
  is_active: boolean;
  deleted_at: string | null;
  role?: 'admin' | 'manager' | 'employee';
}

interface UseEmployeesOptions {
  includeArchived?: boolean;
}

export function useEmployees(options: UseEmployeesOptions = {}) {
  const { includeArchived = false } = options;
  const { user, role } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployees = async () => {
    if (!user || (role !== 'admin' && role !== 'manager')) {
      setIsLoading(false);
      return;
    }

    let query = supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (!includeArchived) {
      query = query.is('deleted_at', null);
    }
    const { data: profiles, error } = await query;

    if (error) {
      logError('useEmployees.fetch', error);
      setIsLoading(false);
      return;
    }

    const { data: roles } = await supabase.from('user_roles').select('*');

    const employeesWithRoles = (profiles || []).map((profile: any) => {
      const userRole = roles?.find((r) => r.user_id === profile.id);
      return { ...profile, role: userRole?.role as 'admin' | 'manager' | 'employee' | undefined };
    });

    setEmployees(employeesWithRoles);
    setIsLoading(false);
  };

  const deactivateEmployee = async (employeeId: string) => {
    const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', employeeId);
    if (error) {
      logError('useEmployees.deactivate', error);
      toast.error('Failed to deactivate employee');
      return false;
    }
    toast.success('Employee deactivated successfully');
    fetchEmployees();
    return true;
  };

  const activateEmployee = async (employeeId: string) => {
    const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', employeeId);
    if (error) {
      logError('useEmployees.activate', error);
      toast.error('Failed to activate employee');
      return false;
    }
    toast.success('Employee activated successfully');
    fetchEmployees();
    return true;
  };

  // Soft delete: archive an approved employee. Keeps attendance & history viewable to admins.
  const deleteEmployee = async (employeeId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString(), is_active: false } as any)
      .eq('id', employeeId);
    if (error) {
      logError('useEmployees.archive', error);
      toast.error('Failed to archive employee');
      return false;
    }
    toast.success('Employee archived. Their attendance history is preserved.');
    fetchEmployees();
    return true;
  };

  // Restore a previously archived employee.
  const restoreEmployee = async (employeeId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: null, is_active: true } as any)
      .eq('id', employeeId);
    if (error) {
      logError('useEmployees.restore', error);
      toast.error('Failed to restore employee');
      return false;
    }
    toast.success('Employee restored');
    fetchEmployees();
    return true;
  };

  // Hard delete — only used for rejecting unapproved signups (no real history yet).
  const rejectPendingSignup = async (employeeId: string) => {
    const { error: lrErr } = await supabase.from('leave_requests').delete().eq('user_id', employeeId);
    if (lrErr) { logError('useEmployees.reject.leave_requests', lrErr); toast.error('Failed to reject signup'); return false; }

    const { error: lbErr } = await supabase.from('leave_balances').delete().eq('user_id', employeeId);
    if (lbErr) { logError('useEmployees.reject.leave_balances', lbErr); toast.error('Failed to reject signup'); return false; }

    const { error: atErr } = await supabase.from('attendance').delete().eq('user_id', employeeId);
    if (atErr) { logError('useEmployees.reject.attendance', atErr); toast.error('Failed to reject signup'); return false; }

    const { error: whErr } = await supabase.from('work_hours').delete().eq('user_id', employeeId);
    if (whErr) { logError('useEmployees.reject.work_hours', whErr); toast.error('Failed to reject signup'); return false; }

    const { error: urErr } = await supabase.from('user_roles').delete().eq('user_id', employeeId);
    if (urErr) { logError('useEmployees.reject.user_roles', urErr); toast.error('Failed to reject signup'); return false; }

    const { error: prErr } = await supabase.from('profiles').delete().eq('id', employeeId);
    if (prErr) { logError('useEmployees.reject.profiles', prErr); toast.error('Failed to reject signup'); return false; }

    toast.success('Signup rejected and account removed');
    fetchEmployees();
    return true;
  };

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, includeArchived]);

  return {
    employees, isLoading, refetch: fetchEmployees,
    deactivateEmployee, activateEmployee,
    deleteEmployee, restoreEmployee, rejectPendingSignup,
  };
}
