import { useMemo } from 'react';

interface OTRequest {
  id: string;
  ot_type: string;
  ot_minutes: number;
  status: string;
  date: string;
}

interface AttendanceRecord {
  check_in: string | null;
  check_out: string | null;
  date: string;
}

interface OTCalculationResult {
  autoOTMinutes: number;
  approvedOTMinutes: number;
  pendingOTMinutes: number;
  totalApprovedOTMinutes: number;
  otHourlyRate: number;
  totalOTPayment: number;
  formattedAutoOT: string;
  formattedApprovedOT: string;
  formattedPendingOT: string;
}

const formatMinutes = (mins: number) => {
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours === 0) return `${remainingMins}m`;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
};

export const useOTCalculation = (
  baseSalary: number = 14000,
  workingHours: number = 8.5,
  otMultiplier: number = 1.5,
  attendance: AttendanceRecord | null,
  otRequests: OTRequest[]
): OTCalculationResult => {
  return useMemo(() => {
    const otHourlyRate = (baseSalary / 30 / workingHours) * otMultiplier;

    // Auto 30-min OT is persisted into ot_requests on checkout, so it's already
    // included in approvedOTMinutes below. Do NOT re-derive it here or it double-counts.
    const autoOTMinutes = otRequests
      .filter(req => req.ot_type === 'auto_30min' && req.status === 'approved')
      .reduce((sum, req) => sum + req.ot_minutes, 0);

    const approvedOTMinutes = otRequests
      .filter(req => req.status === 'approved')
      .reduce((sum, req) => sum + req.ot_minutes, 0);

    const pendingOTMinutes = otRequests
      .filter(req => req.status === 'pending')
      .reduce((sum, req) => sum + req.ot_minutes, 0);

    const totalApprovedOTMinutes = approvedOTMinutes;
    const totalOTPayment = (totalApprovedOTMinutes / 60) * otHourlyRate;

    return {
      autoOTMinutes,
      approvedOTMinutes,
      pendingOTMinutes,
      totalApprovedOTMinutes,
      otHourlyRate: Math.round(otHourlyRate * 100) / 100,
      totalOTPayment: Math.round(totalOTPayment * 100) / 100,
      formattedAutoOT: formatMinutes(autoOTMinutes),
      formattedApprovedOT: formatMinutes(approvedOTMinutes),
      formattedPendingOT: formatMinutes(pendingOTMinutes),
    };
  }, [baseSalary, workingHours, otMultiplier, attendance, otRequests]);
};

export const useMonthlyOTSummary = (
  baseSalary: number = 14000,
  workingHours: number = 8.5,
  otMultiplier: number = 1.5,
  attendanceHistory: AttendanceRecord[],
  otRequests: OTRequest[]
) => {
  return useMemo(() => {
    const otHourlyRate = (baseSalary / 30 / workingHours) * otMultiplier;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthAttendance = attendanceHistory.filter(a => {
      const date = new Date(a.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const thisMonthOTRequests = otRequests.filter(r => {
      const date = new Date(r.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    let monthlyAutoOTMinutes = 0;
    thisMonthAttendance.forEach(a => {
      if (a.check_out) {
        const checkOutTime = new Date(a.check_out);
        const totalMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes();
        if (totalMinutes >= 18 * 60) {
          monthlyAutoOTMinutes += 30;
        } else if (totalMinutes > 17 * 60 + 30) {
          monthlyAutoOTMinutes += totalMinutes - (17 * 60 + 30);
        }
      }
    });

    const monthlyApprovedOT = thisMonthOTRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + r.ot_minutes, 0);

    const monthlyPendingOT = thisMonthOTRequests
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + r.ot_minutes, 0);

    const totalMonthlyOTMinutes = monthlyAutoOTMinutes + monthlyApprovedOT;
    const totalMonthlyPayment = (totalMonthlyOTMinutes / 60) * otHourlyRate;

    return {
      monthlyAutoOTMinutes,
      monthlyApprovedOT,
      monthlyPendingOT,
      totalMonthlyOTMinutes,
      totalMonthlyPayment: Math.round(totalMonthlyPayment * 100) / 100,
      otHourlyRate: Math.round(otHourlyRate * 100) / 100,
      formattedMonthlyOT: formatMinutes(totalMonthlyOTMinutes),
      formattedPendingOT: formatMinutes(monthlyPendingOT),
      daysWorked: thisMonthAttendance.length,
    };
  }, [baseSalary, workingHours, otMultiplier, attendanceHistory, otRequests]);
};
