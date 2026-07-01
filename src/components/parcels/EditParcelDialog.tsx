import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Pencil } from 'lucide-react';
import { COURIERS, getCourierTrackingUrl, PARCEL_STATUSES } from '@/lib/couriers';
import { Parcel, useUpdateParcel } from '@/hooks/useParcels';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parcel: Parcel | null;
}

export function EditParcelDialog({ open, onOpenChange, parcel }: Props) {
  const update = useUpdateParcel();
  const [trackingId, setTrackingId] = useState('');
  const [courier, setCourier] = useState('Other');
  const [status, setStatus] = useState<string>('pending');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [isSample, setIsSample] = useState(false);
  const [dispatchedDate, setDispatchedDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (parcel) {
      setTrackingId(parcel.tracking_id);
      setCourier(parcel.courier || 'Other');
      setStatus(parcel.status);
      setClientName(parcel.client_name || '');
      setClientPhone(parcel.client_phone || '');
      setIsSample(parcel.is_sample);
      setDispatchedDate(parcel.dispatched_date);
      setNotes(parcel.notes || '');
    }
  }, [parcel]);

  const onSubmit = () => {
    if (!parcel) return;
    if (!trackingId.trim()) { toast.error('Tracking ID required'); return; }
    update.mutate(
      {
        id: parcel.id,
        tracking_id: trackingId.trim(),
        courier,
        courier_tracking_url: getCourierTrackingUrl(courier, trackingId.trim()),
        status,
        client_name: clientName.trim() || null,
        client_phone: clientPhone.trim() || null,
        is_sample: isSample,
        dispatched_date: dispatchedDate,
        notes: notes.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" /> Edit Parcel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Courier</Label>
              <Select value={courier} onValueChange={setCourier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COURIERS.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tracking ID</Label>
              <Input value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dispatched Date</Label>
              <Input type="date" value={dispatchedDate} onChange={(e) => setDispatchedDate(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARCEL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isSample} onCheckedChange={setIsSample} id="edit-sample" />
            <Label htmlFor="edit-sample" className="cursor-pointer">Sample dispatch</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Client / Recipient Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label>Recipient WhatsApp Number</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Optional" inputMode="tel" />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={update.isPending}>
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
