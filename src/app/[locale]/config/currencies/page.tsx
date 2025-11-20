
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { ExchangeRateColumnsWrapper } from './columns';
import { Badge } from '@/components/ui/badge';

const MOCK_RATE_HISTORY = [
    { date: '2024-07-29', from: 'USD', to: 'UYU', rate: 39.50 },
    { date: '2024-07-28', from: 'USD', to: 'UYU', rate: 39.45 },
    { date: '2024-07-29', from: 'EUR', to: 'UYU', rate: 42.80 },
    { date: '2024-07-28', from: 'EUR', to: 'UYU', rate: 42.75 },
    { date: '2024-07-29', from: 'ARP', to: 'UYU', rate: 0.04 },
    { date: '2024-07-28', from: 'ARP', to: 'UYU', rate: 0.041 },
];

export default function CurrenciesPage() {
    const t = useTranslations('CurrenciesPage');
    const columns = ExchangeRateColumnsWrapper();

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <h3 className="font-semibold">{t('baseCurrency')}</h3>
                        <Badge variant="secondary">UYU (Pesos Uruguayos)</Badge>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>{t('exchangeRateHistory')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={MOCK_RATE_HISTORY}
                        filterColumnId="date"
                        filterPlaceholder={t('filterPlaceholder')}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
