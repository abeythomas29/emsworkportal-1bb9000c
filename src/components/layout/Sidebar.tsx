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
  ShoppingBag,
  Receipt,
  Package,
  FlaskConical,
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
    icon: <ShoppingBag size={20} />,
    label: 'Purchases',
    path: '/purchases',
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
    icon: <FlaskConical size={20} />,
    label: 'Research',
    path: '/research',
    roles: ['admin', 'manager', 'employee'],
    departments: ['research'],
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
      const userDepts = user?.departments || [];
      if (!userDepts.some((d) => item.departments!.includes(d))) return false;
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
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        aria-controls="app-sidebar"
        className="fixed top-3 left-3 z-50 lg:hidden bg-card/90 backdrop-blur-md border border-border shadow-sm h-11 w-11"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </Button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        aria-label="Primary navigation"
        className={cn(
          'fixed left-0 top-0 z-40 h-dvh w-64 bg-sidebar flex flex-col transition-transform duration-300 ease-out',
          'border-r border-sidebar-border/60 shadow-lg lg:shadow-none',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border/60 hover:bg-sidebar-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset"
        >
          <div className="p-1.5 rounded-lg bg-sidebar-accent/40 ring-1 ring-sidebar-border/60">
            <img src={emsLogo} alt="EMS" className="h-8 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-sidebar-foreground leading-tight truncate">
              Esoteric Minerals
            </p>
            <p className="text-[11px] text-sidebar-foreground/55 uppercase tracking-wider">
              Work Portal
            </p>
          </div>
        </Link>

        {/* Navigation */}
        <nav
          className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
          aria-label="Main navigation"
        >
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={cn('nav-item', isActive && 'nav-item-active')}
              >
                <span className="shrink-0" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="border-t border-sidebar-border/60 p-3">
          <div className="flex items-center gap-3 mb-2 px-2 py-2 rounded-lg bg-sidebar-accent/30">
            <div
              className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center text-sidebar-primary-foreground font-semibold text-sm shrink-0"
              aria-hidden="true"
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] text-sidebar-foreground/55 capitalize">
                {role || 'Employee'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="nav-item w-full hover:bg-destructive/15 hover:text-destructive"
            aria-label="Sign out"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

