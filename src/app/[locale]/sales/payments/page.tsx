'use client';

import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { PaymentEditDialog } from '@/components/payments/payment-edit-dialog';
import { PaymentAllocationsTable } from '@/components/tables/payment-allocations-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePickerInput } from '@/components/ui/date-picker';
import { DetailHeader } from '@/components/ui/detail-header';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VerticalTabStrip, type VerticalTab } from '@/components/ui/vertical-tab-strip';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { usePaymentsPagination } from '@/hooks/use-payments-pagination';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/usePermissions';
import { Payment, PaymentAllocation, PaymentMethod, User } from '@/lib/types';
import { cn, formatDateTime, getDocumentFileName } from '@/lib/utils';
import api from '@/services/api';
import { getSalesPayments } from '@/services/payments-service';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { format, formatISO, parseISO } from 'date-fns';
import { AlertTriangle, Check, ChevronsUpDown, CreditCard, Loader2, Maximize2, Minimize2, Printer, RefreshCw, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const prepaidFormSchema = (t: (key: string) => string) => z.object({
    user_id: z.string().min(1, t('validation.userRequired')),
    payment_amount: z.coerce.number().positive(t('validation.amountPositive')),
    payment_method_id: z.string().min(1, t('validation.methodRequired')),
    created_at: z.date({
        required_error: t('validation.dateRequired'),
    }),
    currency: z.enum(['UYU', 'USD']),
    notes: z.string().optional(),
    is_historical: z.boolean().default(false),
});

type PrepaidFormValues = z.infer<ReturnType<typeof prepaidFormSchema>>;


async function getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.PAYMENT_METHODS);
        const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
        return methodsData.map((m: any) => ({ ...m, id: String(m.id) }));
    } catch (error) {
        console.error("Failed to fetch payment methods:", error);
        return [];
    }
}


