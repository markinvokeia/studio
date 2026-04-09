
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { ExchangeRateColumnsWrapper } from './columns';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { ExchangeRateHistoryResponse, ExchangeRateHistoryItem } from '@/lib/types';
import { PaginationState } from '@tanstack/react-table';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw, DollarSign, History } from 'lucide-react';

export default function CurrenciesPage() {
    const t = useTranslations('CurrenciesPage');
    const { toast } = useToast();

    const [data, setData] = React.useState<ExchangeRateHistoryItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [totalCount, setTotalCount] = React.useState(0);
    const [totalPages, setTotalPages] = React.useState(0);
    const [selectedItem, setSelectedItem] = React.useState<ExchangeRateHistoryItem | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
    const [startDate, setStartDate] = React.useState<string>('');
    const [endDate, setEndDate] = React.useState<string>('');

    const fetchExchangeRates = React.useCallback(async (pageOverride?: number) => {
        try {
            setIsLoading(true);
            const query: any = {
                page: pageOverride !== undefined ? pageOverride + 1 : pagination.pageIndex + 1, // API uses 1-based indexing
                limit: pagination.pageSize,
            };

            if (startDate) query.start_date = startDate;
            if (endDate) query.end_date = endDate;

            const response = await api.getExchangeRateHistory(query);

            if (response && typeof response === 'object' && 'metadata' in response && 'data' in response) {
                setData(response.data || []);
                setTotalCount(response.metadata.total_registros || 0);
                setTotalPages(response.metadata.total_paginas || 0);
            } else {
                console.warn('Unexpected response format:', response);
                setData([]);
                setTotalCount(0);
                setTotalPages(0);
            }
        } catch (error) {
            console.error('Failed to fetch exchange rates:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load exchange rate history. Please try again.',
            });
            setData([]);
            setTotalCount(0);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.pageIndex, pagination.pageSize, startDate, endDate, toast]);

    const handleViewDetails = React.useCallback((item: ExchangeRateHistoryItem) => {
        setSelectedItem(item);
        setIsDetailsModalOpen(true);
    }, []);

    const handleRefresh = React.useCallback(() => {
        fetchExchangeRates();
    }, [fetchExchangeRates]);

    const handleApplyFilters = React.useCallback(() => {
        // Reset to first page when applying filters
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
        // The useEffect will automatically trigger fetchExchangeRates when pagination changes
    }, []);



    const columns = ExchangeRateColumnsWrapper(handleViewDetails);

    const customToolbar = React.useMemo(() => (
        <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2">
                <Label htmlFor="start-date">{t('startDate')}</Label>
                <DatePickerInput
                    value={startDate}
                    onChange={(value) => setStartDate(value)}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="end-date">{t('endDate')}</Label>
                <DatePickerInput
                    value={endDate}
                    onChange={(value) => setEndDate(value)}
                />
            </div>
            <Button onClick={handleApplyFilters} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('applyFilters')}
            </Button>
        </div>
    ), [startDate, endDate, handleApplyFilters, isLoading, t]);

    React.useEffect(() => {
        fetchExchangeRates();
    }, [fetchExchangeRates]);



    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-1 gap-4">
            <Card className="flex-none border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="bg-card">
                    <div className="space-y-2">
                        <h3 className="font-semibold">{t('baseCurrency')}</h3>
                        <Badge variant="secondary">UYU (Pesos Uruguayos)</Badge>
                    </div>
                </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="flex-none p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <History className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <CardTitle className="text-lg">{t('exchangeRateHistory')}</CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
                    <DataTable
                        columns={columns}
                        data={data}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        manualPagination={true}
                        pageCount={totalPages}
                        isRefreshing={isLoading}
                        onRefresh={handleRefresh}
                        customToolbar={customToolbar}
                        columnTranslations={{
                            fecha: t('columns.date'),
                            usd_compra: t('columns.usdBuy'),
                            usd_venta: t('columns.usdSell'),
                            usd_promedio: t('columns.usdAverage'),
                            actions: t('columns.actions'),
                        }}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t('detailsModal.title')} - {selectedItem ? new Date(selectedItem.fecha).toLocaleDateString('es-ES') : ''}
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-96">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {selectedItem?.datos_completos.cotizaciones.map((cotizacion, index) => (
                                    <div key={index} className="p-4 border rounded-lg">
                                        <h3 className="font-semibold text-lg">{cotizacion.moneda}</h3>
                                        <div className="space-y-2 mt-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-muted-foreground">{t('detailsModal.buy')}:</span>
                                                <span className="font-medium">${cotizacion.compra.toFixed(4)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-muted-foreground">{t('detailsModal.sell')}:</span>
                                                <span className="font-medium">${cotizacion.venta.toFixed(4)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-muted-foreground">{t('detailsModal.code')}:</span>
                                                <span className="font-medium">{cotizacion.codigo}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
