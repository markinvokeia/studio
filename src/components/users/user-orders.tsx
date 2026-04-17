'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResizableSheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { API_ROUTES } from '@/constants/routes';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Order, OrderItem, Quote, User as UserType, UserDetailMode } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Eye, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataCard } from '@/components/ui/data-card';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, any> = { completed: 'success', pending: 'info', processing: 'default', cancelled: 'destructive' };

const STATUS_KEY_MAP: Record<string, string> = {
  completed: 'completed',
  pending: 'pending',
  processing: 'processing',
  'in progress': 'processing',
  in_progress: 'processing',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

// ── Columns ───────────────────────────────────────────────────────────────────
const getColumns = (t: (key: string) => string): ColumnDef<Order>[] => [
  {
    id: 'select',
    header: () => null,
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Seleccionar fila"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('OrderColumns.docNo')} />,
    cell: ({ row }) => {
      const docNo = row.getValue('doc_no') as string;
      return <div className="font-medium">{docNo || 'N/A'}</div>;
    },
  },
  {
    accessorKey: 'quote_doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteDocNo')} />,
    cell: ({ row }) => {
      const quoteDocNo = row.getValue('quote_doc_no') as string;
      return <div className="font-medium">{quoteDocNo || '-'}</div>;
    },
  },
  {
    accessorKey: 'currency',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />,
    cell: ({ row }) => {
      const currency = row.getValue('currency') as string;
      return <div className="font-medium">{currency || 'USD'}</div>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('OrderColumns.createdAt')} />,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const statusLower = status.toLowerCase().trim();
      const variant = (STATUS_BADGE[statusLower] ?? 'default') as any;
      const translationKey = STATUS_KEY_MAP[statusLower] || statusLower;
      return (
        <Badge variant={variant} className="capitalize">
          {t(`OrdersPage.status.${translationKey}`)}
        </Badge>
      );
    },
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getOrdersForUser(userId: string): Promise<Order[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_ORDERS, { user_id: userId });
    const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
    return ordersData.map((apiOrder: any) => ({
      id: apiOrder.id ? String(apiOrder.id) : 'N/A',
      doc_no: apiOrder.doc_no || 'N/A',
      user_id: apiOrder.user_id,
      user_name: apiOrder.user_name || '',
      quote_id: apiOrder.quote_id,
      quote_doc_no: apiOrder.quote_doc_no || '',
      status: apiOrder.status,
      createdAt: apiOrder.created_at,
      updatedAt: apiOrder.updated_at,
      currency: apiOrder.currency || 'USD',
      notes: apiOrder.notes || '',
    }));
  } catch (error) {
    console.error("Failed to fetch user orders:", error);
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface UserOrdersProps {
  userId: string;
  selectedQuote?: Quote | null;
  patient?: UserType;
  mode?: UserDetailMode;
  onDataChange?: () => void;
  refreshTrigger?: number;
}

export function UserOrders({ userId, selectedQuote, patient, mode = 'sales', onDataChange, refreshTrigger }: UserOrdersProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const isViewportNarrow = useViewportNarrow();
  const isSales = mode === 'sales';
  const canInvoiceFromOrder = hasPermission(
    isSales
      ? SALES_PERMISSIONS.ORDERS_INVOICE_FROM_ORDER
      : PURCHASES_PERMISSIONS.ORDERS_CONVERT_INVOICE
  );

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Sync selectedOrder when orders array changes
  React.useEffect(() => {
    if (selectedOrder && orders.length > 0) {
      const updatedOrder = orders.find(o => o.id === selectedOrder.id);
      if (updatedOrder) {
        const hasChanges =
          updatedOrder.status !== selectedOrder.status ||
          updatedOrder.is_invoiced !== selectedOrder.is_invoiced;
        if (hasChanges) {
          setSelectedOrder(updatedOrder);
        }
      } else {
        setSelectedOrder(null);
        setRowSelection({});
      }
    }
  }, [orders]);

  // Items
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = React.useState(false);

  // Invoice dialog state
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
  const [invoiceDate, setInvoiceDate] = React.useState<Date | undefined>(new Date());
  const [invoiceNotes, setInvoiceNotes] = React.useState('');
  const [invoiceSubmissionError, setInvoiceSubmissionError] = React.useState<string | null>(null);

  const columns = React.useMemo(() => getColumns(t), [t]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadOrders = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const fetchedOrders = await getOrdersForUser(userId);
    let filtered = fetchedOrders;
    if (selectedQuote) {
      filtered = fetchedOrders.filter(order => order.quote_id === selectedQuote.id);
    }
    setOrders(filtered);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId, selectedQuote]);

  const loadItems = React.useCallback(async (orderId: string, quoteId?: string) => {
    setIsLoadingItems(true);
    try {
      const params: Record<string, string> = { order_id: orderId };
      if (quoteId) params.quote_id = quoteId;
      params.is_sales = isSales ? 'true' : 'false';
      const data = await api.get(isSales ? API_ROUTES.SALES.ORDER_ITEMS : API_ROUTES.PURCHASES.ORDER_ITEMS, params);
      const raw = Array.isArray(data) ? data : (data.items || data.data || []);
      setOrderItems(raw.map((i: any) => ({
        id: String(i.id),
        service_id: String(i.service_id),
        service_name: i.service_name || '',
        unit_price: parseFloat(i.unit_price) || 0,
        quantity: parseInt(i.quantity) || 1,
        total: parseFloat(i.total) || 0,
        tooth_number: i.tooth_number ?? undefined,
        status: i.status || 'pending',
        scheduled_date: i.scheduled_date || null,
        completed_date: i.completed_date || null,
        invoiced_date: i.invoiced_date || null,
      })));
    } catch {
      setOrderItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, [isSales]);

  React.useEffect(() => { loadOrders(); }, [loadOrders]);

  // Efecto para refrescar cuando cambia refreshTrigger
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadOrders(true);
    }
  }, [refreshTrigger]);

  // ── Row selection ────────────────────────────────────────────────────────────
  const handleRowSelectionChange = React.useCallback((selectedRows: Order[]) => {
    const order = selectedRows[0] ?? null;
    setSelectedOrder(order);
    if (!order) {
      setIsSheetOpen(false);
      setOrderItems([]);
    }
  }, []);

  const handleOpenSheet = React.useCallback((order: Order) => {
    setIsSheetOpen(true);
    loadItems(order.id, order.quote_id ? String(order.quote_id) : undefined);
  }, [loadItems]);

  // ── Invoice handlers ──────────────────────────────────────────────────────────
  const handleInvoiceClick = () => {
    if (!selectedOrder) return;
    setInvoiceDate(new Date());
    setInvoiceNotes('');
    setInvoiceSubmissionError(null);
    setIsInvoiceDialogOpen(true);
  };

  const handleConfirmInvoice = async () => {
    if (!selectedOrder || !invoiceDate) return;
    setInvoiceSubmissionError(null);
    try {
      const payload = {
        order_id: selectedOrder.id,
        is_sales: isSales,
        query: JSON.stringify({
          order_id: parseInt(selectedOrder.id, 10),
          invoice_date: invoiceDate.toISOString(),
          is_sales: isSales,
          user_id: selectedOrder.user_id,
          notes: invoiceNotes || '',
        }),
      };

      const responseData = await api.post(
        isSales ? API_ROUTES.SALES.ORDER_INVOICE : API_ROUTES.PURCHASES.ORDER_INVOICE,
        payload
      );
      if (responseData.error || (responseData.code && responseData.code >= 400)) {
        if (responseData.message) {
          setInvoiceSubmissionError(responseData.message);
          return;
        }
        throw new Error(t('OrdersPage.invoiceDialog.createError'));
      }

      toast({
        title: t('OrdersPage.invoiceDialog.invoiceSuccess'),
        description: t('OrdersPage.invoiceDialog.invoiceSuccessDesc', { orderId: selectedOrder.doc_no }),
      });

      loadOrders(true);
      setIsInvoiceDialogOpen(false);
      onDataChange?.();

    } catch (error) {
      setInvoiceSubmissionError(error instanceof Error ? error.message : t('OrdersPage.invoiceDialog.createError'));
    }
  };

  // ── Toolbar action buttons ────────────────────────────────────────────────────
  const toolbarActions = selectedOrder ? (
    <div className="flex items-center gap-1.5">
      {/* Acción principal: Facturar */}
      {canInvoiceFromOrder && selectedOrder.status?.toLowerCase() !== 'completed' && (
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleInvoiceClick}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('Navigation.InvoiceAction')}
        </Button>
      )}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenSheet(selectedOrder)}>
        <Eye className="h-3.5 w-3.5" />
        Ver detalles
      </Button>
    </div>
  ) : null;

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <Card className="flex-1 flex flex-col min-h-0 shadow-none border-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          {selectedQuote && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">{t('UserOrders.showingForQuote')}:</div>
              <div className="font-medium">{selectedQuote.doc_no}</div>
            </div>
          )}
          <DataTable
            columns={columns}
            data={orders}
            filterColumnId="doc_no"
            filterPlaceholder={t('OrdersPage.filterPlaceholder')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRefresh={() => loadOrders(true)}
            isRefreshing={isRefreshing}
            extraButtons={toolbarActions}
            isNarrow={isViewportNarrow}
            renderCard={(order: Order, _isSelected: boolean) => (
              <DataCard isSelected={_isSelected}
                title={order.doc_no || `ORD-${order.id}`}
                subtitle={formatDateTime(order.createdAt)}
                badge={
                  <Badge variant={(STATUS_BADGE[order.status?.toLowerCase().trim()] ?? 'default') as any} className="capitalize text-[10px]">
                    {t(`OrdersPage.status.${STATUS_KEY_MAP[order.status?.toLowerCase().trim()] || order.status?.toLowerCase()}`)}
                  </Badge>
                }
                fields={[
                  { label: t('QuoteColumns.currency'), value: order.currency || '-' },
                  { label: t('QuoteColumns.quoteDocNo'), value: order.quote_doc_no || '-' },
                  { label: t('UserColumns.name'), value: order.user_name || '-' },
                ]}
              />
            )}
            columnTranslations={{
              doc_no: t('OrderColumns.docNo'),
              user_name: t('UserColumns.name'),
              quote_id: t('QuoteColumns.quoteId'),
              quote_doc_no: t('QuoteColumns.quoteDocNo'),
              currency: t('QuoteColumns.currency'),
              createdAt: t('OrderColumns.createdAt'),
              status: t('UserColumns.status'),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <ResizableSheet
        open={isSheetOpen}
        onOpenChange={(open: boolean) => {
          setIsSheetOpen(open);
          if (!open) { setRowSelection({}); setSelectedOrder(null); setOrderItems([]); }
        }}
        defaultWidth={900}
        minWidth={600}
        maxWidth={1400}
        storageKey="user-orders-sheet-width"
      >
        {selectedOrder && (
          <>
            {/* Header estilo ficha del paciente */}
            <div className="flex-none bg-card shadow-sm border-b border-border">
              {/* Título y badges principales */}
              <div className="px-6 py-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-4 pr-10">
                  <div className="flex items-center gap-3">
                    <div>
                      <SheetTitle className="text-2xl font-bold text-card-foreground">{selectedOrder.doc_no}</SheetTitle>
                      <SheetDescription className="text-sm text-muted-foreground mt-0.5">Orden</SheetDescription>
                    </div>
                  </div>
                  <Badge variant={(STATUS_BADGE[selectedOrder.status?.toLowerCase().trim()] ?? 'default') as any} className="capitalize">
                    {t(`OrdersPage.status.${STATUS_KEY_MAP[selectedOrder.status?.toLowerCase().trim()] || selectedOrder.status?.toLowerCase()}`)}
                  </Badge>
                </div>
              </div>

              {/* Información del documento integrada en el header */}
              <div className="px-6 py-3">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Presupuesto:</span>
                    <span className="text-sm font-medium">{selectedOrder.quote_doc_no || selectedOrder.quote_id || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Moneda:</span>
                    <span className="text-sm">{selectedOrder.currency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Creado:</span>
                    <span className="text-sm">{formatDateTime(selectedOrder.createdAt)}</span>
                  </div>
                  {selectedOrder.notes && (
                    <div className="flex items-center gap-2 w-full mt-1">
                      <span className="text-xs text-muted-foreground">Notas:</span>
                      <span className="text-sm text-muted-foreground italic">{selectedOrder.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            {canInvoiceFromOrder && (
              <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleInvoiceClick}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t('Navigation.InvoiceAction')}
                </Button>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
              <p className="text-sm font-semibold mb-2">Ítems de la orden</p>
              <div className="flex-1 overflow-hidden">
                <OrderItemsTable
                  items={orderItems}
                  isLoading={isLoadingItems}
                  onItemsUpdate={() => {
                    loadItems(selectedOrder.id, selectedOrder.quote_id ? String(selectedOrder.quote_id) : undefined);
                    onDataChange?.();
                  }}
                  quoteId={selectedOrder.quote_id ? String(selectedOrder.quote_id) : undefined}
                  quoteDocNo={selectedOrder.quote_doc_no}
                  isSales={isSales}
                  userId={userId}
                  patient={patient}
                />
              </div>
            </div>
          </>
        )}
      </ResizableSheet>

      {/* ── Invoice Dialog ── */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('OrdersPage.invoiceDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('OrdersPage.invoiceDialog.description', { orderId: selectedOrder?.doc_no })}
            </DialogDescription>
          </DialogHeader>
          {invoiceSubmissionError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">{t('OrdersPage.invoiceDialog.error')}</span>
              </div>
              <p className="mt-1">{invoiceSubmissionError}</p>
            </div>
          )}
          <div className="flex justify-center py-4">
            <DatePicker
              mode="single"
              selected={invoiceDate}
              onSelect={setInvoiceDate}
              initialFocus
            />
          </div>
          <div className="px-6 pb-2">
            <label className="text-sm font-medium">{t('OrdersPage.invoiceDialog.notesLabel')}</label>
            <Textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder={t('OrdersPage.invoiceDialog.notesPlaceholder')}
              className="mt-2 min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmInvoice}>{t('OrdersPage.invoiceDialog.confirm')}</Button>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>{t('OrdersPage.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
