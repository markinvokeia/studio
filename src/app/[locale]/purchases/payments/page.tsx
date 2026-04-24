'use client';

import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { PaymentEditDialog } from '@/components/payments/payment-edit-dialog';
import { PaymentAllocationsTable } from '@/components/tables/payment-allocations-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DetailHeader } from '@/components/ui/detail-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VerticalTabStrip, type VerticalTab } from '@/components/ui/vertical-tab-strip';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { PurchasePrepaidFormDialog } from '@/components/purchases/payments/PurchasePrepaidFormDialog';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { usePaymentsPagination } from '@/hooks/use-payments-pagination';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Payment, PaymentAllocation } from '@/lib/types';
import { formatDateTime, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchasePayments } from '@/services/payments-service';
import { RowSelectionState } from '@tanstack/react-table';
import { CreditCard, Loader2, Maximize2, Minimize2, Printer, RefreshCw, Send, StickyNote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';


export default function PaymentsPage() {
    return <PaymentsPageContent />;
}

function PaymentsPageContent() {
    const t = useTranslations('PaymentsPage');
    const { toast } = useToast();
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
        handlePaginationChange,
        refreshPayments
    } = usePaymentsPagination({
        fetchFunction: getPurchasePayments,
        initialPageSize: 50
    });
    const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
    const [selectedPaymentForEmail, setSelectedPaymentForEmail] = React.useState<Payment | null>(null);
    const [emailRecipients, setEmailRecipients] = React.useState('');
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);
    const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
    const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);

    const [selectedPayment, setSelectedPayment] = React.useState<Payment | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [paymentAllocations, setPaymentAllocations] = React.useState<PaymentAllocation[]>([]);
    const [isLoadingAllocations, setIsLoadingAllocations] = React.useState(false);
    const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
    const [selectedPaymentForEdit, setSelectedPaymentForEdit] = React.useState<Payment | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('allocations');
    const [isRightExpanded, setIsRightExpanded] = React.useState(false);

    const handleCreatePrepaid = React.useCallback(() => {
        setIsPrepaidDialogOpen(true);
    }, []);

    const handlePrintPayment = React.useCallback(async (payment: Payment) => {
        const fileName = getDocumentFileName(payment, 'payment');
        toast({
            title: "Generating PDF",
            description: `Preparing PDF for Payment #${fileName}...`,
        });

        try {
            const blob = await api.getBlob(API_ROUTES.PURCHASES.API_PAYMENT_PRINT, { transaction_id: payment.transaction_id || payment.id, transaction_type: payment.transaction_type });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast({
                title: "Download Started",
                description: `Your PDF for Payment #${fileName} is downloading.`,
            });

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Print Error',
                description: error instanceof Error ? error.message : 'Could not print the payment.',
            });
        }
    }, [toast]);

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
                setActiveTab('allocations');
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
        setSelectedPaymentForEmail(payment);
        setEmailRecipients(payment.userEmail || '');
        setIsSendEmailDialogOpen(true);
    }, []);

    const handleEditPaymentClick = React.useCallback((payment: Payment) => {
        setSelectedPaymentForEdit(payment);
        setIsEditDialogOpen(true);
    }, []);

    const handleConfirmSendEmail = async () => {
        if (!selectedPaymentForEmail) return;

        const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
        if (emails.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter at least one recipient email.' });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emails.filter(email => !emailRegex.test(email));

        if (invalidEmails.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Invalid Email Address',
                description: `The following emails are invalid: ${invalidEmails.join(', ')}`,
            });
            return;
        }

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
            await api.post(API_ROUTES.PURCHASES.API_PAYMENT_SEND, {
                transaction_id: selectedPaymentForEmail.transaction_id || selectedPaymentForEmail.id,
                transaction_type: selectedPaymentForEmail.transaction_type,
                emails,
            });

            toast({
                title: 'Email Sent',
                description: `The payment receipt has been successfully sent to ${emails.join(', ')}.`,
            });

            setIsSendEmailDialogOpen(false);

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
            });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleWarningConfirm = async () => {
        if (!selectedPaymentForEmail) return;
        const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
        await sendEmail(emails);
        setIsWarningDialogOpen(false);
    };

    const paymentTabs = React.useMemo<VerticalTab[]>(() => [
        { id: 'allocations', icon: CreditCard, label: t('tabs.allocations') },
        { id: 'notes', icon: StickyNote, label: t('tabs.notes') },
    ], [t]);

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
                        manualPagination={true}
                        onRowSelectionChange={handleRowSelectionChange}
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        title={t('title')}
                        description={t('description')}
                        className="h-full"
                        isCompact={!!selectedPayment}
                    />
                }
                rightPanel={
                    selectedPayment && (
                        <Card className="h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0">
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
                                                        currency: selectedPayment.currency || selectedPayment.source_currency || 'USD',
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
                                                    {formatDateTime(selectedPayment.payment_date || selectedPayment.createdAt)}
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
                            <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handlePrintPayment(selectedPayment)}>
                                    <Printer className="h-3.5 w-3.5" />
                                    {t('actions.print')}
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendEmailClick(selectedPayment)}>
                                    <Send className="h-3.5 w-3.5" />
                                    {t('actions.sendEmail')}
                                </Button>
                            </div>
                            <CardContent className="flex-1 flex flex-col overflow-hidden p-0 min-h-0 bg-card">
                                <VerticalTabStrip
                                    tabs={paymentTabs}
                                    activeTabId={activeTab}
                                    onTabClick={(tab) => setActiveTab(tab.id)}
                                />
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
                            </CardContent>
                        </Card>
                    )
                }
            />

            <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send Payment Receipt by Email</DialogTitle>
                        <DialogDescription>Enter the recipient emails for payment #{selectedPaymentForEmail?.id}.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="email-recipients">Recipients</Label>
                        <Input
                            id="email-recipients"
                            value={emailRecipients}
                            onChange={(e) => setEmailRecipients(e.target.value)}
                            placeholder="email1@example.com, email2@example.com"
                        />
                        <p className="text-sm text-muted-foreground mt-1">Separate multiple emails with commas.</p>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
                            {isSendingEmail ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                'Send Email'
                            )}
                        </Button>
                        <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)} disabled={isSendingEmail}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
        </div>
    );
}
