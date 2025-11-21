'use client';

import * as React from 'react';
import { Payment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PaymentsTable } from '@/components/tables/payments-table';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

async function getPayments(): Promise<Payment[]> {
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/all_payments?is_sales=false`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.id ? String(apiPayment.id) : `pay_${Math.random().toString(36).substr(2, 9)}`,
            order_id: apiPayment.order_id,
            invoice_id: apiPayment.invoice_id,
            quote_id: apiPayment.quote_id,
            user_name: apiPayment.user_name || 'N/A',
            userEmail: apiPayment.user_email,
            amount: apiPayment.amount || 0,
            method: apiPayment.method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.updatedAt || new Date().toISOString().split('T')[0],
            currency: apiPayment.currency || 'URU',
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
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/payment/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: payment.id }),
            });

            if (response.status >= 400) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to generate PDF.' }));
                throw new Error(errorData.message);
            }

            if (!response.ok) {
                throw new Error('An unexpected error occurred while generating the PDF.');
            }

            const blob = await response.blob();
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
            const token = localStorage.getItem('token');
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/payment/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ paymentId: selectedPaymentForEmail.id, emails }),
            });

            if (!response.ok) {
                throw new Error('Failed to send email.');
            }

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
