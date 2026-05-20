import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface LeaveBalance {
  id: string;
  user_id: string;
  casual_leave: number;
  earned_leave: number;
  lwp_taken: number;
  consecutive_work_days: number;
}

interface EditLeaveBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveBalance: LeaveBalance | null;
  employeeName: string;
  onSuccess: () => void;
}

export function EditLeaveBalanceDialog({
  open,
  onOpenChange,
  leaveBalance,
  employeeName,
  onSuccess,
}: EditLeaveBalanceDialogProps) {
  const [casualLeave, setCasualLeave] = useState(leaveBalance?.casual_leave ?? 22);
  const [earnedLeave, setEarnedLeave] = useState(leaveBalance?.earned_leave ?? 0);
  const [lwpTaken, setLwpTaken] = useState(leaveBalance?.lwp_taken ?? 0);
  const [consecutiveWorkDays, setConsecutiveWorkDays] = useState(leaveBalance?.consecutive_work_days ?? 0);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when leaveBalance changes
  useEffect(() => {
    if (leaveBalance) {
      setCasualLeave(leaveBalance.casual_leave);
      setEarnedLeave(leaveBalance.earned_leave);
      setLwpTaken(leaveBalance.lwp_taken);
      setConsecutiveWorkDays(leaveBalance.consecutive_work_days);
    }
  }, [leaveBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveBalance) return;

    setIsLoading(true);

    const { error } = await supabase
      .from('leave_balances')
      .update({
        casual_leave: casualLeave,
        earned_leave: earnedLeave,
        lwp_taken: lwpTaken,
        consecutive_work_days: consecutiveWorkDays,
      })
      .eq('id', leaveBalance.id);

    setIsLoading(false);

    if (error) {
      console.error('Error updating leave balance:', error);
      toast.error('Failed to update leave balance');
      return;
    }

    toast.success('Leave balance updated successfully');
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Leave Balance</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Update leave balance for {employeeName}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="casual">Casual Leave</Label>
              <Input
                id="casual"
                type="number"
                min="0"
                step="0.5"
                value={casualLeave}
                onChange={(e) => setCasualLeave(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="earned">Earned Leave (Max 45)</Label>
              <Input
                id="earned"
                type="number"
                min="0"
                max="45"
                step="0.5"
                value={earnedLeave}
                onChange={(e) => setEarnedLeave(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lwp">LWP Taken</Label>
              <Input
                id="lwp"
                type="number"
                min="0"
                step="0.5"
                value={lwpTaken}
                onChange={(e) => setLwpTaken(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consecutive">Consecutive Work Days</Label>
              <Input
                id="consecutive"
                type="number"
                min="0"
                value={consecutiveWorkDays}
                onChange={(e) => setConsecutiveWorkDays(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">1 earned leave added every 20 days</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}