
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ResizableSheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentAllocationsTable } from '@/components/tables/payment-allocations-table';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Payment, PaymentAllocation, Quote } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/services/api';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { ChevronDown, Eye, Printer, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, any> = { completed: 'success', pending: 'info', failed: 'destructive' };

// ── Type helpers ──────────────────────────────────────────────────────────────
const getPaymentType = (payment: Payment): { type: 'payment' | 'prepaid' | 'credit_note'; variant: 'default' | 'secondary' | 'outline' } => {
  if (payment.invoice_id && payment.type === 'credit_note') {
    return { type: 'credit_note', variant: 'secondary' };
  } else if (!payment.invoice_id) {
    return { type: 'prepaid', variant: 'outline' };
  } else {
    return { type: 'payment', variant: 'default' };
  }
};

// ── Columns ───────────────────────────────────────────────────────────────────
const getColumns = (t: (key: string) => string): ColumnDef<Payment>[] => [
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
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.doc_no')} />,
    cell: ({ row }) => {
      const docNo = row.getValue('doc_no') as string;
      return <div className="font-medium">{docNo || 'N/A'}</div>;
    },
  },
  {
    accessorKey: 'invoice_doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.docNo')} />,
    cell: ({ row }) => {
      const invoiceDocNo = row.getValue('invoice_doc_no') as string;
      return <div className="font-medium">{invoiceDocNo || '-'}</div>;
    },
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.amount')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: row.original.currency || 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'method',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.method')} />,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.type')} />,
    cell: ({ row }) => {
      const payment = row.original;
      const { type, variant } = getPaymentType(payment);
      return (
        <Badge variant={variant}>
          {t(`PaymentsPage.columns.paymentTypes.${type}`)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.createdAt')} />,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getPaymentsForUser(userId: string): Promise<Payment[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_PAYMENTS, { user_id: userId });
    const paymentsData = Array.isArray(data) ? data : (data.payments || []);

    return paymentsData.map((apiPayment: any) => ({
      id: apiPayment.id.toString(),
      doc_no: apiPayment.doc_no || `PAY-${apiPayment.id}`,
      order_id: apiPayment.order_id?.toString() ?? '',
      order_doc_no: apiPayment.order_doc_no || `ORD-${apiPayment.order_id}`,
      invoice_id: apiPayment.invoice_id?.toString() ?? null,
      invoice_doc_no: apiPayment.invoice_doc_no || '',
      quote_id: apiPayment.quote_id?.toString() ?? null,
      user_name: apiPayment.user_name || '',
      amount: parseFloat(apiPayment.amount),
      method: apiPayment.method,
      status: apiPayment.status,
      createdAt: apiPayment.created_at,
      updatedAt: apiPayment.updatedAt,
      currency: apiPayment.currency,
      payment_date: apiPayment.payment_date,
      amount_applied: parseFloat(apiPayment.amount_applied),
      source_amount: parseFloat(apiPayment.amount),
      source_currency: apiPayment.currency,
      exchange_rate: parseFloat(apiPayment.exchange_rate),
      payment_method: apiPayment.payment_method,
      transaction_type: apiPayment.transaction_type,
      transaction_id: apiPayment.transaction_id,
      reference_doc_id: apiPayment.reference_doc_id,
      is_historical: apiPayment.is_historical || false,
      notes: apiPayment.notes || '',
      type: apiPayment.type || null,
    }));
  } catch (error) {
    console.error("Failed to fetch user payments:", error);
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface UserPaymentsProps {
  userId: string;
  selectedQuote?: Quote | null;
}

export function UserPayments({ userId, selectedQuote }: UserPaymentsProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedPayment, setSelectedPayment] = React.useState<Payment | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Allocations
  const [allocations, setAllocations] = React.useState<PaymentAllocation[]>([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = React.useState(false);

  const columns = React.useMemo(() => getColumns(t), [t]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadPayments = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const fetchedPayments = await getPaymentsForUser(userId);
    let filtered = fetchedPayments;
    if (selectedQuote) {
      filtered = fetchedPayments.filter(p => p.quote_id === selectedQuote.id);
    }
    setPayments(filtered);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId, selectedQuote]);

  const loadAllocations = React.useCallback(async (paymentId: string) => {
    setIsLoadingAllocations(true);
    try {
      const data = await api.get(API_ROUTES.SALES.PAYMENT_ALLOCATIONS, { payment_id: paymentId });
      const raw = Array.isArray(data) ? data : (data.allocations || data.data || []);
      setAllocations(raw);
    } catch {
      setAllocations([]);
    } finally {
      setIsLoadingAllocations(false);
    }
  }, []);

  React.useEffect(() => { loadPayments(); }, [loadPayments]);

  // ── Row selection ────────────────────────────────────────────────────────────
  const handleRowSelectionChange = React.useCallback((selectedRows: Payment[]) => {
    const payment = selectedRows[0] ?? null;
    setSelectedPayment(payment);
    if (!payment) {
      setIsSheetOpen(false);
      setAllocations([]);
    }
  }, []);

  const handleOpenSheet = React.useCallback((payment: Payment) => {
    setIsSheetOpen(true);
    if (!payment.invoice_id) {
      loadAllocations(payment.id);
    } else {
      setAllocations([]);
    }
  }, [loadAllocations]);

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!selectedPayment) return;
    try {
      const blob = await api.getBlob(API_ROUTES.SALES.API_PAYMENT_PRINT, { payment_id: selectedPayment.id });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error al imprimir', variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    if (!selectedPayment) return;
    try {
      await api.post(API_ROUTES.SALES.API_PAYMENT_SEND, { payment_id: selectedPayment.id });
      toast({ title: 'Pago enviado por correo' });
    } catch {
      toast({ title: 'Error al enviar', variant: 'destructive' });
    }
  };

  // ── Toolbar action buttons ────────────────────────────────────────────────────
  const toolbarActions = selectedPayment ? (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs">
            Acciones
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSend}>
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenSheet(selectedPayment)}>
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
              <div className="text-sm text-muted-foreground">{t('UserPayments.showingForQuote')}:</div>
              <div className="font-medium">{selectedQuote.doc_no || selectedQuote.id}</div>
            </div>
          )}
          <DataTable
            columns={columns}
            data={payments}
            filterColumnId="doc_no"
            filterPlaceholder={t('PaymentsPage.filterPlaceholder')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRefresh={() => loadPayments(true)}
            isRefreshing={isRefreshing}
            extraButtons={toolbarActions}
            columnTranslations={{
              doc_no: t('PaymentsPage.columns.doc_no'),
              user_name: t('PaymentsPage.columns.user'),
              invoice_doc_no: t('InvoicesPage.columns.docNo'),
              amount: t('PaymentsPage.columns.amount'),
              method: t('PaymentsPage.columns.method'),
              type: t('PaymentsPage.columns.type'),
              createdAt: t('PaymentsPage.columns.createdAt'),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <ResizableSheet
        open={isSheetOpen}
        onOpenChange={(open: boolean) => {
          setIsSheetOpen(open);
          if (!open) { setRowSelection({}); setSelectedPayment(null); setAllocations([]); }
        }}
        defaultWidth={800}
        minWidth={560}
        maxWidth={1400}
        storageKey="user-payments-sheet-width"
      >
        {selectedPayment && (
          <>
            <SheetHeader className="px-6 py-4 border-b">
              <div className="flex items-start justify-between gap-4 pr-10">
                <div>
                  <SheetTitle className="text-lg">{selectedPayment.doc_no || `PAY-${selectedPayment.id}`}</SheetTitle>
                  <SheetDescription>
                    {(() => {
                      const { type } = getPaymentType(selectedPayment);
                      return t(`PaymentsPage.columns.paymentTypes.${type}`);
                    })()}
                  </SheetDescription>
                </div>
                {(() => {
                  const { type, variant } = getPaymentType(selectedPayment);
                  return (
                    <Badge variant={variant}>
                      {t(`PaymentsPage.columns.paymentTypes.${type}`)}
                    </Badge>
                  );
                })()}
              </div>
            </SheetHeader>

            {/* Meta info */}
            <div className="px-6 py-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm border-b">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Monto</p>
                <p className="font-semibold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedPayment.currency || 'USD' }).format(selectedPayment.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Método</p>
                <p className="text-xs font-medium">{selectedPayment.method || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Fecha</p>
                <p className="text-xs">{formatDateTime(selectedPayment.createdAt)}</p>
              </div>
              {selectedPayment.order_doc_no && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Orden</p>
                  <p className="text-xs font-medium">{selectedPayment.order_doc_no}</p>
                </div>
              )}
              {selectedPayment.transaction_type && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Tipo</p>
                  <p className="text-xs font-medium capitalize">{selectedPayment.transaction_type.replace(/_/g, ' ')}</p>
                </div>
              )}
              {selectedPayment.exchange_rate && selectedPayment.exchange_rate !== 1 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Tipo de cambio</p>
                  <p className="text-xs font-medium">{selectedPayment.exchange_rate.toFixed(4)}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-3 flex items-center gap-2 border-b bg-muted/30">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSend}>
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
            </div>

            {/* Notes */}
            {selectedPayment.notes && (
              <div className="px-6 py-3 border-b">
                <p className="text-xs text-muted-foreground mb-1">Notas</p>
                <p className="text-sm">{selectedPayment.notes}</p>
              </div>
            )}

            {/* Allocations (only for pre-payments) */}
            {!selectedPayment.invoice_id && (
              <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
                <p className="text-sm font-semibold mb-2">Asignaciones</p>
                <div className="flex-1 overflow-hidden">
                  <PaymentAllocationsTable
                    allocations={allocations}
                    isLoading={isLoadingAllocations}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </ResizableSheet>
    </>
  );
}
