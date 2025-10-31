

'use client';

import * as React from 'react';
import { Payment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PaymentsTable } from '@/components/tables/payments-table';
import { useTranslations } from 'next-intl';

async function getPayments(): Promise<Payment[]> {
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/all_payments`, {
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
            amount: apiPayment.amount || 0,
            method: apiPayment.method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.updatedAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch payments:", error);
        return [];
    }
}

export default function PaymentsPage() {
    const t = useTranslations('PaymentsPage');
    const [payments, setPayments] = React.useState<Payment[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    const loadPayments = React.useCallback(async () => {
        setIsLoading(true);
        const fetchedPayments = await getPayments();
        setPayments(fetchedPayments);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    return (
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
                />
            </CardContent>
        </Card>
    );
}
