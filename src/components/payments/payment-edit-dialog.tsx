'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Payment, PaymentMethod } from '@/lib/types';
import api from '@/services/api';
import { mapApiPaymentToPayment } from '@/services/payments-service';

interface PaymentEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: Payment | null;
    onSuccess?: (updatedPayment?: Payment) => void | Promise<void>;
}

async function getPaymentMethods(): Promise<PaymentMethod[]> {
    const data = await api.get(API_ROUTES.CASHIER.PAYMENT_METHODS);
    const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);

    return methodsData.map((method: PaymentMethod) => ({
        ...method,
        id: String(method.id),
    }));
}

function formatPaymentAmount(payment: Payment | null): string {
    if (!payment) return '';

    const amount = Math.abs(Number(payment.source_amount ?? payment.amount ?? payment.amount_applied ?? 0));
    const currency = payment.source_currency || payment.currency || 'USD';

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function getEditPaymentErrorDescription(error: unknown, t: (key: string) => string): string {
    const status = (error as { status?: number } | null)?.status;

    if (status === 400) {
        return t('editDialog.errors.closedCashSession');
    }

    if (status === 404) {
        return t('editDialog.errors.notFound');
    }

    return error instanceof Error ? error.message : t('editDialog.errors.generic');
}

function mapUpdatedPaymentResponse(response: unknown): Payment | undefined {
    if (!response || typeof response !== 'object') return undefined;

    const responseData = response as {
        data?: unknown;
        payment?: unknown;
        updated_payment?: unknown;
    };
    const candidate = responseData.payment ?? responseData.updated_payment ?? responseData.data ?? response;

    if (!candidate || typeof candidate !== 'object') return undefined;

    try {
        return mapApiPaymentToPayment(candidate);
    } catch {
        return undefined;
    }
}

export function PaymentEditDialog({ open, onOpenChange, payment, onSuccess }: PaymentEditDialogProps) {
    const t = useTranslations('PaymentsPage');
    const { toast } = useToast();
    const { checkActiveSession } = useAuth();
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
    const [paymentMethodId, setPaymentMethodId] = React.useState('');
    const [isLoadingMethods, setIsLoadingMethods] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) return;

        let cancelled = false;

        setPaymentMethodId(payment?.payment_method_id || '');
        setErrorMessage(null);
        setIsLoadingMethods(true);

        getPaymentMethods()
            .then((methods) => {
                if (!cancelled) setPaymentMethods(methods);
            })
            .catch((error) => {
                if (!cancelled) {
                    setPaymentMethods([]);
                    setErrorMessage(error instanceof Error ? error.message : t('editDialog.errors.loadMethods'));
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoadingMethods(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, payment?.payment_method_id, t]);

    const handleSave = async () => {
        if (!payment || !paymentMethodId) return;

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const response = await api.post(API_ROUTES.PAYMENTS_EDIT, {
                id: payment.id,
                payment_method_id: paymentMethodId,
            });
            const updatedPayment = mapUpdatedPaymentResponse(response);

            await checkActiveSession();

            toast({
                title: t('editDialog.toasts.successTitle'),
                description: t('editDialog.toasts.successDescription'),
            });

            await onSuccess?.(updatedPayment);
            onOpenChange(false);
        } catch (error) {
            const description = getEditPaymentErrorDescription(error, t);
            setErrorMessage(description);
            toast({
                variant: 'destructive',
                title: t('editDialog.toasts.errorTitle'),
                description,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('editDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('editDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-4 px-6 py-4">
                    {errorMessage && (
                        <Alert variant="destructive">
                            <AlertTitle>{t('editDialog.errors.title')}</AlertTitle>
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>{t('editDialog.payment')}</Label>
                            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                                {payment?.doc_no || payment?.payment_doc_no || payment?.id || 'N/A'}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{t('editDialog.amount')}</Label>
                            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                                {formatPaymentAmount(payment)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t('editDialog.amountLocked')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>{t('editDialog.paymentMethod')}</Label>
                        <Select
                            value={paymentMethodId}
                            onValueChange={setPaymentMethodId}
                            disabled={isLoadingMethods || isSaving}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={isLoadingMethods ? t('editDialog.loadingMethods') : t('editDialog.selectMethod')} />
                            </SelectTrigger>
                            <SelectContent>
                                {paymentMethods.map((method) => (
                                    <SelectItem key={method.id} value={method.id}>
                                        {method.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {t('editDialog.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={!paymentMethodId || isLoadingMethods || isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('editDialog.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
