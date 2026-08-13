import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquarePlus } from 'lucide-react';
import { useCreateResearchMessage, useResearchSeries } from '@/hooks/useResearch';

export function ResearchMessageDialog() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [seriesId, setSeriesId] = useState<string>('none');
  const create = useCreateResearchMessage();
  const { data: series = [] } = useResearchSeries();

  const submit = async () => {
    if (!content.trim()) return;
    await create.mutateAsync({
      content: content.trim(),
      message_date: date,
      series_id: seriesId === 'none' ? null : seriesId,
      source: 'whatsapp'
    });
    setContent('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquarePlus className="w-4 h-4 mr-2" /> Import Group Messages
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste Group Messages (WhatsApp)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste the chat transcript from your team group here. This will be linked to research tests on this date to provide context.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date of Messages</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Link to Series (optional)</Label>
              <Select value={seriesId} onValueChange={setSeriesId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select series" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— General —</SelectItem>
                  {series.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Chat Transcript</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="[09:15] Abey: For today's trial, use 250ml TiCl4 instead of 200..."
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!content.trim() || create.isPending}>Save Messages</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
