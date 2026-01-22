
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { CajaMovimiento, CajaSesion } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef, ColumnFiltersState, PaginationState, VisibilityState } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { ChevronDown, Printer, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { CashSessionsColumnsWrapper } from './columns';


type GetCashSessionsResponse = {
    sessions: CajaSesion[];
    total: number;
};

async function getCashSessions(pagination: PaginationState, searchQuery: string): Promise<GetCashSessionsResponse> {
    try {
        const response = await api.get(API_ROUTES.CASHIER.SESSIONS_SEARCH, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });

        const data = Array.isArray(response) && response.length > 0 ? response[0] : response;

        const sessionsData = data.data || [];
        const total = Number(data.total) || 0;

        return {
            sessions: sessionsData.map((s: any) => {
                const openingDetails = typeof s.opening_details === 'string' ? JSON.parse(s.opening_details) : s.opening_details;
                const closingDetails = typeof s.closing_details === 'string' ? JSON.parse(s.closing_details) : s.closing_details;
                const openingAmount = (s.currencies_data || []).reduce((sum: number, curr: any) => sum + (Number(curr.opening_amount) || 0), 0);

                return {
                    id: String(s.id),
                    user_name: s.user_name,
                    cash_point_name: s.cash_point_name,
                    estado: s.status,
                    fechaApertura: s.opened_at,
                    fechaCierre: s.closed_at,
                    montoApertura: openingAmount,
                    opening_details: openingDetails,
                    closing_details: closingDetails,
                    notasCierre: s.notes,
                    currencies_data: s.currencies_data,
                }
            }),
            total
        };
    } catch (error) {
        console.error("Failed to fetch cash sessions:", error);
        return { sessions: [], total: 0 };
    }
}

async function getSessionMovements(sessionId: string): Promise<CajaMovimiento[]> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.SESSIONS_MOVEMENTS, { cash_session_id: sessionId });
        let movementsData = [];
        if (Array.isArray(data)) {
            movementsData = data.filter(item => Object.keys(item).length > 0);
        } else if (data && data.data) {
            movementsData = data.data;
        }
        return movementsData.map((mov: any): CajaMovimiento => ({
            id: String(mov.movement_id),
            cajaSesionId: sessionId,
            tipo: mov.type === 'INFLOW' ? 'INGRESO' : 'EGRESO',
            monto: parseFloat(mov.amount),
            descripcion: mov.description,
            fecha: mov.created_at,
            usuarioId: mov.registered_by_user,
            metodoPago: (mov.payment_method_name || 'otro').toUpperCase() as any,
            currency: mov.currency,
        }));
    } catch (error) {
        console.error("Failed to fetch session movements:", error);
        return [];
    }
}

