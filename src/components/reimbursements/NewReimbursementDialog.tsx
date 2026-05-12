import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Upload } from 'lucide-react';
import { useReimbursements } from '@/hooks/useReimbursements';
import { format } from 'date-fns';

const CATEGORIES = ['travel', 'food', 'office_supplies', 'tools', 'utilities', 'training', 'other'];

export function NewReimbursementDialog() {
  const [open, setOpen] = useState(false);
  const { create, isCreating } = useReimbursements();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setAmount(''); setCategory('other'); setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription(''); setFile(null);
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (!description.trim()) return;
    if (file && file.size > 5 * 1024 * 1024) return;
    await create({
      amount: amt,
      category,
      description: description.trim(),
      expense_date: expenseDate,
      screenshot_file: file,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-1" /> New Reimbursement</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Submit Reimbursement</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={expenseDate} max={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this expense for?" />
          </div>
          <div className="space-y-2">
            <Label>Screenshot / Receipt (optional, max 5MB)</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <Upload className="w-4 h-4 text-primary" />}
            </div>
            {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isCreating || !amount || !description.trim()}>
            {isCreating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
