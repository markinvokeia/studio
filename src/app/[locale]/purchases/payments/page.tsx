
'use client';

import { PaymentsTable } from '@/components/tables/payments-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Payment } from '@/lib/types';
import { api } from '@/services/api';
import { useTranslations } from 'next-intl';
import * as React from 'react';

async function getPayments(): Promise<Payment[]> {
    try {
        const data = await api.get(API_ROUTES.PURCHASES.PAYMENTS_ALL, { is_sales: 'false' });
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.id ? String(apiPayment.id) : `pay_${Math.random().toString(36).substr(2, 9)}`,
            order_id: apiPayment.order_id,
            invoice_id: apiPayment.invoice_id,
            quote_id: apiPayment.quote_id,
            user_name: apiPayment.user_name || 'N/A',
            userEmail: apiPayment.user_email,
            amount: parseFloat(apiPayment.amount) || 0,
            method: apiPayment.payment_method || 'credit_card',
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

export default function PaymentsPage() {
    const t = useTranslations('PaymentsPage');
    const { toast } = useToast();
    const [payments, setPayments] = React.useState<Payment[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
    const [selectedPaymentForEmail, setSelectedPaymentForEmail] = React.useState<Payment | null>(null);
    const [emailRecipients, setEmailRecipients] = React.useState('');

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
            const blob = await api.getBlob(API_ROUTES.PURCHASES.API_PAYMENT_PRINT, { paymentId: payment.id });
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
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <PaymentsTable
                        payments={payments}
                        isLoading={isLoading}
                        onRefresh={loadPayments}
                        isRefreshing={isLoading}
                        onPrint={handlePrintPayment}
                        onSendEmail={handleSendEmailClick}
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
        </>
    );
}
