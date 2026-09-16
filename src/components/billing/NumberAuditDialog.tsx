import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useBillingAudit,
  useBillingDocuments,
  useNumberAllocations,
  type BillingDocument,
} from '@/hooks/useBilling';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_LABEL: Record<string, string> = {
  tax_invoice: 'Tax Invoice',
  proforma: 'Proforma Invoice',
  estimate: 'Estimate',
};

const ACTION_LABEL: Record<string, string> = {
  deleted: 'Deleted',
  cancelled: 'Cancelled',
  number_changed: 'Number changed',
};

function seqOf(docNumber: string | null | undefined): number | null {
  if (!docNumber) return null;
  const m = docNumber.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function formatDateTime(v: string) {
  return new Date(v).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NumberAuditDialog({
  open,
  onOpenChange,
  docType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docType: string;
}) {
  const { session } = useAuth();
  const enabled = open && !!session;
  const { data: docs = [] } = useBillingDocuments({ enabled });
  const { data: audit = [] } = useBillingAudit({ enabled });
  const { data: allocations = [] } = useNumberAllocations({ enabled });

  const years = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => { if (d.financial_year) set.add(d.financial_year); });
    return Array.from(set).sort().reverse();
  }, [docs]);

  const [fy, setFy] = useState<string>('');
  const activeFy = fy || years[0] || '';

  const scoped = useMemo(
    () => docs.filter((d) => d.doc_type === docType && d.financial_year === activeFy && d.doc_number),
    [docs, docType, activeFy],
  );

  const gaps = useMemo(() => {
    const used = new Map<number, BillingDocument>();
    scoped.forEach((d) => {
      const s = seqOf(d.doc_number);
      if (s != null) used.set(s, d);
    });
    const allocated = new Map<number, string>();
    allocations
      .filter((a) => a.doc_type === docType && a.financial_year === activeFy)
      .forEach((a) => allocated.set(a.seq, a.created_at));

    const maxSeq = Math.max(0, ...used.keys(), ...allocated.keys());
    const out: {
      seq: number;
      reason: string;
      detail: string;
      tone: 'muted' | 'warn' | 'info';
    }[] = [];

    for (let s = 1; s <= maxSeq; s++) {
      if (used.has(s)) continue;
      const entry = audit.find(
        (a) => a.doc_type === docType && a.financial_year === activeFy && seqOf(a.doc_number) === s,
      );
      if (entry) {
        out.push({
          seq: s,
          reason: ACTION_LABEL[entry.action] || entry.action,
          detail: `${formatDateTime(entry.created_at)}${entry.reason ? ` — ${entry.reason}` : ''}`,
          tone: 'warn',
        });
      } else if (allocated.has(s)) {
        out.push({
          seq: s,
          reason: 'Number issued, document never saved',
          detail: `Allocated ${formatDateTime(allocated.get(s)!)}`,
          tone: 'info',
        });
      } else {
        out.push({
          seq: s,
          reason: 'Unaccounted',
          detail: 'Removed before the history log existed — no record available',
          tone: 'muted',
        });
      }
    }
    return out;
  }, [scoped, allocations, audit, docType, activeFy]);

  const scopedAudit = useMemo(
    () => audit.filter((a) => !a.doc_type || a.doc_type === docType),
    [audit, docType],
  );

  const cancelled = useMemo(
    () => docs.filter((d) => d.doc_type === docType && d.status === 'cancelled'),
    [docs, docType],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Number audit — {TYPE_LABEL[docType] || docType}</DialogTitle>
          <DialogDescription>
            Every missing number in the sequence and every deletion, cancellation or number change.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Financial year</span>
          <Select value={activeFy} onValueChange={setFy}>
            <SelectTrigger className="w-36"><SelectValue placeholder="FY" /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto">
            {gaps.length} missing {gaps.length === 1 ? 'number' : 'numbers'}
          </Badge>
        </div>

        <Tabs defaultValue="gaps">
          <TabsList>
            <TabsTrigger value="gaps">Missing numbers</TabsTrigger>
            <TabsTrigger value="history">History log</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="gaps">
            <ScrollArea className="h-[360px] pr-2">
              {gaps.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
                  No gaps — the sequence is continuous.
                </CardContent></Card>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">No.</TableHead>
                      <TableHead className="w-44">Reason</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gaps.map((g) => (
                      <TableRow key={g.seq}>
                        <TableCell className="font-mono font-semibold">{g.seq}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              g.tone === 'warn'
                                ? 'border-destructive/40 text-destructive'
                                : g.tone === 'info'
                                  ? 'border-primary/40 text-primary'
                                  : 'text-muted-foreground'
                            }
                          >
                            {g.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{g.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history">
            <ScrollArea className="h-[360px] pr-2">
              {scopedAudit.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
                  Nothing recorded yet.
                </CardContent></Card>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedAudit.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs whitespace-nowrap">{formatDateTime(a.created_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{a.doc_number || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ACTION_LABEL[a.action] || a.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="cancelled">
            <ScrollArea className="h-[360px] pr-2">
              {cancelled.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
                  No cancelled documents.
                </CardContent></Card>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelled.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs line-through">{d.doc_number || '—'}</TableCell>
                        <TableCell className="text-sm">{d.doc_date}</TableCell>
                        <TableCell className="text-sm">
                          {(d.party_snapshot as { name?: string } | null)?.name || '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{Number(d.total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
