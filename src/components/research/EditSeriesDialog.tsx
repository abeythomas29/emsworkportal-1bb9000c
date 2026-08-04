import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useDeleteSeries, useUpdateSeries, type ResearchSeries } from '@/hooks/useResearch';
import { Trash2 } from 'lucide-react';

interface Props {
  series: ResearchSeries | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted?: () => void;
}

export function EditSeriesDialog({ series, open, onOpenChange, onDeleted }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useUpdateSeries();
  const remove = useDeleteSeries();

  useEffect(() => {
    if (open && series) {
      setName(series.name);
      setDescription(series.description ?? '');
    }
  }, [open, series]);

  const save = async () => {
    if (!series || !name.trim()) return;
    await update.mutateAsync({ id: series.id, name: name.trim(), description: description.trim() || null });
    onOpenChange(false);
  };

  const doDelete = async () => {
    if (!series) return;
    await remove.mutateAsync(series.id);
    setConfirmOpen(false);
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Series</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="series-name">Series Name</Label>
              <Input id="series-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="series-desc">Description</Label>
              <Textarea id="series-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete series
            </Button>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={save} disabled={!name.trim() || update.isPending}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{series?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The series will be removed. Tests inside it are kept and moved to “No series”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={remove.isPending}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
