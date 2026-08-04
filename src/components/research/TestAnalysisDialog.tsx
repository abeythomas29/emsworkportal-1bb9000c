import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildComparison, parseTestParams, pctDelta } from '@/lib/research/parseTest';
import type { ResearchTest } from '@/hooks/useResearch';
import { format } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';

interface Props {
  tests: ResearchTest[];
  seriesName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TestAnalysisDialog({ tests, seriesName, open, onOpenChange }: Props) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Chronological order so deltas read left → right in time
  const ordered = useMemo(
    () => [...tests].sort((a, b) => a.test_date.localeCompare(b.test_date) || a.created_at.localeCompare(b.created_at)),
    [tests],
  );

  const rows = useMemo(() => buildComparison(ordered.map((t) => t.instructions || '')), [ordered]);
  const changedRows = rows.filter((r) => r.changed);
  const constantRows = rows.filter((r) => !r.changed);

  const runAi = async () => {
    setLoading(true);
    setAnalysis('');
    try {
      const { data, error } = await supabase.functions.invoke('analyze-research-tests', {
        body: {
          seriesName,
          comparison: rows,
          tests: ordered.map((t) => ({
            title: t.title,
            test_date: t.test_date,
            instructions: t.instructions,
            observation: t.observation,
            next_test_changes: t.next_test_changes,
            params: Object.fromEntries(parseTestParams(t.instructions || '').map((p) => [p.label, `${p.value}${p.unit}`])),
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis || 'No analysis returned.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const label = (t: ResearchTest, i: number) => t.title || `Test ${i + 1}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Test Analysis {seriesName ? <span className="text-muted-foreground font-normal">· {seriesName}</span> : null}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {ordered.map((t, i) => (
                <Badge key={t.id} variant="secondary">
                  {label(t, i)} · {format(new Date(t.test_date), 'dd MMM')}
                </Badge>
              ))}
            </div>

            <section>
              <h3 className="text-sm font-semibold mb-2">Parameter changes across tests</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No numeric parameters detected. Write values as “Mica: 100 g”, “TiCl4: 250 ml”, “Flow rate: 3 ml/min” for automatic comparison.
                </p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Parameter</TableHead>
                        {ordered.map((t, i) => (
                          <TableHead key={t.id} className="whitespace-nowrap">
                            {label(t, i)}
                            <span className="block text-xs font-normal text-muted-foreground">
                              {format(new Date(t.test_date), 'dd MMM yy')}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...changedRows, ...constantRows].map((r) => (
                        <TableRow key={r.key} className={r.changed ? '' : 'opacity-60'}>
                          <TableCell className="font-medium">
                            {r.label} {r.unit && <span className="text-xs text-muted-foreground">({r.unit})</span>}
                          </TableCell>
                          {r.values.map((v, i) => {
                            const d = i > 0 ? pctDelta(r.values[i - 1], v) : null;
                            return (
                              <TableCell key={i} className="font-mono text-sm whitespace-nowrap">
                                {v === null ? <span className="text-muted-foreground">—</span> : v}
                                {d !== null && Math.abs(d) > 0.01 && (
                                  <span className={`ml-2 text-xs inline-flex items-center ${d > 0 ? 'text-success' : 'text-destructive'}`}>
                                    {d > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {Math.abs(d).toFixed(1)}%
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Observations</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {ordered.map((t, i) => (
                  <div key={t.id} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {label(t, i)} · {format(new Date(t.test_date), 'dd MMM yyyy')}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{t.observation || 'No observation recorded.'}</p>
                    {t.next_test_changes && (
                      <p className="text-sm whitespace-pre-wrap text-primary mt-2">Next: {t.next_test_changes}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">AI cause &amp; effect analysis</h3>
                <Button size="sm" onClick={runAi} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {analysis ? 'Re-analyse' : 'Analyse'}
                </Button>
              </div>
              {analysis ? (
                <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                  {analysis}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run the analysis to see how each parameter change (mica, SnCl4, TiCl4, flow rate, pH…) affected the final pigment.
                </p>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
