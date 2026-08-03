import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBillingDocuments } from '@/hooks/useBilling';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

const daysOld = (d: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

export function OpenQuotationsWidget() {
  const { data: docs = [], isLoading } = useBillingDocuments();

  const open = docs
    .filter((d) => (d.doc_type === 'estimate' || d.doc_type === 'proforma') && !d.converted_to_id)
    .sort((a, b) => (a.doc_date < b.doc_date ? 1 : -1));

  const totalValue = open.reduce((s, d) => s + (Number(d.total) || 0), 0);
  const recent = open.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Open Quotations</CardTitle>
              <p className="text-xs text-muted-foreground">
                {open.length} pending · {formatCurrency(totalValue)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No open estimates or proforma invoices.
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((d) => {
              const party = (d.party_snapshot as { name?: string } | null)?.name || 'Unnamed party';
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-md border bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{party}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {d.doc_type === 'estimate' ? 'Estimate' : 'Proforma'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.doc_number || 'Draft'} · {formatDate(d.doc_date)} · {daysOld(d.doc_date)}d old
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {formatCurrency(Number(d.total) || 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <Link to="/sales" className="block mt-4">
          <Button variant="ghost" className="w-full justify-between text-primary">
            View all quotations
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
