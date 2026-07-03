import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  useFlowRateCalibrations,
  useCreateCalibration,
  useDeleteCalibration,
  fitPowerLaw,
} from '@/hooks/useFlowRateCalibrations';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/contexts/AuthContext';
import { Droplets, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';

export function FlowRateCalculator() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const { data: points = [], isLoading } = useFlowRateCalibrations();
  const { employees } = useEmployees();
  const create = useCreateCalibration();
  const del = useDeleteCalibration();

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.full_name || e.email));
    return m;
  }, [employees]);

  // Log form
  const [micaName, setMicaName] = useState('');
  const [logD90, setLogD90] = useState('');
  const [logWeight, setLogWeight] = useState('');
  const [logFlow, setLogFlow] = useState('');
  const [notes, setNotes] = useState('');

  const submitLog = async () => {
    const d = parseFloat(logD90);
    const w = parseFloat(logWeight);
    const f = parseFloat(logFlow);
    if (!(d > 0) || !(w > 0) || !(f > 0)) return;
    await create.mutateAsync({
      mica_name: micaName.trim() || null,
      d90_microns: d,
      weight_g: w,
      flow_rate_ml_min: f,
      notes: notes.trim() || null,
    });
    setMicaName(''); setLogD90(''); setLogWeight(''); setLogFlow(''); setNotes('');
  };

  // Predict form
  const [predD90, setPredD90] = useState('');
  const [predWeight, setPredWeight] = useState('');

  const fit = useMemo(() => fitPowerLaw(points), [points]);
  const prediction = useMemo(() => {
    const d = parseFloat(predD90);
    const w = parseFloat(predWeight);
    if (!fit || !(d > 0) || !(w > 0)) return null;
    return w * fit.a * Math.pow(d, fit.b);
  }, [fit, predD90, predWeight]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Log panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Save className="w-4 h-4 text-primary" /> Log a Calibration Point
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Mica name / grade (optional)</Label>
              <Input value={micaName} onChange={(e) => setMicaName(e.target.value)} placeholder="e.g. M-200" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>D90 (µm)</Label>
                <Input type="number" step="any" value={logD90} onChange={(e) => setLogD90(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Weight (g)</Label>
                <Input type="number" step="any" value={logWeight} onChange={(e) => setLogWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Flow rate (ml/min)</Label>
                <Input type="number" step="any" value={logFlow} onChange={(e) => setLogFlow(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any observations…" />
            </div>
            <Button
              onClick={submitLog}
              disabled={create.isPending || !(parseFloat(logD90) > 0) || !(parseFloat(logWeight) > 0) || !(parseFloat(logFlow) > 0)}
              className="w-full"
            >
              Save Calibration Point
            </Button>
          </CardContent>
        </Card>

        {/* Predict panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="w-4 h-4 text-primary" /> Calculate for a New Sample
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>D90 (µm)</Label>
                <Input type="number" step="any" value={predD90} onChange={(e) => setPredD90(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Weight (g)</Label>
                <Input type="number" step="any" value={predWeight} onChange={(e) => setPredWeight(e.target.value)} />
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-4 min-h-[110px] flex flex-col justify-center">
              {!fit ? (
                <p className="text-sm text-muted-foreground text-center">
                  Log at least 2 calibration points to enable predictions.
                </p>
              ) : prediction == null ? (
                <p className="text-sm text-muted-foreground text-center">
                  Enter D90 and weight to see the predicted flow rate.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Predicted flow rate</p>
                  <p className="text-3xl font-bold text-primary">
                    {prediction.toFixed(2)} <span className="text-base font-normal text-muted-foreground">ml/min</span>
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="outline">R² = {fit.r2.toFixed(3)}</Badge>
                    <Badge variant="outline">{fit.n} calibration point{fit.n === 1 ? '' : 's'}</Badge>
                    <Badge variant="secondary">flow = w · {fit.a.toExponential(2)} · D90^{fit.b.toFixed(2)}</Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logged Calibration Points ({points.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : points.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No calibration points yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mica</TableHead>
                  <TableHead className="text-right">D90 (µm)</TableHead>
                  <TableHead className="text-right">Weight (g)</TableHead>
                  <TableHead className="text-right">Flow (ml/min)</TableHead>
                  <TableHead>Logged by</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => {
                  const canDelete = p.user_id === user?.id || isAdmin;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.mica_name || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">{p.d90_microns}</TableCell>
                      <TableCell className="text-right">{p.weight_g}</TableCell>
                      <TableCell className="text-right">{p.flow_rate_ml_min}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{userMap.get(p.user_id) ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(p.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { if (confirm('Delete this calibration point?')) del.mutate(p.id); }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
