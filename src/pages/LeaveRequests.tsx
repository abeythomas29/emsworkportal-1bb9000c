import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Calendar,
  Filter,
  Loader2,
  History,
  User,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLeave } from '@/hooks/useLeave';
import { format, parseISO } from 'date-fns';

export default function LeaveRequestsPage() {
  const { role } = useAuth();
  const { allLeaveRequests, isLoading, approveLeave, rejectLeave } = useLeave();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  // Get unique employees for the filter dropdown
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map<string, { id: string; name: string }>();
    allLeaveRequests.forEach(req => {
      if (req.user_id && req.profiles?.full_name) {
        employeeMap.set(req.user_id, { 
          id: req.user_id, 
          name: req.profiles.full_name 
        });
      }
    });
    return Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allLeaveRequests]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return months;
  }, []);

  const filteredRequests = allLeaveRequests.filter(req => {
    const employeeName = req.profiles?.full_name || '';
    const department = req.profiles?.department || '';
    const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    
    // Month filter - check if the leave request falls in the selected month
    let matchesMonth = true;
    if (monthFilter !== 'all') {
      const requestMonth = format(parseISO(req.start_date), 'yyyy-MM');
      matchesMonth = requestMonth === monthFilter;
    }

    // Employee filter
    const matchesEmployee = employeeFilter === 'all' || req.user_id === employeeFilter;

    return matchesSearch && matchesStatus && matchesMonth && matchesEmployee;
  });

  const pendingCount = allLeaveRequests.filter(r => r.status === 'pending').length;

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      casual: 'Casual Leave',
      earned: 'Earned Leave',
      lwp: 'Leave Without Pay',
    };
    return labels[type] || type;
  };

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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leave Requests</h1>
            <p className="text-muted-foreground">
              {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or department..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                
                {/* Employee Filter */}
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="w-48">
                    <User className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {uniqueEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Month Filter */}
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-44">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {monthOptions.map(month => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear filters button */}
                {(employeeFilter !== 'all' || monthFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setEmployeeFilter('all');
                      setMonthFilter('all');
                      setStatusFilter('all');
                      setSearchTerm('');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Requests List */}
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const isBackDated = new Date(request.start_date) < new Date(request.created_at.split('T')[0]);
            return (
              <Card 
                key={request.id} 
                className={`${request.status === 'pending' ? 'border-warning/30' : ''} ${isBackDated ? 'border-l-4 border-l-warning' : ''}`}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                        {request.profiles?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-foreground">
                            {request.profiles?.full_name || 'Unknown Employee'}
                          </h3>
                          {request.profiles?.employee_id && (
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              {request.profiles.employee_id}
                            </span>
                          )}
                          {request.profiles?.department && (
                            <span className="text-xs text-muted-foreground">
                              {request.profiles.department}
                            </span>
                          )}
                          {isBackDated && (
                            <span className="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning flex items-center gap-1">
                              <History className="w-3 h-3" />
                              Back-dated
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="font-medium text-sm">{getLeaveTypeLabel(request.leave_type)}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(request.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {request.start_date !== request.end_date && (
                              <> - {new Date(request.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                            )}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm font-medium text-primary">
                            {request.days} day{Number(request.days) !== 1 ? 's' : ''}
                            {request.is_half_day && ' (Half Day)'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Applied on {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <StatusBadge status={request.status} />
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveLeave(request.id)}
                            className="text-success border-success hover:bg-success hover:text-success-foreground"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectLeave(request.id)}
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredRequests.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No leave requests found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
