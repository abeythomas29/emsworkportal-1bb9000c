import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  UserPlus,
  Filter,
  MoreVertical,
  Mail,
  Building2,
  Loader2,
  Shield,
  LogIn,
  LogOut,
  Clock,
  Trash2,
  UserX,
  UserCheck,
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEmployees } from '@/hooks/useEmployees';
import { AddEmployeeDialog } from '@/components/employees/AddEmployeeDialog';
import { EditProfileDialog } from '@/components/employees/EditProfileDialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface TodayAttendance {
  user_id: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
}

export default function EmployeesPage() {
  const { role } = useAuth();
  const {
    employees, isLoading, refetch,
    deactivateEmployee, activateEmployee,
    deleteEmployee, restoreEmployee, rejectPendingSignup,
  } = useEmployees({ includeArchived: true });
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance[]>([]);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<typeof employees[0] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeEmployees = employees.filter(e => !e.deleted_at);
  const archivedEmployees = employees.filter(e => !!e.deleted_at);
  const pendingEmployees = activeEmployees.filter(e => !e.is_active);

  // Fetch today's attendance for all employees
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('attendance')
        .select('user_id, check_in, check_out, status')
        .eq('date', today);
      
      if (data) {
        setTodayAttendance(data);
      }
    };
    
    fetchTodayAttendance();
  }, [employees]);

  // Only admin and manager can access this
  if (role !== 'admin' && role !== 'manager') {
    return <Navigate to="/dashboard" replace />;
  }

  const getAttendanceStatus = (employeeId: string) => {
    const attendance = todayAttendance.find(a => a.user_id === employeeId);
    if (!attendance) return { status: 'not-checked-in', label: 'Not Checked In', icon: Clock };
    if (attendance.check_out) return { status: 'checked-out', label: format(new Date(attendance.check_out), 'h:mm a'), icon: LogOut };
    if (attendance.check_in) return { status: 'checked-in', label: format(new Date(attendance.check_in), 'h:mm a'), icon: LogIn };
    return { status: attendance.status, label: attendance.status, icon: Clock };
  };

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  const filteredEmployees = activeEmployees.filter(emp => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
    const matchesType = typeFilter === 'all' || emp.employee_type === typeFilter;
    return matchesSearch && matchesDept && matchesType;
  });

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
            <h1 className="text-2xl font-bold text-foreground">Employees</h1>
            <p className="text-muted-foreground">{employees.length} total employees</p>
          </div>
          {role === 'admin' && (
            <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
              <UserPlus className="w-4 h-4" />
              Add Employee
            </Button>
          )}
        </div>

        {/* Pending Approvals */}
        {role === 'admin' && employees.some(e => !e.is_active) && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-warning" />
                <h2 className="font-semibold text-foreground">
                  Pending Approvals ({employees.filter(e => !e.is_active).length})
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                These users have signed up but cannot access the app until you approve them and
                assign a department.
              </p>
              <div className="space-y-2">
                {employees.filter(e => !e.is_active).map((emp) => (
                  <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                      {emp.department && (
                        <p className="text-xs text-muted-foreground mt-0.5">Dept: {emp.department}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setShowEditDialog(true);
                        }}
                      >
                        Assign Department
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setEmployeeToDelete(emp);
                          setShowDeleteDialog(true);
                        }}
                        title="Reject signup and remove account"
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => activateEmployee(emp.id)}
                        disabled={!emp.department}
                        title={!emp.department ? 'Assign a department first' : 'Approve and activate'}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employees Grid */}
        {filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No employees found</p>
              <p className="text-sm text-muted-foreground">Employees will appear here when they sign up</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((employee) => {
              const attendanceInfo = getAttendanceStatus(employee.id);
              const AttendanceIcon = attendanceInfo.icon;
              
              return (
                <Card key={employee.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
                          {employee.full_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{employee.full_name}</h3>
                          <div className="flex items-center gap-1">
                            {employee.role === 'admin' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Admin
                              </span>
                            )}
                            {employee.role === 'manager' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Manager
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/employee/${employee.id}`)}>
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/employee/${employee.id}?tab=attendance`)}>
                            View Attendance
                          </DropdownMenuItem>
                          {role === 'admin' && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setSelectedEmployee(employee);
                                setShowEditDialog(true);
                              }}>
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {employee.is_active ? (
                                <DropdownMenuItem 
                                  onClick={() => deactivateEmployee(employee.id)}
                                  className="text-warning"
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => activateEmployee(employee.id)}
                                  className="text-success"
                                >
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => {
                                  setEmployeeToDelete(employee);
                                  setShowDeleteDialog(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Employee
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        <span>{employee.department || 'Not assigned'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{employee.employee_id || 'No ID'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          employee.employee_type === 'online' 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {employee.employee_type}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                        attendanceInfo.status === 'checked-in' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : attendanceInfo.status === 'checked-out'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <AttendanceIcon className="w-3 h-3" />
                        <span>{attendanceInfo.label}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AddEmployeeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={refetch}
      />

      <EditProfileDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        profile={selectedEmployee}
        onSuccess={refetch}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{employeeToDelete?.full_name}</strong>? 
              This will permanently remove the employee and all their records including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All leave requests (approved, pending, rejected)</li>
                <li>Leave balance</li>
                <li>Attendance records</li>
                <li>Work hours logs</li>
              </ul>
              <span className="block mt-2 text-destructive font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                if (employeeToDelete) {
                  setIsDeleting(true);
                  await deleteEmployee(employeeToDelete.id);
                  setIsDeleting(false);
                  setShowDeleteDialog(false);
                  setEmployeeToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Employee'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
