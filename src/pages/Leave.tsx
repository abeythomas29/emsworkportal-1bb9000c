import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Plus, Clock, History, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLeave } from '@/hooks/useLeave';

export default function LeavePage() {
  const { leaveBalance, leaveRequests, isLoading, applyLeave, cancelLeave } = useLeave();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    reason: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.leaveType || !formData.startDate || !formData.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    const { error } = await applyLeave(formData);
    setIsSubmitting(false);

    if (!error) {
      setIsDialogOpen(false);
      setFormData({
        leaveType: '',
        startDate: '',
        endDate: '',
        isHalfDay: false,
        reason: '',
      });
    }
  };

  const leaveBalances = [
    { 
      type: 'casual', 
      label: 'Casual Leave', 
      remaining: leaveBalance?.casual_leave ?? 12, 
      total: 12, 
      color: 'bg-info' 
    },
    { 
      type: 'earned', 
      label: 'Earned Leave', 
      remaining: leaveBalance?.earned_leave ?? 0, 
      total: 45, 
      color: 'bg-success' 
    },
    { 
      type: 'lwp', 
      label: 'LWP Taken', 
      remaining: 0, 
      total: leaveBalance?.lwp_taken ?? 0, 
      color: 'bg-destructive' 
    },
  ];

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
            <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
            <p className="text-muted-foreground">Apply for leave and track your balance</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
                <DialogDescription>
                  Submit your leave request for admin approval.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select
                    value={formData.leaveType}
                    onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">
                        Casual Leave ({leaveBalance?.casual_leave ?? 12} remaining)
                      </SelectItem>
                      <SelectItem value="earned">
                        Earned Leave ({leaveBalance?.earned_leave ?? 0} remaining)
                      </SelectItem>
                      <SelectItem value="lwp">Leave Without Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">From Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">To Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      min={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
                {formData.startDate && new Date(formData.startDate) < new Date(new Date().toDateString()) && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    This is a back-dated leave request
                  </p>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="halfDay"
                    checked={formData.isHalfDay}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, isHalfDay: checked as boolean })
                    }
                  />
                  <Label htmlFor="halfDay" className="text-sm font-normal cursor-pointer">
                    Half Day Leave
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Provide a reason for your leave..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit Application
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Leave Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {leaveBalances.map((balance) => (
            <Card key={balance.type} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${balance.color}`} />
              <CardContent className="pt-6 pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{balance.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {balance.type === 'lwp' ? balance.total : balance.remaining}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {balance.type === 'lwp' ? 'days taken' : 'days remaining'}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${balance.color}/10`}>
                    <Calendar className={`w-5 h-5 ${balance.color.replace('bg-', 'text-')}`} />
                  </div>
                </div>
                {balance.type !== 'lwp' && (
                  <>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${balance.color} transition-all duration-500`}
                        style={{ width: `${(balance.remaining / balance.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Used: {balance.total - balance.remaining}</span>
                      <span>Total: {balance.total}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leave History */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg font-semibold">Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            {leaveRequests.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No leave requests yet</p>
                <p className="text-sm text-muted-foreground">Apply for leave to see your history here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leaveRequests.map((leave) => {
                  const isBackDated = new Date(leave.start_date) < new Date(leave.created_at.split('T')[0]);
                  return (
                    <div
                      key={leave.id}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-muted/50 gap-4 ${isBackDated ? 'border-l-4 border-warning' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{getLeaveTypeLabel(leave.leave_type)}</p>
                            {isBackDated && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                                Back-dated
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(leave.start_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                            {leave.end_date !== leave.start_date && (
                              <>
                                {' - '}
                                {new Date(leave.end_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </>
                            )}
                            {' • '}{leave.days} day{Number(leave.days) !== 1 ? 's' : ''}
                            {leave.is_half_day && ' (Half Day)'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{leave.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 md:flex-col md:items-end">
                        <StatusBadge status={leave.status} />
                        {leave.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 gap-1"
                            onClick={() => cancelLeave(leave.id)}
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Applied: {new Date(leave.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
