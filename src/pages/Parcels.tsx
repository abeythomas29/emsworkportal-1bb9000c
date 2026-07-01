import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Package, Plus, Search, ExternalLink, Loader2, Trash2, Image as ImageIcon, Pencil, CalendarIcon, X, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { EditParcelDialog } from '@/components/parcels/EditParcelDialog';
import { NotifyRecipientDialog } from '@/components/parcels/NotifyRecipientDialog';
import { useParcels, useUpdateParcel, useDeleteParcel, getSignedParcelUrl, Parcel } from '@/hooks/useParcels';
import { PARCEL_STATUSES, getCourierTrackingUrl } from '@/lib/couriers';
import { AddParcelDialog } from '@/components/parcels/AddParcelDialog';
import type { DateRange } from 'react-day-picker';

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_transit: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  delivered: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  returned: 'bg-destructive/15 text-destructive',
};

function ParcelPhoto({ path, onNotify }: { path: string | null; onNotify: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (path) getSignedParcelUrl(path).then(setUrl); }, [path]);
  const badge = (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNotify(); }}
      title="Notify recipient on WhatsApp"
      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow ring-2 ring-background"
    >
      <MessageCircle className="w-3 h-3" />
    </button>
  );
  if (!path) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={onNotify}
          className="w-12 h-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
          title="No photo — notify recipient"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        {badge}
      </div>
    );
  }
  if (!url) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  return (
    <div className="relative inline-block">
      <button type="button" onClick={onNotify} className="block">
        <img src={url} alt="label" className="w-12 h-12 object-cover rounded border border-border hover:opacity-80" />
      </button>
      {badge}
    </div>
  );
}

function ParcelTable({ parcels, isLoading, search, onEdit, onNotify }: { parcels: Parcel[]; isLoading: boolean; search: string; onEdit: (p: Parcel) => void; onNotify: (p: Parcel) => void }) {
  const { role, user } = useAuth();
  const update = useUpdateParcel();
  const del = useDeleteParcel();
  const filtered = parcels.filter((p) =>
    !search ||
    p.tracking_id.toLowerCase().includes(search.toLowerCase()) ||
    p.courier.toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (filtered.length === 0) return (
    <div className="text-center py-12">
      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
      <p className="text-muted-foreground">No parcels yet.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Photo</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Courier</TableHead>
            <TableHead>Tracking ID</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => {
            const canEdit = role === 'admin' || p.user_id === user?.id;
            const trackUrl = p.courier_tracking_url || getCourierTrackingUrl(p.courier, p.tracking_id);
            return (
              <TableRow key={p.id}>
                <TableCell><ParcelPhoto path={p.photo_url} onNotify={() => onNotify(p)} /></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{new Date(p.dispatched_date).toLocaleDateString('en-GB')}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {p.courier}
                    {p.is_sample && <Badge variant="outline" className="ml-1 text-xs">Sample</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.tracking_id}</TableCell>
                <TableCell className="max-w-[160px] truncate" title={p.client_name || ''}>{p.client_name || '—'}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <Select value={p.status} onValueChange={(v) => update.mutate({ id: p.id, status: v })}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PARCEL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusColors[p.status] || ''}>{p.status.replace('_', ' ')}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="outline">
                      <a href={trackUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3 mr-1" />Track</a>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onNotify(p)} title="Notify recipient on WhatsApp">
                      <MessageCircle className="w-4 h-4 text-emerald-500" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => onEdit(p)} title="Edit parcel">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm('Delete this parcel?')) del.mutate(p.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ParcelsPage() {
  const { isLoading: authLoading, user } = useAuth();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Parcel | null>(null);
  const [notifying, setNotifying] = useState<Parcel | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { data: parcels = [], isLoading } = useParcels();

  if (authLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const dateFiltered = useMemo(() => {
    if (!dateRange?.from) return parcels;
    const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
    const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
    to.setHours(23, 59, 59, 999);
    return parcels.filter((p) => {
      const d = new Date(p.dispatched_date);
      return d >= from && d <= to;
    });
  }, [parcels, dateRange]);

  const samples = dateFiltered.filter((p) => p.is_sample);

  const dateLabel = dateRange?.from
    ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
      ? `${format(dateRange.from, 'dd MMM')} – ${format(dateRange.to, 'dd MMM yyyy')}`
      : format(dateRange.from, 'dd MMM yyyy')
    : 'Filter by date';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-8 h-8 text-primary" />
              Parcel Tracking
            </h1>
            <p className="text-muted-foreground mt-1">
              Snap a label, let AI read the tracking ID & courier, then track and tag client samples.
            </p>
          </div>
          <Button size="lg" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Parcel
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-lg font-semibold">Shipments</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('justify-start text-left font-normal', !dateRange?.from && 'text-muted-foreground')}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {dateLabel}
                    {dateRange?.from && (
                      <X
                        className="w-3 h-3 ml-2 opacity-60 hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDateRange(undefined); }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search tracking, courier, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All ({dateFiltered.length})</TabsTrigger>
                <TabsTrigger value="samples">Sample Dispatches ({samples.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <ParcelTable parcels={dateFiltered} isLoading={isLoading} search={search} onEdit={setEditing} onNotify={setNotifying} />
              </TabsContent>
              <TabsContent value="samples" className="mt-4">
                <ParcelTable parcels={samples} isLoading={isLoading} search={search} onEdit={setEditing} onNotify={setNotifying} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <AddParcelDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditParcelDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} parcel={editing} />
      <NotifyRecipientDialog open={!!notifying} onOpenChange={(o) => !o && setNotifying(null)} parcel={notifying} />
    </DashboardLayout>
  );
}