const SessionDetails = ({ session, movements }: { session: CajaSesion, movements: CajaMovimiento[] }) => {
    const t = useTranslations('CashSessionsPage');
    const tMovementColumns = useTranslations('CashierPage.activeSession.columns');

    const formatCurrency = (value: number | null | undefined, currency: string) => {
        if (value === null || value === undefined) return `${currency} 0.00`;
        const numValue = Number(value);
        if (isNaN(numValue)) return `${currency} 0.00`;
        return numValue.toLocaleString('en-US', { style: 'currency', currency });
    };

    const DenominationTable = ({ title, details }: { title: string, details: string | object | null | undefined }) => {
        const tDenominations = useTranslations('CashSessionsPage.denominationDetails');
        let parsedDetails: Record<string, any> = {};

        if (typeof details === 'string') {
            try {
                parsedDetails = JSON.parse(details);
            } catch (e) {
                console.error("Failed to parse details", e);
            }
        } else if (typeof details === 'object' && details !== null) {
            parsedDetails = details as Record<string, any>;
        }

        return (
            <div className="space-y-4">
                <h4 className="font-semibold">{title}</h4>
                {Object.entries(parsedDetails).map(([currency, currencyDetails]) => {
                    if (currency === 'opened_by' || currency === 'opened_at' || currency === 'currency' || currency === 'date_rate') return null;
                    const denominations = Object.entries(currencyDetails)
                        .map(([key, value]) => ({ denomination: Number(key), quantity: Number(value) }))
                        .filter(item => !isNaN(item.denomination) && item.quantity > 0);
                    const total = currencyDetails.total || 0;

                    return (
                        <div key={currency} className="space-y-2">
                            <h5 className="font-medium text-md">{currency}</h5>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{tDenominations('denomination')}</TableHead>
                                        <TableHead className="text-right">{tDenominations('quantity')}</TableHead>
                                        <TableHead className="text-right">{tDenominations('subtotal')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {denominations.length > 0 ? denominations.map(({ denomination, quantity }) => (
                                        <TableRow key={denomination}>
                                            <TableCell>{formatCurrency(denomination, currency)}</TableCell>
                                            <TableCell className="text-right">{quantity}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(denomination * quantity, currency)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">{t('noDetails')}</TableCell>
                                        </TableRow>
                                    )}
                                    <TableRow className="font-bold border-t">
                                        <TableCell colSpan={2}>{tDenominations('total')}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total, currency)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    );
                })}
            </div>
        );
    };


    const DifferenceRow = ({ label, calculated, declared, difference, currency }: { label: string, calculated?: number, declared?: number, difference?: number, currency: string }) => (
        <TableRow>
            <TableCell className="font-medium">{label}</TableCell>
            <TableCell className="text-right">{formatCurrency(calculated, currency)}</TableCell>
            <TableCell className="text-right">{formatCurrency(declared, currency)}</TableCell>
            <TableCell className={cn("text-right font-semibold", (difference ?? 0) < 0 ? "text-destructive" : (difference ?? 0) > 0 ? "text-green-600" : "")}>
                {formatCurrency(difference, currency)}
            </TableCell>
        </TableRow>
    );

    const movementColumns: ColumnDef<CajaMovimiento>[] = [
        { accessorKey: 'descripcion', header: ({ column }) => <DataTableColumnHeader column={column} title={tMovementColumns('description')} /> },
        { accessorKey: 'monto', header: ({ column }) => <DataTableColumnHeader column={column} title={tMovementColumns('amount')} />, cell: ({ row }) => `${row.original.currency} ${row.original.monto.toFixed(2)}` },
        { accessorKey: 'metodoPago', header: ({ column }) => <DataTableColumnHeader column={column} title={tMovementColumns('method')} /> },
        { accessorKey: 'fecha', header: ({ column }) => <DataTableColumnHeader column={column} title={tMovementColumns('date')} />, cell: ({ row }) => new Date(row.original.fecha).toLocaleTimeString() },
    ];

    return (
        <div className="space-y-6">
            <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
                <h3 className="font-semibold text-lg">{t('sessionInfo')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold">{t('columns.user')}:</span> {session.user_name}</div>
                    <div><span className="font-semibold">{t('columns.cashPoint')}:</span> {session.cash_point_name}</div>
                    <div><span className="font-semibold">{t('columns.openDate')}:</span> {format(parseISO(session.fechaApertura), 'Pp')}</div>
                    <div><span className="font-semibold">{t('columns.closeDate')}:</span> {session.fechaCierre ? format(parseISO(session.fechaCierre), 'Pp') : 'N/A'}</div>
                </div>
            </div>

            <Collapsible className="space-y-2 rounded-lg border bg-card p-4 shadow-sm">
                <CollapsibleTrigger className="flex w-full items-center justify-between text-lg font-semibold">
                    {t('denominationDetails.title')}
                    <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <DenominationTable title={t('openingDenominations')} details={session.opening_details} />
                        <DenominationTable title={t('closingDenominations')} details={session.closing_details} />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <Collapsible className="space-y-2 rounded-lg border bg-card p-4 shadow-sm">
                <CollapsibleTrigger className="flex w-full items-center justify-between text-lg font-semibold">
                    {t('movements')}
                    <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                    <DataTable columns={movementColumns} data={movements} />
                </CollapsibleContent>
            </Collapsible>

            {session.estado === 'CLOSE' && (
                <Collapsible defaultOpen className="space-y-2 rounded-lg border bg-card p-4 shadow-sm">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-lg font-semibold">
                        {t('reconciliationSummary')}
                        <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4 space-y-6">
                        {(session.currencies_data || []).map(currencyData => (
                            <div key={currencyData.currency}>
                                <h4 className="font-semibold text-lg mb-2">{currencyData.currency}</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('reconciliation.paymentMethod')}</TableHead>
                                            <TableHead className="text-right">{t('reconciliation.system')}</TableHead>
                                            <TableHead className="text-right">{t('reconciliation.declared')}</TableHead>
                                            <TableHead className="text-right">{t('reconciliation.difference')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <DifferenceRow label={t('reconciliation.cash')} calculated={currencyData.calculated_cash} declared={currencyData.declared_cash} difference={currencyData.cash_variance} currency={currencyData.currency} />
                                        <TableRow>
                                            <TableCell className="font-medium">{t('reconciliation.card')}</TableCell>
                                            <TableCell className="text-right" colSpan={3}>{formatCurrency(currencyData.calculated_card, currencyData.currency)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">{t('reconciliation.transfer')}</TableCell>
                                            <TableCell className="text-right" colSpan={3}>{formatCurrency(currencyData.calculated_transfer, currencyData.currency)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">{t('reconciliation.other')}</TableCell>
                                            <TableCell className="text-right" colSpan={3}>{formatCurrency(currencyData.calculated_other, currencyData.currency)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                        {session.notasCierre && <p className="mt-4 text-sm"><span className="font-semibold">{t('reconciliation.notes')}:</span> {session.notasCierre}</p>}
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    );
};


export default function CashSessionsPage() {
    const t = useTranslations('CashSessionsPage');
    const { toast } = useToast();
    const [sessions, setSessions] = React.useState<CajaSesion[]>([]);
    const [movements, setMovements] = React.useState<CajaMovimiento[]>([]);
    const [sessionCount, setSessionCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [isPrintingClose, setIsPrintingClose] = React.useState(false);

    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
        id: false,
    });

    const [selectedSession, setSelectedSession] = React.useState<CajaSesion | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);

    const loadSessions = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'user_name')?.value as string) || '';
        const { sessions, total } = await getCashSessions(pagination, searchQuery);
        setSessions(sessions);
        setSessionCount(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleView = async (session: CajaSesion) => {
        setSelectedSession(session);
        const sessionMovements = await getSessionMovements(session.id);
        setMovements(sessionMovements);
        setIsDetailsDialogOpen(true);
    };

    const handlePrint = async (session: CajaSesion) => {
        setIsPrinting(true);
        toast({ title: t('toasts.generatingReportTitle'), description: t('toasts.generatingReportDesc') });
        try {
            const blob = await api.getBlob(API_ROUTES.CASHIER.SESSIONS_PRINT, { cash_session_id: session.id });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cash-session-report-${session.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast({ title: t('toasts.reportDownloadedTitle'), description: t('toasts.reportDownloadedDesc') });
        } catch (error) {
            console.error("Failed to print session:", error);
            toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: error instanceof Error ? error.message : t('toasts.reportErrorDesc') });
        } finally {
            setIsPrinting(false);
        }
    };

    const handlePrintClose = async (session: CajaSesion) => {
        setIsPrintingClose(true);
        toast({ title: t('toasts.generatingClosingReportTitle'), description: t('toasts.generatingClosingReportDesc') });
        try {
            const blob = await api.getBlob(API_ROUTES.CASHIER.SESSIONS_CLOSE_PRINT, { cash_session_id: session.id });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `closing-${session.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast({ title: t('toasts.closingReportDownloadedTitle'), description: t('toasts.closingReportDownloadedDesc') });
        } catch (error) {
            console.error("Failed to print closing session:", error);
            toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: error instanceof Error ? error.message : t('toasts.closingReportErrorDesc') });
        } finally {
            setIsPrintingClose(false);
        }
    };

    const columns = CashSessionsColumnsWrapper({ onView: handleView, onPrint: handlePrint });

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="flex-none">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={sessions}
                        pageCount={Math.ceil(sessionCount / pagination.pageSize)}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                        manualPagination={true}
                        filterColumnId="user_name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onRefresh={loadSessions}
                        isRefreshing={isRefreshing || isPrinting}
                        columnVisibility={columnVisibility}
                        onColumnVisibilityChange={setColumnVisibility}
                        enableSingleRowSelection={false}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-4xl">
                    {selectedSession && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{t('detailsTitle')}</DialogTitle>
                                <DialogDescription>{t('detailsDescription', { id: selectedSession.id })}</DialogDescription>
                            </DialogHeader>
                            <div className="py-4 max-h-[70vh] overflow-y-auto">
                                <SessionDetails session={selectedSession} movements={movements} />
                            </div>
                            {selectedSession?.estado === 'CLOSE' && (
                                <DialogFooter>
                                    <Button onClick={() => handlePrintClose(selectedSession)} disabled={isPrintingClose}>
                                        {isPrintingClose ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                                        {t('printClosingReport')}
                                    </Button>
                                </DialogFooter>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

