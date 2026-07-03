import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, User, Package, Boxes, FileText, Clock, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import type { ProductionLog } from '@/hooks/useProduction';

interface Props {
  log: ProductionLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  onEdit?: () => void;
}

export function ProductionLogDetailsDialog({ log, open, onOpenChange, canEdit, onEdit }: Props) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Production Log Details</DialogTitle>
          <DialogDescription>
            Full experiment record including raw materials and notes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date">
                {format(new Date(log.date), 'EEEE, dd MMM yyyy')}
              </InfoRow>
              <InfoRow icon={<User className="h-4 w-4" />} label="Logged By">
                {log.logger?.full_name || 'Unknown'}
              </InfoRow>
              <InfoRow icon={<Package className="h-4 w-4" />} label="Product">
                <span className="font-medium">{log.product?.name}</span>
              </InfoRow>
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Logged At">
                {format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a')}
              </InfoRow>
            </div>

            <Separator />

            {/* Output */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Quantity Produced</p>
              <Badge variant="secondary" className="text-base px-3 py-1">
                {Number(log.quantity_produced).toFixed(2)} {log.product?.unit}
              </Badge>
            </div>

            <Separator />

            {/* Materials */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Raw Materials Consumed ({(log.materials || []).length})
                </p>
              </div>
              {(log.materials || []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No materials recorded.</p>
              ) : (
                <div className="space-y-2">
                  {(log.materials || []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{m.raw_material?.name}</span>
                      <Badge variant="outline">
                        {Number(m.quantity_consumed).toFixed(2)} {m.raw_material?.unit}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(log.products_consumed || []).length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Finished Products Used ({(log.products_consumed || []).length})
                    </p>
                  </div>
                  <div className="space-y-2">
                    {(log.products_consumed || []).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <span className="text-sm font-medium">{p.product?.name}</span>
                        <Badge variant="outline">
                          {Number(p.quantity_consumed).toFixed(2)} {p.product?.unit}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Notes */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Notes / Observations</p>
              </div>
              {log.notes ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                  {log.notes}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No notes provided.</p>
              )}
            </div>
          </div>
        </ScrollArea>
        {canEdit && onEdit && (
          <DialogFooter>
            <Button onClick={onEdit} variant="outline">
              <Pencil className="mr-2 h-4 w-4" />Edit Log
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
