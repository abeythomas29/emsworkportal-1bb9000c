import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import {
  useResearchSeries,
  useResearchTests,
  useDeleteTest,
  type ResearchSeries,
  type ResearchTest,
} from '@/hooks/useResearch';
import { useEmployees } from '@/hooks/useEmployees';
import { NewTestDialog } from '@/components/research/NewTestDialog';
import { NewSeriesDialog } from '@/components/research/NewSeriesDialog';
import { EditSeriesDialog } from '@/components/research/EditSeriesDialog';
import { TestAnalysisDialog } from '@/components/research/TestAnalysisDialog';
import { FeedbackDialog } from '@/components/research/FeedbackDialog';
import { FlowRateCalculator } from '@/components/research/FlowRateCalculator';
import {
  FlaskConical,
  MessageSquarePlus,
  Trash2,
  CheckCircle2,
  Droplets,
  Pencil,
  LineChart,
  Layers,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

export default function ResearchPage() {
  const { user, role } = useAuth();
  const { data: tests = [], isLoading } = useResearchTests();
  const { data: series = [] } = useResearchSeries();
  const { employees } = useEmployees();
  const deleteTest = useDeleteTest();

  const [seriesFilter, setSeriesFilter] = useState<string>('all');
  const [feedbackTest, setFeedbackTest] = useState<ResearchTest | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [editSeries, setEditSeries] = useState<ResearchSeries | null>(null);
  const [editSeriesOpen, setEditSeriesOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const isAdmin = role === 'admin';
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.full_name || e.email));
    return m;
  }, [employees]);
  const seriesMap = useMemo(() => {
    const m = new Map<string, string>();
    series.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [series]);

  const filtered = useMemo(() => {
    if (seriesFilter === 'all') return tests;
    if (seriesFilter === 'none') return tests.filter((t) => !t.series_id);
    return tests.filter((t) => t.series_id === seriesFilter);
  }, [tests, seriesFilter]);

  const mine = filtered.filter((t) => t.user_id === user?.id);
  const others = filtered.filter((t) => t.user_id !== user?.id);

  const selectedTests = useMemo(() => tests.filter((t) => selected.includes(t.id)), [tests, selected]);
  const analysisSeriesName =
    seriesFilter !== 'all' && seriesFilter !== 'none' ? seriesMap.get(seriesFilter) : undefined;

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const openFeedback = (t: ResearchTest) => {
    setFeedbackTest(t);
    setFeedbackOpen(true);
  };

  const openEditSeries = (s: ResearchSeries) => {
    setEditSeries(s);
    setEditSeriesOpen(true);
  };

  const renderCard = (t: ResearchTest) => {
    const canEdit = t.user_id === user?.id || isAdmin;
    const isSelected = selected.includes(t.id);
    return (
      <Card key={t.id} className={isSelected ? 'ring-2 ring-primary' : undefined}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelect(t.id)}
                aria-label={`Select ${t.title || 'test'} for analysis`}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {t.title && <CardTitle className="text-base">{t.title}</CardTitle>}
                  {t.series_id && seriesMap.get(t.series_id) && (
                    <Badge variant="secondary">{seriesMap.get(t.series_id)}</Badge>
                  )}
                  {t.result_recorded_at && (
                    <Badge variant="outline" className="text-success border-success">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Feedback recorded
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(t.test_date), 'dd MMM yyyy')} · {userMap.get(t.user_id) ?? 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => openFeedback(t)}>
                  <MessageSquarePlus className="w-4 h-4 mr-1" />
                  {t.observation || t.next_test_changes ? 'Edit Feedback' : 'Add Feedback'}
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete test"
                  onClick={() => {
                    if (confirm('Delete this test?')) deleteTest.mutate(t.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Instructions</p>
            <p className="text-sm whitespace-pre-wrap font-mono bg-muted/30 rounded p-3">{t.instructions}</p>
          </div>
          {t.observation && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Observation</p>
              <p className="text-sm whitespace-pre-wrap">{t.observation}</p>
            </div>
          )}
          {t.next_test_changes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Changes for Next Test</p>
              <p className="text-sm whitespace-pre-wrap text-primary">{t.next_test_changes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-24">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="w-7 h-7 text-primary" />
              Research Lab
            </h1>
            <p className="text-muted-foreground mt-1">Log tests, capture feedback, and share learnings across the team.</p>
          </div>
          <div className="flex gap-2">
            <NewSeriesDialog />
            <NewTestDialog />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">Filter by series:</span>
          <Select value={seriesFilter} onValueChange={setSeriesFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All series</SelectItem>
              <SelectItem value="none">No series</SelectItem>
              {series.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(
                  filtered.every((t) => selected.includes(t.id)) ? [] : filtered.map((t) => t.id),
                )
              }
            >
              {filtered.every((t) => selected.includes(t.id)) ? 'Clear selection' : 'Select all shown'}
            </Button>
          )}
        </div>

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All Tests ({filtered.length})</TabsTrigger>
            <TabsTrigger value="mine">My Tests ({mine.length})</TabsTrigger>
            <TabsTrigger value="others">Others ({others.length})</TabsTrigger>
            <TabsTrigger value="series">
              <Layers className="w-4 h-4 mr-1" /> Series ({series.length})
            </TabsTrigger>
            <TabsTrigger value="flow-rate">
              <Droplets className="w-4 h-4 mr-1" /> Flow Rate Calculator
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="space-y-4 mt-4">
            {isLoading ? <p className="text-muted-foreground">Loading…</p> :
              filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No tests yet.</p> :
              filtered.map(renderCard)}
          </TabsContent>
          <TabsContent value="mine" className="space-y-4 mt-4">
            {mine.length === 0 ? <p className="text-muted-foreground text-center py-8">You haven't logged any tests yet.</p> : mine.map(renderCard)}
          </TabsContent>
          <TabsContent value="others" className="space-y-4 mt-4">
            {others.length === 0 ? <p className="text-muted-foreground text-center py-8">No tests from others.</p> : others.map(renderCard)}
          </TabsContent>
          <TabsContent value="series" className="mt-4">
            {series.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No series yet. Create one to group related tests.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {series.map((s) => {
                  const count = tests.filter((t) => t.series_id === s.id).length;
                  return (
                    <Card key={s.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-base">{s.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">{count} test{count === 1 ? '' : 's'}</p>
                          </div>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => openEditSeries(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {s.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.description}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSeriesFilter(s.id);
                              setSelected(tests.filter((t) => t.series_id === s.id).map((t) => t.id));
                            }}
                          >
                            Select all tests
                          </Button>
                          <Button
                            size="sm"
                            disabled={count < 2}
                            onClick={() => {
                              setSeriesFilter(s.id);
                              setSelected(tests.filter((t) => t.series_id === s.id).map((t) => t.id));
                              setAnalysisOpen(true);
                            }}
                          >
                            <LineChart className="w-4 h-4 mr-1" /> Analyse series
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="flow-rate" className="mt-4">
            <FlowRateCalculator />
          </TabsContent>
        </Tabs>
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,640px)]">
          <div className="flex items-center justify-between gap-3 rounded-full border bg-card shadow-lg px-4 py-2">
            <span className="text-sm">
              <strong>{selected.length}</strong> test{selected.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={selected.length < 2} onClick={() => setAnalysisOpen(true)}>
                <LineChart className="w-4 h-4 mr-1" /> Analyse
              </Button>
              <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={() => setSelected([])}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <FeedbackDialog test={feedbackTest} open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <EditSeriesDialog
        series={editSeries}
        open={editSeriesOpen}
        onOpenChange={setEditSeriesOpen}
        onDeleted={() => setSeriesFilter('all')}
      />
      <TestAnalysisDialog
        tests={selectedTests}
        seriesName={analysisSeriesName}
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
      />
    </DashboardLayout>
  );
}
