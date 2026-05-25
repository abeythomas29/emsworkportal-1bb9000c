import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Pages
import LoginPage from "./pages/Login";
import Index from "./pages/Index";
import DashboardPage from "./pages/Dashboard";
import AttendancePage from "./pages/Attendance";
import WorkHoursPage from "./pages/WorkHours";
import LeavePage from "./pages/Leave";
import LeaveRequestsPage from "./pages/LeaveRequests";
import EmployeesPage from "./pages/Employees";
import EmployeeDetailPage from "./pages/EmployeeDetail";
import ReportsPage from "./pages/Reports";
import AttendanceReportPage from "./pages/AttendanceReport";
import PoliciesPage from "./pages/Policies";
import HolidaysPage from "./pages/Holidays";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import CalculatorPage from "./pages/Calculator";
import OvertimePage from "./pages/Overtime";
import SalaryPage from "./pages/Salary";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import ProductionPage from "./pages/Production";
import SalesPage from "./pages/Sales";
import RequestsPage from "./pages/Requests";
import ReimbursementsPage from "./pages/Reimbursements";
import ParcelsPage from "./pages/Parcels";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/work-hours" element={<WorkHoursPage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/leave-requests" element={<LeaveRequestsPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employee/:id" element={<EmployeeDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/attendance-report" element={<AttendanceReportPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/holidays" element={<HolidaysPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/calculator" element={<CalculatorPage />} />
            <Route path="/overtime" element={<OvertimePage />} />
            <Route path="/salary" element={<SalaryPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/production" element={<ProductionPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/reimbursements" element={<ReimbursementsPage />} />
            <Route path="/parcels" element={<ParcelsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
