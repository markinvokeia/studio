
'use client';

import { PaymentsTable } from '@/components/tables/payments-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_ROUTES } from '@/constants/routes';
import { usePaymentsPagination } from '@/hooks/use-payments-pagination';
import { useToast } from '@/hooks/use-toast';
import { getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchasePayments, Payment } from '@/services/payments-service';
import { useTranslations } from 'next-intl';
import * as React from 'react';


export default function PaymentsPage() {
    const t = useTranslations('PaymentsPage');
    const { toast } = useToast();
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



    const handlePrintPayment = async (payment: Payment) => {
        const fileName = getDocumentFileName(payment, 'payment');
        toast({
            title: "Generating PDF",
            description: `Preparing PDF for Payment #${fileName}...`,
        });

        try {
            const blob = await api.getBlob(API_ROUTES.PURCHASES.API_PAYMENT_PRINT, { paymentId: payment.id });
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
                        onRefresh={refreshPayments}
                        isRefreshing={isLoading}
                        onPrint={handlePrintPayment}
                        onSendEmail={handleSendEmailClick}
                        pagination={pagination}
                        onPaginationChange={handlePaginationChange}
                        pageCount={totalPages}
                        manualPagination={true}
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
        </div>
    );
}
