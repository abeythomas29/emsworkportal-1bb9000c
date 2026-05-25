import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Camera, Sparkles, Upload } from 'lucide-react';
import { COURIERS, getCourierTrackingUrl, resolveCourierName } from '@/lib/couriers';
import { extractParcelFromImage, uploadParcelPhoto, useCreateParcel } from '@/hooks/useParcels';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function AddParcelDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const create = useCreateParcel();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [trackingId, setTrackingId] = useState('');
  const [courier, setCourier] = useState<string>('Other');
  const [clientName, setClientName] = useState('');
  const [isSample, setIsSample] = useState(true);
  const [dispatchedDate, setDispatchedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const reset = () => {
    setFile(null); setPreview(null); setTrackingId(''); setCourier('Other');
    setClientName(''); setIsSample(true); setNotes('');
    setDispatchedDate(new Date().toISOString().slice(0, 10));
  };

  const onPickFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onExtract = async () => {
    if (!file) { toast.error('Pick a photo first'); return; }
    setExtracting(true);
    try {
      const res = await extractParcelFromImage(file);
      if (res.tracking_id) setTrackingId(res.tracking_id);
      if (res.courier) {
        setCourier(resolveCourierName(res.courier));
      }
      toast.success(`Detected ${res.courier || 'courier'} (${res.confidence} confidence)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const onSubmit = async () => {
    if (!user) return;
    if (!trackingId.trim()) { toast.error('Tracking ID required'); return; }
    let photoPath: string | null = null;
    try {
      if (file) photoPath = await uploadParcelPhoto(file, user.id);
    } catch (e) {
      toast.error('Photo upload failed');
      return;
    }
    create.mutate(
      {
        tracking_id: trackingId.trim(),
        courier,
        courier_tracking_url: getCourierTrackingUrl(courier, trackingId.trim()),
        photo_url: photoPath,
        client_name: clientName.trim() || null,
        is_sample: isSample,
        dispatched_date: dispatchedDate,
        status: 'pending',
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> Add Parcel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Label Photo (optional, used by AI)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }}
            />
            {preview ? (
              <div className="space-y-2 mt-2">
                <img src={preview} alt="Label preview" className="w-full max-h-48 object-contain rounded border border-border" />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> Change
                  </Button>
                  <Button type="button" size="sm" onClick={onExtract} disabled={extracting}>
                    {extracting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    {extracting ? 'Reading…' : 'Extract with AI'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full mt-2" onClick={() => fileRef.current?.click()}>
                <Camera className="w-4 h-4 mr-2" /> Click / Upload Photo
              </Button>
            )}
          </div>

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
              <Input value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="AWB / Docket no" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dispatched Date</Label>
              <Input type="date" value={dispatchedDate} onChange={(e) => setDispatchedDate(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={isSample} onCheckedChange={setIsSample} id="sample" />
              <Label htmlFor="sample" className="cursor-pointer">Sample dispatch</Label>
            </div>
          </div>

          <div>
            <Label>Client / Recipient Name {isSample && <span className="text-muted-foreground text-xs">(for sample sales list)</span>}</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Optional" />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Parcel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
