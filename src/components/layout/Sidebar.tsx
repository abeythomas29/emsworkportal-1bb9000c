import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import emsLogo from '@/assets/ems-logo.png';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  FileText,
  Users,
  Settings,
  LogOut,
  ClipboardList,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Menu,
  X,
  Calculator,
  Timer,
  IndianRupee,
  Factory,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  roles: string[];
  employeeTypes?: string[];
  departments?: string[];
}

const navItems: NavItem[] = [
  {
    icon: <LayoutDashboard size={20} />,
    label: 'Dashboard',
    path: '/dashboard',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <Calendar size={20} />,
    label: 'Attendance',
    path: '/attendance',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <Clock size={20} />,
    label: 'Work Hours',
    path: '/work-hours',
    roles: ['admin', 'manager', 'employee'],
    employeeTypes: ['online'],
  },
  {
    icon: <CalendarCheck size={20} />,
    label: 'Leave Management',
    path: '/leave',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <CalendarDays size={20} />,
    label: 'Holidays',
    path: '/holidays',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <ClipboardList size={20} />,
    label: 'Leave Requests',
    path: '/leave-requests',
    roles: ['admin', 'manager'],
  },
  {
    icon: <Users size={20} />,
    label: 'Employees',
    path: '/employees',
    roles: ['admin', 'manager'],
  },
  {
    icon: <BarChart3 size={20} />,
    label: 'Reports',
    path: '/reports',
    roles: ['admin', 'manager'],
  },
  {
    icon: <FileText size={20} />,
    label: 'Policies',
    path: '/policies',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <Calculator size={20} />,
    label: 'Calculator',
    path: '/calculator',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <Timer size={20} />,
    label: 'Overtime',
    path: '/overtime',
    roles: ['admin', 'manager', 'employee'],
    departments: ['production'],
  },
  {
    icon: <Factory size={20} />,
    label: 'Production',
    path: '/production',
    roles: ['admin', 'manager', 'employee'],
    departments: ['production'],
  },
  {
    icon: <IndianRupee size={20} />,
    label: 'Salary',
    path: '/salary',
    roles: ['admin'],
  },
  {
    icon: <TrendingUp size={20} />,
    label: 'Sales',
    path: '/sales',
    roles: ['admin'],
  },
  {
    icon: <ShoppingCart size={20} />,
    label: 'Purchase Requests',
    path: '/requests',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <Receipt size={20} />,
    label: 'Reimbursements',
    path: '/reimbursements',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <Package size={20} />,
    label: 'Parcels',
    path: '/parcels',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    icon: <Settings size={20} />,
    label: 'Settings',
    path: '/settings',
    roles: ['admin', 'manager', 'employee'],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredItems = navItems.filter((item) => {
    // Check role
    if (!role || !item.roles.includes(role)) return false;
    
    // Check employee type if specified
    if (item.employeeTypes && user?.employeeType) {
      if (!item.employeeTypes.includes(user.employeeType)) return false;
    }
    
    // Check department if specified (admins/managers bypass this)
    if (item.departments && role !== 'admin' && role !== 'manager') {
      if (!user?.department || !item.departments.includes(user.department.toLowerCase())) return false;
    }
    
    // For admins/managers, show work hours even if they're not "online" type
    if (item.path === '/work-hours' && (role === 'admin' || role === 'manager')) {
      return true;
    }
    
    return true;
  });

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </Button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar flex flex-col transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border hover:bg-sidebar-accent/50 transition-colors">
          <img src={emsLogo} alt="EMS Logo" className="h-10 w-auto" />
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'nav-item',
                  isActive && 'nav-item-active'
                )}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-semibold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">
                {role || 'Employee'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="nav-item w-full hover:bg-destructive/20 hover:text-destructive"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
