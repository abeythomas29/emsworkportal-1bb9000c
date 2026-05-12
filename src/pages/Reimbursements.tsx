import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Loader2, Trash2, Pencil, Paperclip, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useReimbursements, getReimbursementScreenshotUrl, type Reimbursement, type ReimbursementStatus } from '@/hooks/useReimbursements';
import { NewReimbursementDialog } from '@/components/reimbursements/NewReimbursementDialog';
import { ManageReimbursementDialog } from '@/components/reimbursements/ManageReimbursementDialog';
import { format } from 'date-fns';

const TABS: Array<{ value: 'all' | 'open' | ReimbursementStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS_VARIANT: Record<ReimbursementStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  approved: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  paid: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function ReimbursementsPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const { reimbursements, isLoading, remove } = useReimbursements();

  const [tab, setTab] = useState<'all' | 'open' | ReimbursementStatus>('open');
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<Reimbursement | null>(null);

  const filtered = useMemo(() => {
    return reimbursements.filter((r) => {
      if (tab === 'open' && (r.status === 'paid' || r.status === 'rejected')) return false;
      if (tab !== 'open' && tab !== 'all' && r.status !== tab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.description.toLowerCase().includes(q) ||
          r.requester_name?.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reimbursements, tab, search]);

  const totals = useMemo(() => {
    const pending = reimbursements.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0);
    const paid = reimbursements.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
    return { pending, paid };
  }, [reimbursements]);

  const openAttachment = async (path: string) => {
    const url = await getReimbursementScreenshotUrl(path);
    if (url) window.open(url, '_blank');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Reimbursements</h1>
              <p className="text-sm text-muted-foreground">Submit expense claims with optional receipts. Admins review and process payment.</p>
            </div>
          </div>
          <NewReimbursementDialog />
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Pending payout</div>
              <div className="text-2xl font-bold mt-1">₹{totals.pending.toLocaleString()}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Paid total</div>
              <div className="text-2xl font-bold mt-1">₹{totals.paid.toLocaleString()}</div>
            </CardContent></Card>
          </div>
        )}

        <Card>
          <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 min-w-0">
              <TabsList className="flex-wrap h-auto">
                {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <Input placeholder="Search description, requester…" value={search} onChange={(e) => setSearch(e.target.value)} className="lg:w-72" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">No reimbursements found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const isOwner = r.user_id === user?.id;
                      const canDelete = isOwner && r.status === 'pending';
                      return (
                        <TableRow key={r.id} className="align-top">
                          <TableCell className="max-w-[280px]">
                            <div className="font-medium line-clamp-2">{r.description}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                              Expense {format(new Date(r.expense_date), 'MMM d, yyyy')}
                            </div>
                            {r.admin_notes && (
                              <div className="text-xs text-muted-foreground mt-1 italic">Admin: {r.admin_notes}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{r.requester_name}</div>
                            {r.requester_department && <div className="text-xs text-muted-foreground capitalize">{r.requester_department}</div>}
                          </TableCell>
                          <TableCell><span className="capitalize text-sm">{r.category.replace('_', ' ')}</span></TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">₹{Number(r.amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {r.screenshot_url ? (
                              <Button variant="ghost" size="sm" onClick={() => openAttachment(r.screenshot_url!)}>
                                <Paperclip className="w-4 h-4 mr-1" /> View
                              </Button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {isAdmin && (
                              <Button variant="ghost" size="sm" onClick={() => setTarget(r)}>
                                <Pencil className="w-4 h-4 mr-1" /> Manage
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(r)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ManageReimbursementDialog request={target} open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }} />
    </DashboardLayout>
  );
}