export default function PaymentsPage() {
    const t = useTranslations('PaymentsPage');
    const tValidation = useTranslations('InvoicesPage');
    const { toast } = useToast();
    const { user, checkActiveSession } = useAuth();
    const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
    const { hasPermission } = usePermissions();

    // Permission checks
    const canViewList = hasPermission(SALES_PERMISSIONS.PAYMENTS_VIEW_LIST);
    const canCreate = hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE);
    const canUseCredits = hasPermission(SALES_PERMISSIONS.PAYMENTS_USE_CREDITS);
    const canViewDetail = hasPermission(SALES_PERMISSIONS.PAYMENTS_VIEW_DETAIL);
    const canPrepaidCreate = hasPermission(SALES_PERMISSIONS.PREPAYMENTS_CREATE);
    const canPrepaidView = hasPermission(SALES_PERMISSIONS.PREPAYMENTS_VIEW);

    const {
        payments,
        isLoading,
        pagination,
        totalPages,
        handlePaginationChange,
        refreshPayments
    } = usePaymentsPagination({
        fetchFunction: getSalesPayments,
        initialPageSize: 50
    });

    const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
    const [selectedPaymentForEmail, setSelectedPaymentForEmail] = React.useState<Payment | null>(null);
    const [emailRecipients, setEmailRecipients] = React.useState('');
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);
    const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
    const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);
    const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
    const [isConfirmPrepaidOpen, setIsConfirmPrepaidOpen] = React.useState(false);
    const [prepaidData, setPrepaidData] = React.useState<PrepaidFormValues | null>(null);
    const [users, setUsers] = React.useState<User[]>([]);
    const [userSearchTerm, setUserSearchTerm] = React.useState('');
    const debouncedUserSearch = useDebounce(userSearchTerm, 300);
    const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);

    const [selectedPayment, setSelectedPayment] = React.useState<Payment | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [paymentAllocations, setPaymentAllocations] = React.useState<PaymentAllocation[]>([]);
    const [isLoadingAllocations, setIsLoadingAllocations] = React.useState(false);
    const [selectedPaymentForEdit, setSelectedPaymentForEdit] = React.useState<Payment | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('allocations');
    const [isRightExpanded, setIsRightExpanded] = React.useState(false);

    const form = useForm<PrepaidFormValues>({
        resolver: zodResolver(prepaidFormSchema(tValidation)),
        defaultValues: {
            user_id: '',
            payment_amount: 0,
            payment_method_id: '',
            created_at: new Date(),
            currency: 'UYU',
            notes: '',
            is_historical: false
        }
    });

    const loadPaymentAllocations = React.useCallback(async (paymentId: string) => {
        setIsLoadingAllocations(true);
        try {
            const data = await api.get(API_ROUTES.SALES.PAYMENT_ALLOCATIONS, { payment_id: paymentId });
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

    React.useEffect(() => {
        let isCancelled = false;
        const fetchUsers = async () => {
            if (!isPrepaidDialogOpen) return;
            setIsLoadingUsers(true);
            try {
                const queryParams: Record<string, string> = {
                    filter_type: 'PACIENTE',
                };
                if (debouncedUserSearch && debouncedUserSearch.trim()) {
                    queryParams.search = debouncedUserSearch.trim();
                }
                const responseData = await api.get(API_ROUTES.USERS, queryParams);

                let usersData = [];
                if (Array.isArray(responseData) && responseData.length > 0) {
                    const firstElement = responseData[0];
                    if (firstElement.json && typeof firstElement.json === 'object') {
                        usersData = firstElement.json.data || [];
                    } else if (firstElement.data) {
                        usersData = firstElement.data;
                    } else {
                        usersData = responseData;
                    }
                } else if (typeof responseData === 'object' && responseData !== null && responseData.data) {
                    usersData = responseData.data;
                } else if (Array.isArray(responseData)) {
                    usersData = responseData;
                }

                if (!isCancelled) {
                    setUsers(usersData.map((apiUser: any) => ({
                        id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
                        name: apiUser.name || 'No Name',
                        email: apiUser.email || 'no-email@example.com',
                        phone_number: apiUser.phone_number || '000-000-0000',
                        is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
                        avatar: '',
                        identity_document: ''
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch users:", error);
                if (!isCancelled) setUsers([]);
            } finally {
                if (!isCancelled) setIsLoadingUsers(false);
            }
        };

        fetchUsers();
        return () => { isCancelled = true; };
    }, [debouncedUserSearch, isPrepaidDialogOpen]);

    React.useEffect(() => {
        if (!isPrepaidDialogOpen) {
            setUserSearchTerm('');
            setUsers([]);
        }
    }, [isPrepaidDialogOpen]);

    const handlePrintPayment = React.useCallback(async (payment: Payment) => {
        const fileName = getDocumentFileName(payment, 'payment');
        toast({
            title: "Generating PDF",
            description: `Preparing PDF for Payment #${fileName}...`,
        });

        try {
            const blob = await api.getBlob(API_ROUTES.SALES.API_PAYMENT_PRINT, { transaction_id: payment.transaction_id || payment.id, transaction_type: payment.transaction_type });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast({
                title: t('prepaidDialog.toasts.successTitle'),
                description: t('prepaidDialog.toasts.successDescription'),
            });

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Print Error',
                description: error instanceof Error ? error.message : 'Could not print the payment.',
            });
        }
    }, [t, toast]);

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
            await api.post(API_ROUTES.SALES.API_PAYMENT_SEND, {
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

    const handleCreatePrepaid = async () => {
        form.reset();
        setSubmissionError(null);
        setUserSearchTerm('');
        setUsers([]);
        const fetchedMethods = await getPaymentMethods();
        setPaymentMethods(fetchedMethods);
        setIsPrepaidDialogOpen(true);
    };

    const onPrepaidSubmit = (data: PrepaidFormValues) => {
        setPrepaidData(data);
        setIsConfirmPrepaidOpen(true);
    };

    const paymentTabs = React.useMemo<VerticalTab[]>(() => [
        { id: 'allocations', icon: CreditCard, label: t('tabs.allocations') },
        { id: 'notes', icon: AlertTriangle, label: t('tabs.notes') },
    ], [t]);

    const handleConfirmPrepaid = async () => {
        if (!prepaidData || !user) return;

        try {
            let sessionId: string | null = null;
            
            if (!prepaidData.is_historical) {
                const sessionValidation = await validateActiveSession();
                if (!sessionValidation.isValid) {
                    showCashSessionError(sessionValidation.error);
                    return;
                }
                sessionId = sessionValidation.sessionId ?? null;
            }

            const selectedMethod = paymentMethods.find(pm => pm.id === prepaidData.payment_method_id);
            const clientUser = users.find(u => u.id === prepaidData.user_id);

            const payload = {
                cash_session_id: sessionId,
                user: user,
                client_user: clientUser,
                query: {
                    payment_date: formatISO(prepaidData.created_at),
                    amount: prepaidData.payment_amount,
                    method: selectedMethod?.name,
                    payment_method_id: prepaidData.payment_method_id,
                    status: 'completed',
                    user_id: prepaidData.user_id,
                    is_sales: true,
                    is_prepaid: true,
                    invoice_currency: prepaidData.currency,
                    payment_currency: prepaidData.currency,
                    exchange_rate: 1,
                    notes: prepaidData.notes || '',
                    is_historical: prepaidData.is_historical,
                },
            };

            await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, payload);

            toast({ title: t('prepaidDialog.toasts.successTitle'), description: t('prepaidDialog.toasts.successDescription') });
            await checkActiveSession();
            setIsPrepaidDialogOpen(false);
            setIsConfirmPrepaidOpen(false);
            refreshPayments();

        } catch (error) {
            toast({ variant: 'destructive', title: t('prepaidDialog.toasts.errorTitle'), description: error instanceof Error ? error.message : t('prepaidDialog.toasts.errorDescription') });
        }
    };

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
                        onEdit={canCreate ? handleEditPaymentClick : undefined}
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
                        <Card className={cn('h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0', selectedPayment.is_historical && 'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20')}>
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
                                {selectedPayment.is_historical && (
                                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                        {t('columns.isHistorical')}
                                    </Badge>
                                )}
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
                    <div className="py-4 px-6">
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
                        <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)} disabled={isSendingEmail}>Cancel</Button>
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

            <Dialog open={isPrepaidDialogOpen} onOpenChange={setIsPrepaidDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('prepaidDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onPrepaidSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                <FormField
                                    control={form.control}
                                    name="user_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('prepaidDialog.client')}</FormLabel>
                                            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                            {field.value ? users.find(u => u.id === field.value)?.name : t('prepaidDialog.selectClient')}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command shouldFilter={false}>
                                                        <CommandInput
                                                            placeholder={t('prepaidDialog.searchClient')}
                                                            value={userSearchTerm}
                                                            onValueChange={setUserSearchTerm}
                                                        />
                                                        <CommandList>
                                                            {isLoadingUsers ? (
                                                                <div className="flex items-center justify-center p-4">
                                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                    <span className="text-sm text-muted-foreground">Buscando...</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <CommandEmpty>{t('prepaidDialog.noClient')}</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {users.map((user) => (
                                                                            <CommandItem
                                                                                value={user.name}
                                                                                key={user.id}
                                                                                onSelect={() => {
                                                                                    form.setValue("user_id", user.id);
                                                                                    setIsUserPopoverOpen(false);
                                                                                }}
                                                                            >
                                                                                <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                                {user.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </>
                                                            )}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField control={form.control} name="payment_amount" render={({ field: { onChange, value } }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>{t('prepaidDialog.amount')}</FormLabel>
                                            <FormControl>
                                                <FormattedNumberInput
                                                    value={value}
                                                    onChange={onChange}
                                                    placeholder="0.00"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>{t('prepaidDialog.currency')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="UYU">UYU</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="payment_method_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('prepaidDialog.paymentMethod')}</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder={t('prepaidDialog.selectMethod')} /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {paymentMethods.map(method => <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="created_at"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>{t('prepaidDialog.paymentDate')}</FormLabel>
                                            <FormControl>
                                                <DatePickerInput
                                                    value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                                    onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('prepaidDialog.notes')}</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder={t('prepaidDialog.notesPlaceholder')} {...field} value={field.value || ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_historical"
                                    render={({ field }) => (
                                        <>
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel>
                                                        {t('prepaidDialog.isHistorical')}
                                                    </FormLabel>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t('prepaidDialog.isHistoricalDescription')}
                                                    </p>
                                                </div>
                                            </FormItem>
                                            {field.value && (
                                                <Alert variant="default" className="bg-amber-50 border-amber-200">
                                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                    <AlertTitle className="text-amber-800 text-sm">{t('prepaidDialog.isHistoricalWarning')}</AlertTitle>
                                                    <AlertDescription className="text-amber-700 text-xs">
                                                        {t('prepaidDialog.isHistoricalDescription')}
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </>
                                    )}
                                />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsPrepaidDialogOpen(false)}>{t('prepaidDialog.cancel')}</Button>
                                <Button type="submit">{t('prepaidDialog.save')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isConfirmPrepaidOpen} onOpenChange={setIsConfirmPrepaidOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('prepaidDialog.confirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('prepaidDialog.confirmDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('prepaidDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPrepaid}>{t('prepaidDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
