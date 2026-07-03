import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Search, Loader2, BookOpen } from 'lucide-react';
import { Party, useDeleteParty, useParties } from '@/hooks/useBilling';
import { PartyDialog } from '@/components/billing/PartyDialog';
import { VendorLedgerDialog } from './VendorLedgerDialog';

export function VendorsPanel() {
  const { data: parties = [], isLoading } = useParties();
  const del = useDeleteParty();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [q, setQ] = useState('');
  const [ledger, setLedger] = useState<Party | null>(null);

  const filtered = parties.filter(
    (p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.gstin || '').toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-semibold">Vendors</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Click any vendor to view their ledger — POs, invoices and outstanding balance.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-64" />
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Vendor
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No vendors yet. Add your first vendor.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setLedger(p)}
                  >
                    <TableCell className="font-medium">
                      <span className="hover:text-primary transition-colors">{p.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.gstin || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.gst_type === 'registered' ? 'default' : 'secondary'}>
                        {p.gst_type === 'registered' ? 'Registered' : 'Unregistered'}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.billing_state || '—'}</TableCell>
                    <TableCell>{p.phone || '—'}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => setLedger(p)} title="View ledger" aria-label={`View ledger for ${p.name}`}>
                        <BookOpen className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }} aria-label={`Edit ${p.name}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <PartyDialog open={dialogOpen} onOpenChange={setDialogOpen} party={editing} />
      <VendorLedgerDialog vendor={ledger} open={!!ledger} onOpenChange={(o) => !o && setLedger(null)} />
    </Card>
  );
}
