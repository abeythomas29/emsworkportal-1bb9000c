import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Factory, Package, Boxes, PackagePlus } from 'lucide-react';
import { LogProductionDialog } from '@/components/production/LogProductionDialog';
import { CatalogManager } from '@/components/production/CatalogManager';
import { ProductionLogDetailsDialog } from '@/components/production/ProductionLogDetailsDialog';
import { RecordReceiptDialog } from '@/components/production/RecordReceiptDialog';
import {
  useProducts,
  useRawMaterials,
  useProductionLogs,
  useDeleteProductionLog,
  type ProductionLog,
} from '@/hooks/useProduction';
import { useStockReceipts, useDeleteStockReceipt } from '@/hooks/useStockReceipts';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export default function ProductionPage() {
  const { user, role, profile } = useAuth();
  const isAdmin = role === 'admin';
  const isProduction = (user?.departments || []).includes('production');
  const canManageCatalog = isAdmin || isProduction;
  const { data: products = [] } = useProducts();
  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: logs = [], isLoading } = useProductionLogs();
  const delLog = useDeleteProductionLog();
  const { data: receipts = [] } = useStockReceipts();
  const delReceipt = useDeleteStockReceipt();
  const [selectedLog, setSelectedLog] = useState<ProductionLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const canEditSelected = !!selectedLog && (
    isAdmin || (isProduction && selectedLog.user_id === user?.id)
  );

  const openDetails = (log: ProductionLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleEdit = () => {
    setDetailsOpen(false);
    setEditOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Factory className="h-7 w-7 text-primary" />
              Production Portal
            </h1>
            <p className="text-muted-foreground">Track daily production output and raw material consumption.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageCatalog && <RecordReceiptDialog />}
            <LogProductionDialog />
          </div>
        </div>

        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs">Production Log</TabsTrigger>
            <TabsTrigger value="receipts">Stock Receipts</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            {canManageCatalog && <TabsTrigger value="catalog">Manage Catalog</TabsTrigger>}
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Recent Production</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Logged By</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Output</TableHead>
                      <TableHead>Materials Used</TableHead>
                      <TableHead>Notes</TableHead>
                      {isAdmin && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No production logs yet. Click "Log Production" to add one.</TableCell></TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openDetails(log)}
                        >
                          <TableCell>{format(new Date(log.date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{log.logger?.full_name}</TableCell>
                          <TableCell className="font-medium">{log.product?.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {Number(log.quantity_produced).toFixed(2)} {log.product?.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(log.materials || []).map((m) => (
                                <Badge key={m.id} variant="outline" className="text-xs">
                                  {m.raw_material?.name}: {Number(m.quantity_consumed).toFixed(2)} {m.raw_material?.unit}
                                </Badge>
                              ))}
                              {(log.products_consumed || []).map((p) => (
                                <Badge key={p.id} variant="secondary" className="text-xs">
                                  {p.product?.name}: {Number(p.quantity_consumed).toFixed(2)} {p.product?.unit}
                                </Badge>
                              ))}
                              {(log.materials || []).length === 0 && (log.products_consumed || []).length === 0 && (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{log.notes || '—'}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  delLog.mutate(log.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Recent Stock Receipts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Received By</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Notes</TableHead>
                      {canManageCatalog && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManageCatalog ? 8 : 7} className="text-center text-muted-foreground">
                          No stock receipts yet. Click "Record Received Stock" to add one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      receipts.map((r) => {
                        const itemName = r.item_type === 'raw_material' ? r.raw_material?.name : r.product?.name;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>{format(new Date(r.received_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{r.receiver?.full_name}</TableCell>
                            <TableCell className="font-medium">{itemName || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {r.item_type === 'raw_material' ? 'Raw Material' : 'Product'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">+{Number(r.quantity).toFixed(2)} {r.unit}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{r.vendor || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</TableCell>
                            {canManageCatalog && (
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => delReceipt.mutate(r.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Products in Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-right font-medium">{Number(p.current_stock).toFixed(2)} {p.unit}</TableCell>
                        </TableRow>
                      ))}
                      {products.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No products</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" />Raw Materials in Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Stock</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {rawMaterials.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell className={`text-right font-medium ${r.current_stock < 0 ? 'text-destructive' : r.current_stock < 10 ? 'text-amber-500' : ''}`}>
                            {Number(r.current_stock).toFixed(2)} {r.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                      {rawMaterials.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No raw materials</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {canManageCatalog && (
            <TabsContent value="catalog">
              <CatalogManager />
            </TabsContent>
          )}
        </Tabs>

        <ProductionLogDetailsDialog
          log={selectedLog}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          canEdit={canEditSelected}
          onEdit={handleEdit}
        />

        <LogProductionDialog
          editLog={selectedLog}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      </div>
    </DashboardLayout>
  );
}
