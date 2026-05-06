'use client';

import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { PaymentEditDialog } from '@/components/payments/payment-edit-dialog';
import { PaymentAllocationsTable } from '@/components/tables/payment-allocations-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResizableSheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { Payment, PaymentAllocation, Quote, UserDetailMode } from '@/lib/types';
import { formatDateTime, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { isPaymentEditable, mapApiPaymentToPayment } from '@/services/payments-service';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { ChevronDown, Eye, Pencil, Printer, Send } from 'lucide-react';
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

export function UserPayments({ userId, selectedQuote, mode = 'sales', refreshTrigger }: UserPaymentsProps) {
  const t = useTranslations();
  const tPayments = useTranslations('PaymentsPage');
  const isViewportNarrow = useViewportNarrow();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
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
  const handlePrint = async () => {
    if (!selectedPayment) return;
    try {
      const blob = await api.getBlob(
        isSales ? API_ROUTES.SALES.API_PAYMENT_PRINT : API_ROUTES.PURCHASES.API_PAYMENT_PRINT,
        {
          transaction_id: selectedPayment.transaction_id || selectedPayment.id,
          transaction_type: selectedPayment.transaction_type
        }
      );
      const fileName = getDocumentFileName(selectedPayment, 'payment');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      toast({ title: 'Error al imprimir', variant: 'destructive' });
    }
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
            isNarrow={isViewportNarrow}
            renderCard={(payment: Payment, _isSelected: boolean) => {
              const { type, variant } = getPaymentType(payment);
              const statusLower = payment.status?.toLowerCase();
              return (
                <DataCard isSelected={_isSelected}
                  className={payment.is_historical ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30' : undefined}
                  title={payment.doc_no || `PAY-${payment.id}`}
                  subtitle={formatDateTime(payment.createdAt)}
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
            {/* Header estilo ficha del paciente */}
            <div className="flex-none bg-card shadow-sm border-b border-border">
              {/* Título y badges principales */}
              <div className="px-6 py-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-4 pr-10 sm:pr-20">
                  <div className="flex items-center gap-3">
                    <div>
                      <SheetTitle className="text-2xl font-bold text-card-foreground">{selectedPayment.doc_no || `PAY-${selectedPayment.id}`}</SheetTitle>
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
                    <span className="text-xs text-muted-foreground">Monto:</span>
                    <span className="font-semibold text-sm">{new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedPayment.currency || 'USD' }).format(Math.abs(selectedPayment.amount))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Método:</span>
                    <span className="text-sm">{selectedPayment.method || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Fecha:</span>
                    <span className="text-sm">{formatDateTime(selectedPayment.createdAt)}</span>
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
              {/* Acción principal */}
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
              {/* Acciones secundarias */}
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

      {/* Email Dialog */}
      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent>
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
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>
              {tPayments('sendEmailDialog.cancel')}
            </Button>
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
