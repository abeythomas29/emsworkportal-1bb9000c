export type UserRole = 'admin' | 'manager' | 'employee';

export type EmployeeType = 'online' | 'offline';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  employee_id: string | null;
  department: string | null;
  additional_departments: string[] | null;
  employee_type: EmployeeType;
  joining_date: string | null;
  birthday: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  employeeType: EmployeeType;
  department: string;
  /** All departments the user belongs to (lowercase), including primary + additional. */
  departments: string[];
  employeeId: string;
  joiningDate: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LeaveBalance {
  casualLeave: number;
  sickLeave: number;
  earnedLeave: number;
  lwp: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'lwp' | 'holiday' | 'weekend';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  total_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LeaveType = 'casual' | 'sick' | 'earned' | 'lwp';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

export interface WorkLog {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  task_description: string;
  status: 'submitted' | 'pending_review' | 'approved' | 'flagged';
}
