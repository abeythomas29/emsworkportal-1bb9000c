import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, IndianRupee, Users, Clock, Pencil, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { toast } from 'sonner';

interface EmployeeSalary {
  id: string;
  full_name: string;
  department: string | null;
  base_salary: number;
  employee_type: string;
  presentDays: number;
  totalWorkingDays: number;
  lwpDays: number;
  approvedOTMinutes: number;
  autoOTMinutes: number;
  otPayment: number;
  deductions: number;
  effectiveSalary: number;
  totalSalary: number;
}

export default function SalaryPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [employees, setEmployees] = useState<EmployeeSalary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSalary, setEditingSalary] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchSalaryData = async () => {
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');

      // Calculate working days in the month (exclude weekends)
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const totalWorkingDays = allDays.filter(d => !isWeekend(d)).length;

      // Fetch all active employees
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, department, base_salary, employee_type, joining_date, ot_eligible')
        .eq('is_active', true)
        .order('full_name');

      if (!profiles) { setIsLoading(false); return; }

      const allIds = profiles.map(p => p.id);

      // Fetch attendance for present days count
      const { data: attData } = await supabase
        .from('attendance')
        .select('user_id, status, check_out')
        .gte('date', startStr)
        .lte('date', endStr)
        .in('user_id', allIds);

      // Count present days and LWP days per user
      const presentMap = new Map<string, number>();
      const lwpMap = new Map<string, number>();
      const autoOTMap = new Map<string, number>();

      (attData || []).forEach(a => {
        if (a.status === 'present' || a.status === 'half_day') {
          const days = a.status === 'half_day' ? 0.5 : 1;
          presentMap.set(a.user_id, (presentMap.get(a.user_id) || 0) + days);
        }
        if (a.status === 'lwp') {
          lwpMap.set(a.user_id, (lwpMap.get(a.user_id) || 0) + 1);
        }
        // Auto OT for production (checkout after 5:30 PM)
        if (a.check_out) {
          const checkOutTime = new Date(a.check_out);
          const totalMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes();
          let autoMin = 0;
          if (totalMinutes >= 18 * 60) {
            autoMin = 30;
          } else if (totalMinutes > 17 * 60 + 30) {
            autoMin = totalMinutes - (17 * 60 + 30);
          }
          if (autoMin > 0) {
            autoOTMap.set(a.user_id, (autoOTMap.get(a.user_id) || 0) + autoMin);
          }
        }
      });

      // Fetch approved leave requests for LWP count
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('user_id, leave_type, days')
        .eq('status', 'approved')
        .eq('leave_type', 'lwp')
        .gte('start_date', startStr)
        .lte('end_date', endStr)
        .in('user_id', allIds);

      (leaveData || []).forEach(l => {
        lwpMap.set(l.user_id, (lwpMap.get(l.user_id) || 0) + l.days);
      });

      // Fetch approved OT requests (production only)
      const productionIds = profiles.filter(p => (p as any).ot_eligible).map(p => p.id);
      let otMap = new Map<string, number>();
      if (productionIds.length > 0) {
        const { data: otData } = await supabase
          .from('ot_requests')
          .select('user_id, ot_minutes')
          .eq('status', 'approved')
          .gte('date', startStr)
          .lte('date', endStr)
          .in('user_id', productionIds);

        (otData || []).forEach(r => {
          otMap.set(r.user_id, (otMap.get(r.user_id) || 0) + r.ot_minutes);
        });
      }

      const salaryData: EmployeeSalary[] = profiles.map(p => {
        const isProduction = Boolean((p as any).ot_eligible);
        const lwpDays = lwpMap.get(p.id) || 0;
        const presentDays = presentMap.get(p.id) || 0;

        // Prorate base salary if employee joined mid-month within the selected month
        let proratedBase = p.base_salary;
        if (p.joining_date) {
          const join = new Date(p.joining_date);
          const joinYM = join.getFullYear() * 12 + join.getMonth();
          const selYM = (year) * 12 + (month - 1);
          if (joinYM === selYM) {
            const daysInMonth = monthEnd.getDate();
            const payableDays = daysInMonth - join.getDate() + 1;
            proratedBase = Math.round((p.base_salary / 30) * payableDays * 100) / 100;
          } else if (joinYM > selYM) {
            // Joined after this month — no salary
            proratedBase = 0;
          }
        }

        const dailyRate = p.base_salary / 30;
        const deductions = Math.round(lwpDays * dailyRate * 100) / 100;
        const effectiveSalary = Math.round((proratedBase - deductions) * 100) / 100;

        const approvedOTMins = isProduction ? (otMap.get(p.id) || 0) : 0;
        // Auto OT is already persisted as approved rows in ot_requests — do not re-derive.
        const totalOTMins = approvedOTMins;
        const otHourlyRate = (p.base_salary / 30 / 8.5) * 1.5;
        const otPayment = isProduction ? Math.round((totalOTMins / 60) * otHourlyRate * 100) / 100 : 0;

        return {
          id: p.id,
          full_name: p.full_name,
          department: p.department,
          base_salary: proratedBase,
          employee_type: p.employee_type,
          presentDays,
          totalWorkingDays,
          lwpDays,
          approvedOTMinutes: approvedOTMins,
          autoOTMinutes: 0,
          otPayment,
          deductions,
          effectiveSalary,
          totalSalary: Math.max(0, effectiveSalary) + otPayment,
        };
      });

      setEmployees(salaryData);
    } catch (err) {
      console.error('Error fetching salary data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchSalaryData();
  }, [isAdmin, selectedMonth]);

  const handleSaveSalary = async (employeeId: string) => {
    const newSalary = parseFloat(editValue);
    if (isNaN(newSalary) || newSalary < 0) {
      toast.error('Please enter a valid salary');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ base_salary: newSalary })
      .eq('id', employeeId);

    if (error) {
      toast.error('Failed to update salary');
      return;
    }
    toast.success('Salary updated');
    setEditingSalary(null);
    fetchSalaryData();
  };

  const totals = useMemo(() => {
    const totalBase = employees.reduce((s, e) => s + e.base_salary, 0);
    const totalDeductions = employees.reduce((s, e) => s + e.deductions, 0);
    const totalOT = employees.reduce((s, e) => s + e.otPayment, 0);
    const totalSalary = employees.reduce((s, e) => s + e.totalSalary, 0);
    return { totalBase, totalDeductions, totalOT, totalSalary, count: employees.length };
  }, [employees]);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: format(d, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Salary Overview</h1>
            <p className="text-muted-foreground">Monthly salary breakdown based on attendance, LWP & OT</p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold">{totals.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <IndianRupee className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Base</p>
                  <p className="text-2xl font-bold">₹{totals.totalBase.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <IndianRupee className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">LWP Deductions</p>
                  <p className="text-2xl font-bold">₹{totals.totalDeductions.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Payable</p>
                  <p className="text-2xl font-bold">₹{totals.totalSalary.toLocaleString('en-IN')}</p>
                  {totals.totalOT > 0 && (
                    <p className="text-xs text-muted-foreground">incl. OT: ₹{totals.totalOT.toLocaleString('en-IN')}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee salary table */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Salary Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Employee</th>
                    <th className="text-left py-3 px-2 font-medium">Dept</th>
                    <th className="text-right py-3 px-2 font-medium">Base Salary</th>
                    <th className="text-right py-3 px-2 font-medium">Present</th>
                    <th className="text-right py-3 px-2 font-medium">LWP</th>
                    <th className="text-right py-3 px-2 font-medium">Deduction</th>
                    <th className="text-right py-3 px-2 font-medium">OT</th>
                    <th className="text-right py-3 px-2 font-medium">Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const totalOTMins = emp.approvedOTMinutes + emp.autoOTMinutes;
                    const isProduction = emp.otPayment > 0;
                    return (
                      <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{emp.full_name}</td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="text-xs">{emp.department || 'N/A'}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {editingSalary === emp.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="w-24 h-7 text-right text-sm"
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveSalary(emp.id)}>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingSalary(null)}>
                                <X className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <span>₹{emp.base_salary.toLocaleString('en-IN')}</span>
                              {isAdmin && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => { setEditingSalary(emp.id); setEditValue(String(emp.base_salary)); }}
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">{emp.presentDays}/{emp.totalWorkingDays}</td>
                        <td className="py-3 px-2 text-right">
                          {emp.lwpDays > 0 ? <span className="text-red-600">{emp.lwpDays}</span> : '-'}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {emp.deductions > 0 ? <span className="text-red-600">-₹{emp.deductions.toLocaleString('en-IN')}</span> : '-'}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {isProduction && totalOTMins > 0 ? (
                            <span className="text-green-600">+₹{emp.otPayment.toLocaleString('en-IN')}</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold">₹{emp.totalSalary.toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-3 px-2" colSpan={2}>Total</td>
                    <td className="py-3 px-2 text-right">₹{totals.totalBase.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-2 text-right"></td>
                    <td className="py-3 px-2 text-right"></td>
                    <td className="py-3 px-2 text-right text-red-600">-₹{totals.totalDeductions.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-2 text-right text-green-600">+₹{totals.totalOT.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-2 text-right">₹{totals.totalSalary.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
