import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Search, ExternalLink, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useParcels, useUpdateParcel, useDeleteParcel, getSignedParcelUrl, Parcel } from '@/hooks/useParcels';
import { PARCEL_STATUSES, getCourierTrackingUrl } from '@/lib/couriers';
import { AddParcelDialog } from '@/components/parcels/AddParcelDialog';

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_transit: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  delivered: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  returned: 'bg-destructive/15 text-destructive',
};

function ParcelPhoto({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (path) getSignedParcelUrl(path).then(setUrl); }, [path]);
  if (!path) return <span className="text-muted-foreground text-xs">—</span>;
  if (!url) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="label" className="w-12 h-12 object-cover rounded border border-border hover:opacity-80" />
    </a>
  );
}

function ParcelTable({ parcels, isLoading, search }: { parcels: Parcel[]; isLoading: boolean; search: string }) {
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
                <TableCell><ParcelPhoto path={p.photo_url} /></TableCell>
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
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm('Delete this parcel?')) del.mutate(p.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
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
  const { data: parcels = [], isLoading } = useParcels();

  if (authLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const samples = parcels.filter((p) => p.is_sample);

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
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search tracking, courier, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All ({parcels.length})</TabsTrigger>
                <TabsTrigger value="samples">Sample Dispatches ({samples.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <ParcelTable parcels={parcels} isLoading={isLoading} search={search} />
              </TabsContent>
              <TabsContent value="samples" className="mt-4">
                <ParcelTable parcels={samples} isLoading={isLoading} search={search} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <AddParcelDialog open={addOpen} onOpenChange={setAddOpen} />
    </DashboardLayout>
  );
}
