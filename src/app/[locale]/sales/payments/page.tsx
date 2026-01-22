
'use client';

import { PaymentsTable } from '@/components/tables/payments-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Payment, PaymentMethod, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { AlertTriangle, CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
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
});

type PrepaidFormValues = z.infer<ReturnType<typeof prepaidFormSchema>>;

async function getPayments(): Promise<Payment[]> {
    try {
        const data = await api.get(API_ROUTES.SALES.PAYMENTS_ALL, { is_sales: 'true' });
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.id ? String(apiPayment.id) : `pay_${Math.random().toString(36).substr(2, 9)}`,
            doc_no: apiPayment.doc_no || `PAY-${apiPayment.id}`,
            order_id: apiPayment.order_id,
            invoice_id: apiPayment.invoice_id,
            quote_id: apiPayment.quote_id,
            user_name: apiPayment.user_name || 'N/A',
            userEmail: apiPayment.user_email,
            amount: parseFloat(apiPayment.amount) || 0,
            method: apiPayment.method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.updatedAt || new Date().toISOString().split('T')[0],
            currency: apiPayment.currency || 'USD',
            payment_date: apiPayment.created_at,
            amount_applied: parseFloat(apiPayment.converted_amount) || 0,
            source_amount: parseFloat(apiPayment.amount) || 0,
            source_currency: apiPayment.currency || 'USD',
            exchange_rate: parseFloat(apiPayment.exchange_rate) || 0,
            payment_method: apiPayment.payment_method,
            transaction_type: apiPayment.transaction_type,
            transaction_id: apiPayment.transaction_id,
            reference_doc_id: apiPayment.reference_doc_id,
        }));
    } catch (error) {
        console.error("Failed to fetch payments:", error);
        return [];
    }
}

async function getUsers(): Promise<User[]> {
    try {
        const responseData = await api.get(API_ROUTES.USERS, { filter_type: 'PACIENTE' });

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

        return usersData.map((apiUser: any) => ({
            id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
            name: apiUser.name || 'No Name',
            email: apiUser.email || 'no-email@example.com',
            phone_number: apiUser.phone_number || '000-000-0000',
            is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
            avatar: '',
            identity_document: ''
        }));
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}

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
    const { user } = useAuth();
    const [payments, setPayments] = React.useState<Payment[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
    const [selectedPaymentForEmail, setSelectedPaymentForEmail] = React.useState<Payment | null>(null);
    const [emailRecipients, setEmailRecipients] = React.useState('');
    const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
    const [isConfirmPrepaidOpen, setIsConfirmPrepaidOpen] = React.useState(false);
    const [prepaidData, setPrepaidData] = React.useState<PrepaidFormValues | null>(null);
    const [users, setUsers] = React.useState<User[]>([]);
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);

    const form = useForm<PrepaidFormValues>({
        resolver: zodResolver(prepaidFormSchema(tValidation)),
        defaultValues: {
            user_id: '',
            payment_amount: 0,
            payment_method_id: '',
            created_at: new Date(),
            currency: 'UYU'
        }
    });

    const loadPayments = React.useCallback(async () => {
        setIsLoading(true);
        const fetchedPayments = await getPayments();
        setPayments(fetchedPayments);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    const handlePrintPayment = async (payment: Payment) => {
        toast({
            title: "Generating PDF",
            description: `Preparing PDF for Payment #${payment.id}...`,
        });

        try {
            const blob = await api.getBlob(API_ROUTES.SALES.API_PAYMENT_PRINT, { paymentId: payment.id });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Payment-${payment.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast({
                title: "Download Started",
                description: `Your PDF for Payment #${payment.id} is downloading.`,
            });

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Print Error',
                description: error instanceof Error ? error.message : 'Could not print the payment.',
            });
        }
    };

    const handleSendEmailClick = (payment: Payment) => {
        setSelectedPaymentForEmail(payment);
        setEmailRecipients(payment.userEmail || '');
        setIsSendEmailDialogOpen(true);
    };

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

        try {
            await api.post(API_ROUTES.SALES.API_PAYMENT_SEND, { paymentId: selectedPaymentForEmail.id, emails });

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
        }
    };

    const handleCreatePrepaid = async () => {
        form.reset();
        setSubmissionError(null);
        const [fetchedUsers, fetchedMethods] = await Promise.all([getUsers(), getPaymentMethods()]);
        setUsers(fetchedUsers);
        setPaymentMethods(fetchedMethods);
        setIsPrepaidDialogOpen(true);
    };

    const onPrepaidSubmit = (data: PrepaidFormValues) => {
        setPrepaidData(data);
        setIsConfirmPrepaidOpen(true);
    };

    const handleConfirmPrepaid = async () => {
        if (!prepaidData || !user) return;

        try {
            const sessionData = await api.get(API_ROUTES.CASHIER.SESSIONS_ACTIVE, { user_id: user.id });
            if (sessionData.code !== 200 || !sessionData.data?.id) {
                throw new Error("No active cash session found. Please open a session first.");
            }

            const selectedMethod = paymentMethods.find(pm => pm.id === prepaidData.payment_method_id);
            const clientUser = users.find(u => u.id === prepaidData.user_id);

            const payload = {
                cash_session_id: sessionData.data.id,
                user: user,
                client_user: clientUser,
                query: JSON.stringify({
                    payment_date: prepaidData.created_at.toISOString(),
                    amount: prepaidData.payment_amount,
                    method: selectedMethod?.name,
                    payment_method_id: prepaidData.payment_method_id,
                    status: 'completed',
                    user_id: prepaidData.user_id,
                    is_sales: true,
                    is_prepaid: true,
                    invoice_currency: prepaidData.currency,
                    payment_currency: prepaidData.currency,
                    exchange_rate: 1
                }),
            };

            await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, payload);

            toast({ title: t('prepaidDialog.toasts.successTitle'), description: t('prepaidDialog.toasts.successDescription') });
            setIsPrepaidDialogOpen(false);
            setIsConfirmPrepaidOpen(false);
            loadPayments();

        } catch (error) {
            toast({ variant: 'destructive', title: t('prepaidDialog.toasts.errorTitle'), description: error instanceof Error ? error.message : t('prepaidDialog.toasts.errorDescription') });
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pr-2 pb-4">
            <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="flex-none">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <PaymentsTable
                        payments={payments}
                        isLoading={isLoading}
                        onRefresh={loadPayments}
                        isRefreshing={isLoading}
                        onPrint={handlePrintPayment}
                        onSendEmail={handleSendEmailClick}
                        onCreate={handleCreatePrepaid}
                        columnsToHide={['transaction_type']}
                    />
                </CardContent>
            </Card>

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
                        <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmSendEmail}>Send Email</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPrepaidDialogOpen} onOpenChange={setIsPrepaidDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('prepaidDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onPrepaidSubmit)} className="space-y-4">
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
                                                <Command>
                                                    <CommandInput placeholder={t('prepaidDialog.searchClient')} />
                                                    <CommandList>
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
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-3 gap-4">
                                <FormField control={form.control} name="payment_amount" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>{t('prepaidDialog.amount')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>{t('prepaidDialog.pickDate')}</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
