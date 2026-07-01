import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Parcel, useUpdateParcel, getSignedParcelUrl } from '@/hooks/useParcels';
import { getCourierTrackingUrl } from '@/lib/couriers';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parcel: Parcel | null;
}

export function normalizePhoneForWa(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildParcelMessage(parcel: { courier: string; tracking_id: string; courier_tracking_url: string | null }) {
  const url = parcel.courier_tracking_url || getCourierTrackingUrl(parcel.courier, parcel.tracking_id);
  return `Greetings from EMS!\n\nYour parcel has been dispatched via ${parcel.courier}.\n\nTracking ID: ${parcel.tracking_id}\n\nYou can track your parcel here: ${url}`;
}

export function NotifyRecipientDialog({ open, onOpenChange, parcel }: Props) {
  const update = useUpdateParcel();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (parcel) {
      setName(parcel.client_name || '');
      setPhone(parcel.client_phone || '');
      setPhotoUrl(null);
      if (parcel.photo_url) getSignedParcelUrl(parcel.photo_url).then(setPhotoUrl);
    }
  }, [parcel]);

  if (!parcel) return null;

  const message = buildParcelMessage(parcel);
  const waNumber = normalizePhoneForWa(phone);

  const onSend = async () => {
    if (!waNumber) { toast.error('WhatsApp number required'); return; }
    setSending(true);
    const nameChanged = (name.trim() || null) !== (parcel.client_name || null);
    const phoneChanged = (phone.trim() || null) !== (parcel.client_phone || null);
    try {
      if (nameChanged || phoneChanged) {
        await update.mutateAsync({
          id: parcel.id,
          client_name: name.trim() || null,
          client_phone: phone.trim() || null,
        });
      }
      const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      onOpenChange(false);
    } catch (e) {
      // update hook already toasts on error
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-500" /> Notify Recipient
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {photoUrl && (
            <img src={photoUrl} alt="Parcel" className="w-full max-h-48 object-contain rounded border border-border" />
          )}
          <div>
            <Label>Recipient Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>WhatsApp Number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit number (India) or full international"
              inputMode="tel"
            />
            {waNumber && (
              <p className="text-xs text-muted-foreground mt-1">Will send to: +{waNumber}</p>
            )}
          </div>
          <div>
            <Label>Message Preview</Label>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap font-mono">
              {message}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSend} disabled={sending || !waNumber} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            Save & Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
