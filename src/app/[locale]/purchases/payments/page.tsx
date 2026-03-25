'use client';

import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { PaymentAllocationsTable } from '@/components/tables/payment-allocations-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { usePaymentsPagination } from '@/hooks/use-payments-pagination';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Payment, PaymentAllocation } from '@/lib/types';
import { getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchasePayments } from '@/services/payments-service';
import { RowSelectionState } from '@tanstack/react-table';
import { CreditCard, Loader2, RefreshCw, X } from 'lucide-react';
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
    }, [loadPaymentAllocations]);

    const handleCloseDetails = React.useCallback(() => {
        setSelectedPayment(null);
        setPaymentAllocations([]);
        setRowSelection({});
    }, []);

    const handleSendEmailClick = React.useCallback((payment: Payment) => {
        setSelectedPaymentForEmail(payment);
        setEmailRecipients(payment.userEmail || '');
        setIsSendEmailDialogOpen(true);
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
            await api.post(API_ROUTES.PURCHASES.API_PAYMENT_SEND, { paymentId: selectedPaymentForEmail.id, emails });

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

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                isRightPanelOpen={!!selectedPayment}
                leftPanel={
                    <PaymentsTable
                        payments={payments}
                        isLoading={isLoading}
                        onRefresh={refreshPayments}
                        isRefreshing={isLoading}
                        onPrint={handlePrintPayment}
                        onSendEmail={handleSendEmailClick}
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
                    />
                }
                rightPanel={
                    selectedPayment && (
                        <Card className="h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0">
                            <CardHeader className="flex flex-row items-start justify-between flex-none p-4">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="header-icon-circle mt-0.5">
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col truncate text-left">
                                        <CardTitle className="text-lg lg:text-xl truncate">{t('detailsFor', { name: selectedPayment.user_name })}</CardTitle>
                                        <CardDescription className="text-xs">{t('prepaidId')}: {selectedPayment.doc_no || selectedPayment.id}</CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                    <X className="h-5 w-5" />
                                    <span className="sr-only">{t('close')}</span>
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 pt-0">
                                <Tabs defaultValue="allocations" className="flex-1 flex flex-col min-h-0">
                                    <TabsList>
                                        <TabsTrigger value="allocations" className="text-xs">{t('tabs.allocations')}</TabsTrigger>
                                        <TabsTrigger value="notes" className="text-xs">{t('tabs.notes')}</TabsTrigger>
                                    </TabsList>
                                    <div className="flex-1 min-h-0 mt-4 flex flex-col overflow-hidden">
                                        <TabsContent value="allocations" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
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
                                        </TabsContent>
                                        <TabsContent value="notes" className="m-0 flex-1 min-h-0 p-4">
                                            {selectedPayment?.notes ? (
                                                <div className="whitespace-pre-wrap text-sm">{selectedPayment.notes}</div>
                                            ) : (
                                                <p className="text-muted-foreground text-sm">{t('notes.noNotes')}</p>
                                            )}
                                        </TabsContent>
                                    </div>
                                </Tabs>
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
        </div>
    );
}
