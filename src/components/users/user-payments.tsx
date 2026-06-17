'use client';

import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { PaymentEditDialog } from '@/components/payments/payment-edit-dialog';
import { PaymentAllocationsTable } from '@/components/tables/payment-allocations-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataCard } from '@/components/ui/data-card';
import { DataListRow } from '@/components/ui/data-list-row';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResizableSheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { Payment, PaymentAllocation, Quote, UserDetailMode } from '@/lib/types';
import { cn, formatDisplayDate, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { isPaymentEditable, mapApiPaymentToPayment } from '@/services/payments-service';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { ChevronDown, Eye, Loader2, Pencil, Printer, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, any> = { completed: 'success', pending: 'info', failed: 'destructive' };

// ── Type helpers ──────────────────────────────────────────────────────────────
const getPaymentType = (payment: Payment): { type: 'direct_payment' | 'prepaid' | 'payment_allocation' | 'credit_note_allocation'; variant: 'default' | 'secondary' | 'outline' } => {
  if (payment.transaction_type === 'credit_note_allocation') {
    return { type: 'credit_note_allocation', variant: 'secondary' };
  }
  if (payment.transaction_type === 'payment_allocation') {
    return { type: 'payment_allocation', variant: 'secondary' };
  }
  if (payment.transaction_type === 'direct_payment' && !payment.invoice_id) {
    return { type: 'prepaid', variant: 'outline' };
  }
  return { type: 'direct_payment', variant: 'default' };
};

const isAllocationPayment = (payment: Payment) =>
  payment.transaction_type === 'payment_allocation' ||
  payment.transaction_type === 'credit_note_allocation';

const historicalBadgeClassName = 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';

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
      if (!docNo && isAllocationPayment(row.original)) {
        return <div className="font-medium text-muted-foreground italic">Crédito</div>;
      }
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
      const amount = Math.abs(parseFloat(row.getValue('amount')));
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
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={variant}>
            {t(`PaymentsPage.columns.paymentTypes.${type}`)}
          </Badge>
          {payment.is_historical && (
            <Badge variant="outline" className={historicalBadgeClassName}>
              {t('PaymentsPage.columns.isHistorical')}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'payment_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.date')} />,
    cell: ({ row }) => formatDisplayDate(row.original.payment_date || row.original.createdAt),
  },
  {
    accessorKey: 'external_id',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.external_id')} />,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.external_id ?? '—'}
      </span>
    ),
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getPaymentsForUser(userId: string): Promise<Payment[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_PAYMENTS, { user_id: userId });
    const paymentsData = Array.isArray(data) ? data : (data.payments || []);

    return paymentsData
      .filter((p: any) => p && p.transaction_id != null)
      .map(mapApiPaymentToPayment);
  } catch (error) {
    console.error("Failed to fetch user payments:", error);
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface UserPaymentsProps {
  userId: string;
  selectedQuote?: Quote | null;
  mode?: UserDetailMode;
  refreshTrigger?: number;
}

export function UserPayments({ userId, mode = 'sales', refreshTrigger }: UserPaymentsProps) {
  const t = useTranslations();
  const tPayments = useTranslations('PaymentsPage');
  const isViewportNarrow = useViewportNarrow();
  const [viewMode, setViewMode] = useTableViewMode('payments-list', 'table');
  const showToggle = !isViewportNarrow;
  const useListView = !isViewportNarrow && viewMode === 'list';
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { printPayment } = usePrintDocument();
  const isSales = mode === 'sales';
  const canEditPayment = hasPermission(isSales ? SALES_PERMISSIONS.PAYMENTS_CREATE : PURCHASES_PERMISSIONS.PAYMENTS_CREATE);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedPayment, setSelectedPayment] = React.useState<Payment | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Allocations
  const [allocations, setAllocations] = React.useState<PaymentAllocation[]>([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = React.useState(false);

  // Prepaid credit balance
  const prepaidCurrency = selectedPayment?.currency || selectedPayment?.source_currency || 'USD';
  const prepaidTotal = Math.abs(Number(selectedPayment?.amount_applied || selectedPayment?.amount || 0));
  const prepaidUsed = React.useMemo(
    () => allocations.reduce((sum, a) => sum + Math.abs(Number(a.monto_desde_pago || 0)), 0),
    [allocations],
  );
  const prepaidAvailable = Math.max(0, prepaidTotal - prepaidUsed);

  // Email dialog
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedPaymentForEmail, setSelectedPaymentForEmail] = React.useState<Payment | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
  const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = React.useState<Payment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const columns = React.useMemo(() => getColumns(t), [t]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadPayments = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const fetchedPayments = await getPaymentsForUser(userId);
    setPayments(fetchedPayments);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId]);

  const loadAllocations = React.useCallback(async (paymentId: string) => {
    setIsLoadingAllocations(true);
    try {
      const data = await api.get(
        isSales ? API_ROUTES.SALES.PAYMENT_ALLOCATIONS : API_ROUTES.PURCHASES.PAYMENT_ALLOCATIONS,
        { payment_id: paymentId }
      );
      const raw = Array.isArray(data) ? data : (data.allocations || data.data || []);
      setAllocations(raw.filter((item: PaymentAllocation) => item && item.allocation_id));
    } catch {
      setAllocations([]);
    } finally {
      setIsLoadingAllocations(false);
    }
  }, [isSales]);

  React.useEffect(() => { loadPayments(); }, [loadPayments]);

  // Efecto para refrescar cuando cambia refreshTrigger
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadPayments(true);
    }
  }, [refreshTrigger, loadPayments]);

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

  const handleSendEmailClick = (payment: Payment) => {
    setSelectedPaymentForEmail(payment);
    setEmailRecipients(payment.userEmail || '');
    setIsSendEmailDialogOpen(true);
  };

  const handleEditPaymentClick = React.useCallback((payment: Payment) => {
    if (!isPaymentEditable(payment)) {
      toast({ title: tPayments('editDialog.errors.notEditable'), variant: 'destructive' });
      return;
    }

    setSelectedPaymentForEdit(payment);
    setIsEditDialogOpen(true);
  }, [tPayments, toast]);

  const handleConfirmSendEmail = async () => {
    if (!selectedPaymentForEmail) return;

    const emails = emailRecipients.split(',').map(e => e.trim()).filter(e => e);
    if (emails.length === 0) {
      toast({ title: tPayments('sendEmailDialog.errorNoEmail'), variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      toast({ title: tPayments('sendEmailDialog.errorInvalidEmails', { emails: invalidEmails.join(', ') }), variant: 'destructive' });
      return;
    }

    // Verificar preferencias de comunicación
    const preferences = await checkPreferencesByEmails(emails, 'email', 'billing');
    const disabled = getDisabledEmails(preferences);

    if (disabled.length > 0) {
      setDisabledEmails(disabled);
      setIsWarningDialogOpen(true);
      return;
    }

    await sendEmail(emails);
  };

  const sendEmail = async (emails: string[]) => {
    if (!selectedPaymentForEmail) return;

    setIsSendingEmail(true);
    try {
      await api.post(
        isSales ? API_ROUTES.SALES.API_PAYMENT_SEND : API_ROUTES.PURCHASES.API_PAYMENT_SEND,
        {
          transaction_id: selectedPaymentForEmail.transaction_id || selectedPaymentForEmail.id,
          transaction_type: selectedPaymentForEmail.transaction_type,
          emails
        }
      );
      toast({ title: tPayments('sendEmailDialog.success') });
      setIsSendEmailDialogOpen(false);
      setSelectedPaymentForEmail(null);
      setEmailRecipients('');
    } catch {
      toast({ title: tPayments('sendEmailDialog.error'), variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleWarningConfirm = async () => {
    setIsWarningDialogOpen(false);
    const emails = emailRecipients.split(',').map(e => e.trim()).filter(e => e);
    await sendEmail(emails);
  };

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!selectedPayment) return;
    printPayment(selectedPayment, isSales);
  };

  // ── Toolbar action buttons ────────────────────────────────────────────────────
  const toolbarActions = selectedPayment ? (
    <div className="flex items-center gap-1.5">
      {/* Acción principal: Imprimir */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={handlePrint}
      >
        <Printer className="h-3.5 w-3.5" />
        Imprimir
      </Button>
      {/* El dropdown siempre tiene al menos la acción Enviar */}
      {(true) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              Acciones
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSendEmailClick(selectedPayment)}>
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </DropdownMenuItem>
            {canEditPayment && isPaymentEditable(selectedPayment) && (
              <DropdownMenuItem onClick={() => handleEditPaymentClick(selectedPayment)}>
                <Pencil className="h-4 w-4 mr-2" />
                {tPayments('actions.edit')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
            isNarrow={isViewportNarrow || useListView}
            viewControls={showToggle ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : undefined}
            cardListClassName={useListView ? 'gap-0 px-0 py-0 rounded-md border' : undefined}
            renderCard={(payment: Payment, _isSelected: boolean) => {
              const { type, variant } = getPaymentType(payment);
              const statusLower = payment.status?.toLowerCase();
              const badgeGroup = (
                <div className="flex gap-1 flex-wrap justify-end">
                  {payment.is_historical && (
                    <Badge variant="outline" className={`${historicalBadgeClassName} text-[10px]`}>
                      {t('PaymentsPage.columns.isHistorical')}
                    </Badge>
                  )}
                  <Badge variant={variant} className="capitalize text-[10px]">
                    {t(`PaymentsPage.columns.paymentTypes.${type}`)}
                  </Badge>
                  {statusLower && (
                    <Badge variant={(STATUS_BADGE[statusLower] ?? 'default') as any} className="capitalize text-[10px]">
                      {statusLower}
                    </Badge>
                  )}
                </div>
              );
              if (useListView) {
                return (
                  <DataListRow
                    isSelected={_isSelected}
                    onClick={() => handleRowSelectionChange([payment])}
                    title={payment.doc_no || (isAllocationPayment(payment) ? 'Crédito' : `PAY-${payment.id}`)}
                    badge={badgeGroup}
                    meta={(
                      <>
                        <span>{formatDisplayDate(payment.payment_date || payment.createdAt)}</span>
                        <span className="font-medium text-foreground">{t('PaymentsPage.columns.amount')}: {payment.currency || ''} {Math.abs(parseFloat(String(payment.amount || 0))).toFixed(2)}</span>
                        <span>{t('PaymentsPage.columns.method')}: {payment.method || '-'}</span>
                        {payment.invoice_doc_no ? <span>{t('InvoicesPage.columns.docNo')}: {payment.invoice_doc_no}</span> : null}
                      </>
                    )}
                  />
                );
              }
              return (
                <DataCard isSelected={_isSelected}
                  className={payment.is_historical ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30' : undefined}
                  title={payment.doc_no || (isAllocationPayment(payment) ? 'Crédito' : `PAY-${payment.id}`)}
                  subtitle={formatDisplayDate(payment.payment_date || payment.createdAt)}
                  badge={
                    <div className="flex gap-1 flex-wrap justify-end">
                      {payment.is_historical && (
                        <Badge variant="outline" className={`${historicalBadgeClassName} text-[10px]`}>
                          {t('PaymentsPage.columns.isHistorical')}
                        </Badge>
                      )}
                      <Badge variant={variant} className="capitalize text-[10px]">
                        {t(`PaymentsPage.columns.paymentTypes.${type}`)}
                      </Badge>
                      {statusLower && (
                        <Badge variant={(STATUS_BADGE[statusLower] ?? 'default') as any} className="capitalize text-[10px]">
                          {statusLower}
                        </Badge>
                      )}
                    </div>
                  }
                  fields={[
                    { label: t('PaymentsPage.columns.amount'), value: `${payment.currency || ''} ${Math.abs(parseFloat(String(payment.amount || 0))).toFixed(2)}`, primary: true },
                    { label: t('PaymentsPage.columns.method'), value: payment.method || '-' },
                    { label: t('InvoicesPage.columns.docNo'), value: payment.invoice_doc_no || '-' },
                  ]}
                />
              );
            }}
            columnTranslations={{
              doc_no: t('PaymentsPage.columns.doc_no'),
              user_name: isSales ? t('PaymentsPage.columns.user') : t('InvoicesPage.columns.provider'),
              invoice_doc_no: t('InvoicesPage.columns.docNo'),
              amount: t('PaymentsPage.columns.amount'),
              method: t('PaymentsPage.columns.method'),
              type: t('PaymentsPage.columns.type'),
              payment_date: t('PaymentsPage.columns.date'),
              external_id: t('PaymentsPage.columns.external_id'),
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
            {/* Header estilo ficha del paciente */}
            <div className="flex-none bg-card shadow-sm border-b border-border">
              {/* Título y badges principales */}
              <div className="px-6 py-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-4 pr-10 sm:pr-20">
                  <div className="flex items-center gap-3">
                    <div>
                      <SheetTitle className="text-2xl font-bold text-card-foreground">{selectedPayment.doc_no || (isAllocationPayment(selectedPayment) ? 'Crédito aplicado' : `PAY-${selectedPayment.id}`)}</SheetTitle>
                      <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                        {(() => {
                          const { type } = getPaymentType(selectedPayment);
                          return t(`PaymentsPage.columns.paymentTypes.${type}`);
                        })()}
                      </SheetDescription>
                    </div>
                  </div>
                  {(() => {
                    const { type, variant } = getPaymentType(selectedPayment);
                    return (
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={variant}>
                          {t(`PaymentsPage.columns.paymentTypes.${type}`)}
                        </Badge>
                        {selectedPayment.is_historical && (
                          <Badge variant="outline" className={historicalBadgeClassName}>
                            {t('PaymentsPage.columns.isHistorical')}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Información del documento integrada en el header */}
              <div className="px-6 py-3">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Método:</span>
                    <span className="text-sm">{selectedPayment.method || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Fecha:</span>
                    <span className="text-sm">{formatDisplayDate(selectedPayment.payment_date || selectedPayment.createdAt)}</span>
                  </div>
                  {selectedPayment.transaction_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Tipo:</span>
                      <span className="text-sm">{tPayments(`transactionType.${selectedPayment.transaction_type}`)}</span>
                    </div>
                  )}
                  {selectedPayment.exchange_rate && selectedPayment.exchange_rate !== 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Tipo de cambio:</span>
                      <span className="text-sm">{selectedPayment.exchange_rate.toFixed(4)}</span>
                    </div>
                  )}
                  {selectedPayment.notes && (
                    <div className="flex items-center gap-2 w-full mt-1">
                      <span className="text-xs text-muted-foreground">Notas:</span>
                      <span className="text-sm text-muted-foreground italic">{selectedPayment.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendEmailClick(selectedPayment)}>
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
              {canEditPayment && isPaymentEditable(selectedPayment) && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleEditPaymentClick(selectedPayment)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {tPayments('actions.edit')}
                </Button>
              )}
            </div>

            {/* Credit balance — prepaid payments only */}
            {!selectedPayment.invoice_id && (
              <div className="px-6 py-3 border-b">
                {isLoadingAllocations ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Calculando saldo disponible...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total prepago</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {new Intl.NumberFormat('es-UY', { style: 'currency', currency: prepaidCurrency }).format(prepaidTotal)}
                      </span>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Utilizado</span>
                      <span className="text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400">
                        {new Intl.NumberFormat('es-UY', { style: 'currency', currency: prepaidCurrency }).format(prepaidUsed)}
                      </span>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Disponible</span>
                      <span className={cn('text-sm font-semibold tabular-nums', prepaidAvailable > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                        {new Intl.NumberFormat('es-UY', { style: 'currency', currency: prepaidCurrency }).format(prepaidAvailable)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Allocations table — prepaid payments only */}
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

            {/* Related documents — non-prepaid payments */}
            {selectedPayment.invoice_id && (
              <div className="flex-1 flex flex-col overflow-hidden px-4 py-4">
                <p className="text-sm font-semibold mb-2">Documentos relacionados</p>
                {(selectedPayment.invoice_doc_no || (isAllocationPayment(selectedPayment) && selectedPayment.payment_doc_no)) ? (
                  <DataCard
                    fields={[
                      ...(selectedPayment.invoice_doc_no ? [{ label: 'Factura', value: `#${selectedPayment.invoice_doc_no}` }] : []),
                      // Source document only makes sense for allocation rows
                      ...(isAllocationPayment(selectedPayment) && selectedPayment.payment_doc_no
                        ? [{
                            label: selectedPayment.transaction_type === 'credit_note_allocation' ? 'Nota de crédito origen' : 'Pago origen',
                            value: `#${selectedPayment.payment_doc_no}`,
                          }]
                        : []),
                    ]}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin documentos relacionados</p>
                )}
              </div>
            )}

            {/* ── Financial Footer ── */}
            <div className="flex-none border-t bg-muted/30 px-6 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Monto</p>
                <p className="text-sm font-semibold tabular-nums">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedPayment.currency || 'USD' }).format(Math.abs(selectedPayment.amount))}
                </p>
              </div>
            </div>
          </>
        )}
      </ResizableSheet>

      {/* Email Dialog */}
      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent confirmOnClose isDirty={emailRecipients.trim() !== ''}>
          <DialogHeader>
            <DialogTitle>{tPayments('sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>
              {tPayments('sendEmailDialog.description', { id: selectedPaymentForEmail?.id || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <Label htmlFor="email-recipients">{tPayments('sendEmailDialog.recipients')}</Label>
            <Input
              id="email-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={tPayments('sendEmailDialog.placeholder')}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {tPayments('sendEmailDialog.helperText')}
            </p>
          </div>
          <DialogFooter>
            <DialogCancelButton>
              {tPayments('sendEmailDialog.cancel')}
            </DialogCancelButton>
            <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? tPayments('sendEmailDialog.sending') : tPayments('sendEmailDialog.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Dialog */}
      <CommunicationWarningDialog
        open={isWarningDialogOpen}
        onOpenChange={setIsWarningDialogOpen}
        disabledItems={disabledEmails}
        onConfirm={handleWarningConfirm}
      />

      <PaymentEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        payment={selectedPaymentForEdit}
        onSuccess={async (updatedPayment) => {
          await loadPayments(true);
          if (updatedPayment && selectedPayment?.id === updatedPayment.id) {
            setSelectedPayment(updatedPayment);
            setSelectedPaymentForEdit(updatedPayment);
          } else {
            setSelectedPaymentForEdit(null);
          }
        }}
      />
    </>
  );
}
