
'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { useToast } from '@/hooks/use-toast';
import { ExchangeRateHistoryItem } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { DollarSign, History, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function CurrenciesPage() {
    const t = useTranslations('CurrenciesPage');
    const { toast } = useToast();
    const isNarrow = useViewportNarrow();

    const [data, setData] = React.useState<ExchangeRateHistoryItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [totalPages, setTotalPages] = React.useState(0);
    const [selectedItem, setSelectedItem] = React.useState<ExchangeRateHistoryItem | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [startDate, setStartDate] = React.useState<string>('');
    const [endDate, setEndDate] = React.useState<string>('');

    const fetchExchangeRates = React.useCallback(async () => {
        try {
            setIsLoading(true);
            const query: any = {
                page: pagination.pageIndex + 1,
                limit: pagination.pageSize,
            };
            if (startDate) query.start_date = startDate;
            if (endDate) query.end_date = endDate;

            const response = await api.getExchangeRateHistory(query);
            if (response && typeof response === 'object' && 'metadata' in response && 'data' in response) {
                setData(response.data || []);
                setTotalPages(response.metadata.total_paginas || 0);
            } else {
                setData([]);
                setTotalPages(0);
            }
        } catch (error) {
            console.error('Failed to fetch exchange rates:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load exchange rate history.' });
            setData([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.pageIndex, pagination.pageSize, startDate, endDate, toast]);

    const handleApplyFilters = React.useCallback(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, []);

    const handleRowSelection = (rows: ExchangeRateHistoryItem[]) => {
        setSelectedItem(rows[0] ?? null);
    };

    const handleBack = () => {
        setSelectedItem(null);
        setRowSelection({});
    };

    React.useEffect(() => { fetchExchangeRates(); }, [fetchExchangeRates]);

    const columns: ColumnDef<ExchangeRateHistoryItem>[] = React.useMemo(() => [
        { accessorKey: 'fecha', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} /> },
        {
            id: 'usd_compra',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.usdBuy')} />,
            cell: ({ row }) => row.original.datos_completos?.usd_compra ?? '-',
        },
        {
            id: 'usd_venta',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.usdSell')} />,
            cell: ({ row }) => row.original.datos_completos?.usd_venta ?? '-',
        },
        {
            id: 'usd_promedio',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.usdAverage')} />,
            cell: ({ row }) => {
                const c = row.original.datos_completos;
                if (!c?.usd_compra || !c?.usd_venta) return '-';
                return ((c.usd_compra + c.usd_venta) / 2).toFixed(4);
            },
        },
    ], [t]);

    const customToolbar = React.useMemo(() => (
        <div className="flex flex-wrap items-end gap-2">
            <div className="flex items-end gap-2">
                <div className="space-y-1">
                    <Label className="text-xs">{t('startDate')}</Label>
                    <DatePickerInput value={startDate} onChange={setStartDate} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">{t('endDate')}</Label>
                    <DatePickerInput value={endDate} onChange={setEndDate} />
                </div>
            </div>
            <Button onClick={handleApplyFilters} disabled={isLoading} size="sm" className="h-9">
                <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('applyFilters')}</span>
            </Button>
        </div>
    ), [startDate, endDate, handleApplyFilters, isLoading, t]);

    const leftPanel = (
        <div className="h-full flex flex-col gap-4 overflow-hidden">
            <Card className="flex-none border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5"><DollarSign className="h-5 w-5" /></div>
                        <div>
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="bg-card pb-4 px-4">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('baseCurrency')}</p>
                        <Badge variant="secondary">UYU (Pesos Uruguayos)</Badge>
                    </div>
                </CardContent>
            </Card>
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="flex-none p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5"><History className="h-5 w-5" /></div>
                        <div>
                            <CardTitle className="text-lg">{t('exchangeRateHistory')}</CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                    <DataTable
                        columns={columns}
                        data={data}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        manualPagination={true}
                        pageCount={totalPages}
                        isRefreshing={isLoading}
                        onRefresh={fetchExchangeRates}
                        isNarrow={isNarrow || !!selectedItem}
                        renderCard={(row: ExchangeRateHistoryItem, _isSelected: boolean) => (
                            <DataCard isSelected={_isSelected}
                                title={row.fecha}
                                subtitle={`USD ${row.datos_completos?.usd_compra ?? ''} / ${row.datos_completos?.usd_venta ?? ''}`}
                                showArrow
                            />
                        )}
                        customToolbar={customToolbar}
                        enableSingleRowSelection
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        onRowSelectionChange={handleRowSelection}
                    />
                </CardContent>
            </Card>
        </div>
    );

    const rightPanel = selectedItem ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><History className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">{t('detailsModal.title')}</CardTitle>
                        <p className="text-xs text-muted-foreground">{selectedItem.fecha ? new Date(selectedItem.fecha).toLocaleDateString('es-ES') : ''}</p>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.date')}</dt>
                        <dd className="text-foreground">{selectedItem.fecha || '-'}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.usdBuy')}</dt>
                            <dd className="text-foreground font-medium">{selectedItem.datos_completos?.usd_compra ?? '-'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.usdSell')}</dt>
                            <dd className="text-foreground font-medium">{selectedItem.datos_completos?.usd_venta ?? '-'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.usdAverage')}</dt>
                            <dd className="text-foreground font-medium">
                                {selectedItem.datos_completos?.usd_compra && selectedItem.datos_completos?.usd_venta
                                    ? ((selectedItem.datos_completos.usd_compra + selectedItem.datos_completos.usd_venta) / 2).toFixed(4)
                                    : '-'}
                            </dd>
                        </div>
                    </div>
                    {selectedItem.datos_completos?.cotizaciones && selectedItem.datos_completos.cotizaciones.length > 0 && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Todas las cotizaciones</dt>
                            <dd>
                                <div className="grid grid-cols-1 gap-2">
                                    {selectedItem.datos_completos.cotizaciones.map((cotizacion, index) => (
                                        <div key={index} className="p-3 border rounded-lg bg-muted/30">
                                            <p className="font-semibold text-sm mb-1">{cotizacion.moneda} <span className="text-xs text-muted-foreground">({cotizacion.codigo})</span></p>
                                            <div className="grid grid-cols-2 gap-1 text-xs">
                                                <span className="text-muted-foreground">{t('detailsModal.buy')}:</span>
                                                <span className="font-medium">${cotizacion.compra.toFixed(4)}</span>
                                                <span className="text-muted-foreground">{t('detailsModal.sell')}:</span>
                                                <span className="font-medium">${cotizacion.venta.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </dd>
                        </div>
                    )}
                </dl>
            </CardContent>
        </Card>
    ) : <div />;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                isRightPanelOpen={!!selectedItem}
                onBack={handleBack}
                leftPanelDefaultSize={55}
                rightPanelDefaultSize={45}
            />
        </div>
    );
}
