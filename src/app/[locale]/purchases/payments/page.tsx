'use client';

import { SendDocumentEmailDialog, type EmailDocumentTarget } from '@/components/sales/send-document-email-dialog';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { PaymentEditDialog } from '@/components/payments/payment-edit-dialog';
import { PaymentAllocationsTable } from '@/components/tables/payment-allocations-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DetailHeader } from '@/components/ui/detail-header';
import { VerticalTabStrip, type VerticalTab } from '@/components/ui/vertical-tab-strip';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { GridExportDialog, type GridExportFormat } from '@/components/ui/grid-export-dialog';
import { downloadCSV, downloadExcel, type ExportColumn } from '@/lib/export-utils';
import { format } from 'date-fns';
import { API_ROUTES } from '@/constants/routes';
import { PurchasePrepaidFormDialog } from '@/components/purchases/payments/PurchasePrepaidFormDialog';
import { HelpScopeProvider } from '@/components/help/help-scope';
import { usePaymentsPagination } from '@/hooks/use-payments-pagination';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Payment, PaymentAllocation } from '@/lib/types';
import { cn, formatDisplayDate, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchasePayments, type PaymentTypeFilter } from '@/services/payments-service';
import { ColumnFiltersState, RowSelectionState } from '@tanstack/react-table';
import { ArrowRight, CreditCard, Loader2, Maximize2, Minimize2, Printer, RefreshCw, Send, StickyNote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { getClinicCurrency } from '@/stores/clinic-info-store';


export default function PaymentsPage() {
    return <PaymentsPageContent />;
}

function PaymentsPageContent() {
    const t = useTranslations('PaymentsPage');
    const { toast } = useToast();
    const { printPayment } = usePrintDocument();
    const { hasPermission } = usePermissions();

    // Permission checks for UI elements
    const canViewList = hasPermission(PURCHASES_PERMISSIONS.PAYMENTS_VIEW_LIST);
    const canCreatePayment = hasPermission(PURCHASES_PERMISSIONS.PAYMENTS_CREATE);
    const canViewDetail = hasPermission(PURCHASES_PERMISSIONS.PAYMENTS_VIEW_DETAIL);
    const canPrepaidCreate = hasPermission(PURCHASES_PERMISSIONS.PREPAYMENTS_CREATE);

    const {
        payments,
        isLoading,
        pagination,
        totalPages,
        totalItems,
        handlePaginationChange,
        handleSearchChange,
        handleTypeFilterChange,
        refreshPayments
    } = usePaymentsPagination({
        fetchFunction: getPurchasePayments
    });

    // Server-side transaction-type filter (prepaid / allocations / ...)
    const [typeFilter, setTypeFilter] = React.useState<PaymentTypeFilter>('all');
    const onTypeFilterChange = React.useCallback((type: PaymentTypeFilter) => {
        setTypeFilter(type);
        handleTypeFilterChange(type);
    }, [handleTypeFilterChange]);

    // Server-side search: lift the table's doc_no filter to drive the backend query
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const searchTerm = (columnFilters.find(f => f.id === 'doc_no')?.value as string) ?? '';
    const debouncedSearch = useDebounce(searchTerm, 300);
    const didMountSearch = React.useRef(false);
    React.useEffect(() => {
        // Skip the first run — the hook already performs the initial load
        if (!didMountSearch.current) {
            didMountSearch.current = true;
            return;
        }
        handleSearchChange(debouncedSearch);
    }, [debouncedSearch, handleSearchChange]);
    const [emailTarget, setEmailTarget] = React.useState<EmailDocumentTarget | null>(null);

    const [selectedPayment, setSelectedPayment] = React.useState<Payment | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [paymentAllocations, setPaymentAllocations] = React.useState<PaymentAllocation[]>([]);
    const [isLoadingAllocations, setIsLoadingAllocations] = React.useState(false);
    const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
    const [selectedPaymentForEdit, setSelectedPaymentForEdit] = React.useState<Payment | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('allocations');
    const [isRightExpanded, setIsRightExpanded] = React.useState(false);
    const [exportOpen, setExportOpen] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);

    const handleExport = React.useCallback(async (fmt: GridExportFormat, dateFrom: Date, dateTo: Date) => {
        setIsExporting(true);
        try {
            const data = await api.get(API_ROUTES.PURCHASES.PAYMENTS_ALL, {
                is_sales: 'false',
                date_from: format(dateFrom, 'yyyy-MM-dd'),
                date_to: format(dateTo, 'yyyy-MM-dd'),
            });
            // Same unwrap pattern as getPurchasePayments in payments-service.ts
            const rawRows = normalizeApiResponse<any>(data).items;
            const txTypeMap: Record<string, string> = {
                direct_payment: t('transactionType.direct_payment' as any),
                payment_allocation: t('transactionType.payment_allocation' as any),
                credit_note_allocation: t('transactionType.credit_note_allocation' as any),
                payment: t('transactionType.payment' as any),
                credit_note: t('transactionType.credit_note' as any),
                deposit_at_bank: t('transactionType.deposit_at_bank' as any),
                cash_deposit: t('transactionType.cash_deposit' as any),
            };
            const rows = rawRows.map((r: any) => ({
                ...r,
                transaction_type: txTypeMap[r.transaction_type] ?? r.transaction_type,
                is_historical: r.is_historical ? 'Sí' : 'No',
            }));
            const exportCols: ExportColumn[] = [
                { header: t('exportCols.docNo'), key: 'transaction_doc_no' },
                { header: t('exportCols.date'), key: 'created_at' },
                { header: t('exportCols.provider'), key: 'user_name' },
                { header: t('exportCols.amountApplied'), key: 'amount_applied' },
                { header: t('exportCols.sourceAmount'), key: 'source_amount' },
                { header: t('exportCols.sourceCurrency'), key: 'source_currency' },
                { header: t('exportCols.exchangeRate'), key: 'exchange_rate' },
                { header: t('exportCols.transactionType'), key: 'transaction_type' },
                { header: t('exportCols.paymentMethodName'), key: 'payment_method_name' },
                { header: t('exportCols.invoiceDocNo'), key: 'invoice_doc_no' },
                { header: t('exportCols.isHistorical'), key: 'is_historical' },
                { header: t('exportCols.notes'), key: 'notes' },
            ];
            if (fmt === 'csv') {
                downloadCSV(exportCols, rows, `pagos-compras-${format(dateFrom, 'yyyyMMdd')}-${format(dateTo, 'yyyyMMdd')}`);
            } else {
                await downloadExcel(exportCols, rows, `pagos-compras-${format(dateFrom, 'yyyyMMdd')}-${format(dateTo, 'yyyyMMdd')}`);
            }
            setExportOpen(false);
        } catch {
            toast({ title: t('exportError'), variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    }, [t, toast]);

    // Prepaid credit balance (only relevant when selectedPayment.invoice_id is null)
    const prepaidCurrency = selectedPayment?.currency || selectedPayment?.source_currency || getClinicCurrency();
    const prepaidTotal = Math.abs(Number(selectedPayment?.amount_applied || selectedPayment?.amount || 0));
    const prepaidUsed = React.useMemo(
        () => paymentAllocations.reduce((sum, a) => sum + Math.abs(Number(a.monto_desde_pago || 0)), 0),
        [paymentAllocations],
    );
    const prepaidAvailable = Math.max(0, prepaidTotal - prepaidUsed);

    const handleCreatePrepaid = React.useCallback(() => {
        setIsPrepaidDialogOpen(true);
    }, []);

    const handlePrintPayment = React.useCallback((payment: Payment) => {
        printPayment(payment, false);
    }, [printPayment]);

    const loadPaymentAllocations = React.useCallback(async (paymentId: string) => {
        setIsLoadingAllocations(true);
        try {
            const data = await api.get(API_ROUTES.PURCHASES.PAYMENT_ALLOCATIONS, { payment_id: paymentId });
            const allocations = Array.isArray(data) ? data : [];
            setPaymentAllocations(allocations.filter((item: PaymentAllocation) => item && item.allocation_id));
        } catch (error) {
            console.error("Failed to fetch payment allocations:", error);
            setPaymentAllocations([]);
        } finally {
            setIsLoadingAllocations(false);
        }
    }, []);

    const handleRowSelectionChange = React.useCallback((selectedRows: Payment[]) => {
        const payment = selectedRows.length > 0 ? selectedRows[0] : null;

        if (payment) {
            if (payment.id !== selectedPayment?.id) {
                setActiveTab(!payment.invoice_id ? 'allocations' : 'notes');
            }
            setSelectedPayment(payment);
            if (!payment.invoice_id) {
                loadPaymentAllocations(payment.id);
            } else {
                setPaymentAllocations([]);
                setIsLoadingAllocations(false);
            }
        } else {
            setSelectedPayment(null);
            setPaymentAllocations([]);
        }
    }, [loadPaymentAllocations, selectedPayment?.id]);

    const handleCloseDetails = React.useCallback(() => {
        setSelectedPayment(null);
        setPaymentAllocations([]);
        setRowSelection({});
        setActiveTab('allocations');
        setIsRightExpanded(false);
    }, []);

    const handleSendEmailClick = React.useCallback((payment: Payment) => {
        setEmailTarget({
            request: { type: 'payment', payment, isSales: false },
            id: payment.id,
            docNo: payment.doc_no || payment.payment_doc_no,
            defaultEmails: payment.userEmail || '',
        });
    }, []);

    const handleEditPaymentClick = React.useCallback((payment: Payment) => {
        setSelectedPaymentForEdit(payment);
        setIsEditDialogOpen(true);
    }, []);

    const paymentTabs = React.useMemo<VerticalTab[]>(() => {
        const tabs: VerticalTab[] = [];
        if (selectedPayment && !selectedPayment.invoice_id) {
            tabs.push({ id: 'allocations', icon: CreditCard, label: t('tabs.allocations') });
        }
        tabs.push({ id: 'notes', icon: StickyNote, label: t('tabs.notes') });
        return tabs;
    }, [t, selectedPayment]);

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                isRightPanelOpen={!!selectedPayment}
                onBack={handleCloseDetails}
                forceRightOnly={isRightExpanded}
                leftPanel={
                    <PaymentsTable
                        payments={payments}
                        isLoading={isLoading}
                        onRefresh={refreshPayments}
                        isRefreshing={isLoading}
                        onPrint={handlePrintPayment}
                        onSendEmail={handleSendEmailClick}
                        onEdit={canCreatePayment ? handleEditPaymentClick : undefined}
                        onCreate={handleCreatePrepaid}
                        canCreate={canPrepaidCreate}
                        pagination={pagination}
                        onPaginationChange={handlePaginationChange}
                        pageCount={totalPages}
                        rowCount={totalItems}
                        manualPagination={true}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                        onRowSelectionChange={handleRowSelectionChange}
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        title={t('title')}
                        description={t('description')}
                        className="h-full"
                        isCompact={!!selectedPayment}
                        onExport={() => setExportOpen(true)}
                        isSales={false}
                        typeFilter={typeFilter}
                        onTypeFilterChange={onTypeFilterChange}
                    />
                }
                rightPanel={
                    selectedPayment && (
                        <Card className={`h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0 ${selectedPayment.is_historical ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20' : ''}`}>
                            <CardHeader className="flex-none px-6 py-4 border-b border-border/50">
                                <DetailHeader
                                    icon={CreditCard}
                                    title={t('detailsFor', { name: selectedPayment.user_name })}
                                    subtitle={`${t('prepaidId')}: ${selectedPayment.doc_no || selectedPayment.id}`}
                                    fields={[
                                        {
                                            label: t('columns.amount_applied'),
                                            value: (
                                                <span className="text-sm font-semibold">
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: selectedPayment.currency || selectedPayment.source_currency || getClinicCurrency(),
                                                    }).format(Math.abs(Number(selectedPayment.amount_applied || selectedPayment.amount || 0)))}
                                                </span>
                                            ),
                                        },
                                        {
                                            label: t('columns.method'),
                                            value: (
                                                <span className="text-sm">
                                                    {selectedPayment.payment_method || selectedPayment.method || 'N/A'}
                                                </span>
                                            ),
                                        },
                                        {
                                            label: t('columns.date'),
                                            value: (
                                                <span className="text-sm">
                                                    {formatDisplayDate(selectedPayment.payment_date || selectedPayment.createdAt)}
                                                </span>
                                            ),
                                        },
                                    ]}
                                    headerActions={
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            title={isRightExpanded ? 'Restaurar' : 'Expandir'}
                                            aria-label={isRightExpanded ? 'Restaurar' : 'Expandir'}
                                            onClick={() => setIsRightExpanded((value) => !value)}
                                            className="shrink-0"
                                        >
                                            {isRightExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                                        </Button>
                                    }
                                    onClose={handleCloseDetails}
                                />
                            </CardHeader>
                            <div data-help-id="purchases.payments.section.actions" className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
                                {selectedPayment.is_historical && (
                                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                        {t('columns.isHistorical')}
                                    </Badge>
                                )}
                                <Button data-help-id="purchases.payments.btn.print" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handlePrintPayment(selectedPayment)}>
                                    <Printer className="h-3.5 w-3.5" />
                                    {t('actions.print')}
                                </Button>
                                <Button data-help-id="purchases.payments.btn.email" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendEmailClick(selectedPayment)}>
                                    <Send className="h-3.5 w-3.5" />
                                    {t('actions.sendEmail')}
                                </Button>
                            </div>

                            {/* Credit balance summary — only for prepaid payments (no invoice attached) */}
                            {!selectedPayment.invoice_id && (
                                <div data-help-id="purchases.payments.section.credit-balance" className="px-6 py-3 border-b">
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

                            {/* Allocation flow — source document → target invoice */}
                            {(selectedPayment.transaction_type === 'payment_allocation' || selectedPayment.transaction_type === 'credit_note_allocation') && (
                                <div className="px-6 py-3 border-b">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                {selectedPayment.transaction_type === 'credit_note_allocation'
                                                    ? t('allocationFlow.sourceCreditNote')
                                                    : t('allocationFlow.sourcePayment')}
                                            </span>
                                            <span className="text-sm font-semibold font-mono">{selectedPayment.payment_doc_no || selectedPayment.doc_no || 'N/A'}</span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('allocationFlow.targetInvoice')}</span>
                                            <span className="text-sm font-semibold font-mono">{selectedPayment.invoice_doc_no || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Invoice details — for non-prepaid, non-allocation payments */}
                            {selectedPayment.transaction_type === 'direct_payment' && selectedPayment.invoice_id && (
                                <div className="px-6 py-3 border-b">
                                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                                        {selectedPayment.invoice_doc_no && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('columns.invoice_doc_no')}</span>
                                                <span className="text-sm font-semibold">{selectedPayment.invoice_doc_no}</span>
                                            </div>
                                        )}
                                        {selectedPayment.type && (
                                            <>
                                                <div className="w-px h-8 bg-border" />
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('columns.type')}</span>
                                                    <span className="text-sm">{t(`columns.paymentTypes.${selectedPayment.type === 'credit_note' ? 'credit_note' : 'payment'}`)}</span>
                                                </div>
                                            </>
                                        )}
                                        {selectedPayment.order_doc_no && (
                                            <>
                                                <div className="w-px h-8 bg-border" />
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('columns.order_doc_no')}</span>
                                                    <span className="text-sm">{selectedPayment.order_doc_no}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <CardContent className="flex-1 flex flex-col overflow-hidden p-0 min-h-0 bg-card">
                                <VerticalTabStrip
                                    tabs={paymentTabs}
                                    activeTabId={activeTab}
                                    onTabClick={(tab) => setActiveTab(tab.id)}
                                />
                                <HelpScopeProvider scope="purchases.payments.detail">
                                <div className="flex-1 min-w-0 overflow-y-auto flex flex-col min-h-0 px-0 pt-4 pb-8 sm:py-3 sm:px-3">
                                    {activeTab === 'allocations' && (
                                        <div className="m-0 h-full flex flex-col px-3">
                                            <div className="flex items-center justify-between mb-2 flex-none">
                                                <h4 className="text-sm font-semibold">{t('PaymentAllocationsTable.title')}</h4>
                                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => loadPaymentAllocations(selectedPayment.id)} disabled={isLoadingAllocations}>
                                                    <RefreshCw className={`h-4 w-4 ${isLoadingAllocations ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                            <div className="flex-1 min-h-0 overflow-auto">
                                                <PaymentAllocationsTable
                                                    allocations={paymentAllocations}
                                                    isLoading={isLoadingAllocations}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {activeTab === 'notes' && (
                                        <div className="m-0 h-full p-4">
                                            {selectedPayment.notes ? (
                                                <div className="whitespace-pre-wrap text-sm">{selectedPayment.notes}</div>
                                            ) : (
                                                <p className="text-muted-foreground text-sm">{t('notes.noNotes')}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                </HelpScopeProvider>
                            </CardContent>
                        </Card>
                    )
                }
            />

            <SendDocumentEmailDialog document={emailTarget} onClose={() => setEmailTarget(null)} />

            <PaymentEditDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                payment={selectedPaymentForEdit}
                onSuccess={async (updatedPayment) => {
                    await refreshPayments();
                    if (updatedPayment && selectedPayment?.id === updatedPayment.id) {
                        setSelectedPayment(updatedPayment);
                    }
                    setSelectedPaymentForEdit(null);
                }}
            />

            <PurchasePrepaidFormDialog
                open={isPrepaidDialogOpen}
                onOpenChange={setIsPrepaidDialogOpen}
                onSaveSuccess={refreshPayments}
            />
            <GridExportDialog
                open={exportOpen}
                onOpenChange={setExportOpen}
                onExport={handleExport}
                isExporting={isExporting}
            />
        </div>
    );
}
