import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Calendar,
  Users,
  Loader2,
  FileSpreadsheet,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAllAttendance } from '@/hooks/useAllAttendance';
import { useEmployees } from '@/hooks/useEmployees';
import { StatusBadge } from '@/components/ui/status-badge';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';

const statusBadgeMap: Record<string, 'present' | 'absent' | 'leave' | 'pending'> = {
  present: 'present',
  absent: 'absent',
  half_day: 'pending',
  leave: 'leave',
  lwp: 'absent',
};

export default function AttendanceReportPage() {
  const { role } = useAuth();
  const { allAttendance, isLoading, fetchAllAttendance, markAbsentForDate } = useAllAttendance();
  const { employees, isLoading: employeesLoading } = useEmployees({ includeArchived: true });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [isMarking, setIsMarking] = useState(false);

  // Only admin and manager can access this
  if (role !== 'admin' && role !== 'manager') {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    fetchAllAttendance(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  }, [selectedMonth, fetchAllAttendance]);

  const filteredAttendance = selectedEmployee === 'all' 
    ? allAttendance 
    : allAttendance.filter(a => a.user_id === selectedEmployee);

  const handleMarkAbsent = async () => {
    setIsMarking(true);
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await markAbsentForDate(yesterday);
    // Refresh data
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    await fetchAllAttendance(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    setIsMarking(false);
  };

  const downloadCSV = (data: typeof allAttendance, filename: string) => {
    const headers = ['Date', 'Employee', 'Employee ID', 'Department', 'Status', 'Check In', 'Check Out', 'Hours'];
    const rows = data.map(a => [
      a.date,
      a.profile?.full_name || 'Unknown',
      a.profile?.employee_id || '-',
      a.profile?.department || '-',
      a.status,
      a.check_in ? format(new Date(a.check_in), 'h:mm a') : '-',
      a.check_out ? format(new Date(a.check_out), 'h:mm a') : '-',
      a.total_hours?.toFixed(1) || '-',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully');
  };

  const downloadAllReport = () => {
    const monthName = format(parseISO(`${selectedMonth}-01`), 'MMMM_yyyy');
    downloadCSV(filteredAttendance, `Attendance_Report_${monthName}`);
  };

  const downloadIndividualReport = (userId: string, name: string) => {
    const employeeData = allAttendance.filter(a => a.user_id === userId);
    const monthName = format(parseISO(`${selectedMonth}-01`), 'MMMM_yyyy');
    downloadCSV(employeeData, `Attendance_${name.replace(/\s+/g, '_')}_${monthName}`);
  };

  // Calculate stats
  const stats = {
    totalRecords: filteredAttendance.length,
    present: filteredAttendance.filter(a => a.status === 'present').length,
    absent: filteredAttendance.filter(a => a.status === 'absent').length,
    leave: filteredAttendance.filter(a => a.status === 'leave' || a.status === 'lwp').length,
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2026, i, 1);
    return {
      value: `2026-${String(i + 1).padStart(2, '0')}`,
      label: format(date, 'MMMM yyyy'),
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Attendance Report</h1>
            <p className="text-muted-foreground">View and download attendance records</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}{emp.deleted_at ? ' (archived)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleMarkAbsent} disabled={isMarking} variant="outline" className="gap-2">
            {isMarking ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
            Mark Yesterday's Absent
          </Button>
          <Button onClick={downloadAllReport} className="gap-2">
            <Download className="w-4 h-4" />
            Download Full Report
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalRecords}</p>
            </CardContent>
          </Card>
          <Card className="bg-success/10 border-success/20">
            <CardContent className="p-4">
              <p className="text-sm text-success">Present</p>
              <p className="text-2xl font-bold text-success">{stats.present}</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">Absent</p>
              <p className="text-2xl font-bold text-destructive">{stats.absent}</p>
            </CardContent>
          </Card>
          <Card className="bg-info/10 border-info/20">
            <CardContent className="p-4">
              <p className="text-sm text-info">On Leave</p>
              <p className="text-2xl font-bold text-info">{stats.leave}</p>
            </CardContent>
          </Card>
        </div>

        {/* Individual Employee Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Individual Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map(emp => {
                const empAttendance = allAttendance.filter(a => a.user_id === emp.id);
                const presentDays = empAttendance.filter(a => a.status === 'present').length;
                const absentDays = empAttendance.filter(a => a.status === 'absent').length;
                
                return (
                  <div key={emp.id} className="p-4 rounded-lg border border-border hover:border-primary transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {emp.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.department || 'No Department'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-4 text-sm">
                        <span className="text-success">{presentDays}P</span>
                        <span className="text-destructive">{absentDays}A</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1"
                        onClick={() => downloadIndividualReport(emp.id, emp.full_name)}
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Attendance Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || employeesLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.slice(0, 50).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(record.date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>{record.profile?.full_name || 'Unknown'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.profile?.department || '-'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={statusBadgeMap[record.status] || 'pending'} />
                        </TableCell>
                        <TableCell>
                          {record.check_in ? format(new Date(record.check_in), 'h:mm a') : '-'}
                        </TableCell>
                        <TableCell>
                          {record.check_out ? format(new Date(record.check_out), 'h:mm a') : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.total_hours ? `${record.total_hours.toFixed(1)}h` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}