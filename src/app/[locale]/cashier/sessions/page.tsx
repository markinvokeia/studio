
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CajaSesion } from '@/lib/types';
import { CashSessionsColumnsWrapper } from './columns';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { ColumnDef, ColumnFiltersState, PaginationState, VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';

type GetCashSessionsResponse = {
  sessions: CajaSesion[];
  total: number;
};

async function getCashSessions(pagination: PaginationState, searchQuery: string): Promise<GetCashSessionsResponse> {
    try {
        const params = new URLSearchParams({
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/search?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const responseData = await response.json();
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;

        const sessionsData = data.data || [];
        const total = Number(data.total) || 0;

        return {
            sessions: sessionsData.map((s: any) => ({ 
                id: String(s.id),
                user_name: s.user_name,
                cash_point_name: s.cash_point_name,
                estado: s.status,
                fechaApertura: s.opened_at,
                fechaCierre: s.closed_at,
                montoApertura: s.opening_amount,
                opening_details: s.opening_details,
                montoCierreDeclaradoEfectivo: s.declared_cash,
                montoCierreCalculadoEfectivo: s.calculated_cash,
                montoCierreDeclaradoTarjeta: s.declared_card,
                montoCierreCalculadoTarjeta: s.calculated_card,
                montoCierreDeclaradoTransferencia: s.declared_transfer,
                montoCierreCalculadoTransferencia: s.calculated_transfer,
                montoCierreDeclaradoOtro: s.declared_other,
                montoCierreCalculadoOtro: s.calculated_other,
                descuadreEfectivo: s.cash_discrepancy,
                descuadreTarjeta: s.card_discrepancy,
                descuadreTransferencia: s.transfer_discrepancy,
                descuadreOtro: s.other_discrepancy,
                closing_denominations: s.closing_denominations,
                notasCierre: s.notes,
             })),
            total
        };
    } catch (error) {
        console.error("Failed to fetch cash sessions:", error);
        return { sessions: [], total: 0 };
    }
}

const SessionDetails = ({ session }: { session: CajaSesion }) => {
    const t = useTranslations('CashSessionsPage');

    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '$0.00';
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const DenominationTable = ({ title, details }: { title: string, details: string | object | null | undefined }) => {
        if (!details) return null;
        let parsedDetails: Record<string, number> = {};
        if (typeof details === 'string') {
            try {
                parsedDetails = JSON.parse(details);
            } catch (e) {
                console.error("Failed to parse details", e);
                return <p>Could not load denomination details.</p>;
            }
        } else if (typeof details === 'object') {
            parsedDetails = details as Record<string, number>;
        }
        
        const denominations = Object.entries(parsedDetails).map(([key, value]) => ({ denomination: Number(key), quantity: Number(value) }));
        const total = denominations.reduce((acc, { denomination, quantity }) => acc + (denomination * quantity), 0);

        return (
            <div className="space-y-2">
                <h4 className="font-semibold">{title}</h4>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Denomination</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {denominations.map(({ denomination, quantity }) => (
                            <TableRow key={denomination}>
                                <TableCell>{formatCurrency(denomination)}</TableCell>
                                <TableCell className="text-right">{quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(denomination * quantity)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <p className="text-right font-bold">Total: {formatCurrency(total)}</p>
            </div>
        );
    };

    const DifferenceRow = ({ label, calculated, declared, difference }: { label: string, calculated?: number, declared?: number, difference?: number }) => (
        <TableRow>
            <TableCell className="font-medium">{label}</TableCell>
            <TableCell className="text-right">{formatCurrency(calculated)}</TableCell>
            <TableCell className="text-right">{formatCurrency(declared)}</TableCell>
            <TableCell className={cn("text-right font-semibold", (difference ?? 0) < 0 ? "text-destructive" : (difference ?? 0) > 0 ? "text-green-600" : "")}>
                {formatCurrency(difference)}
            </TableCell>
        </TableRow>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div><span className="font-semibold">{t('columns.user')}:</span> {session.user_name}</div>
                <div><span className="font-semibold">{t('columns.cashPoint')}:</span> {session.cash_point_name}</div>
                <div><span className="font-semibold">{t('columns.openDate')}:</span> {format(parseISO(session.fechaApertura), 'Pp')}</div>
                <div><span className="font-semibold">{t('columns.closeDate')}:</span> {session.fechaCierre ? format(parseISO(session.fechaCierre), 'Pp') : 'N/A'}</div>
                <div><span className="font-semibold">{t('columns.openingAmount')}:</span> {formatCurrency(session.montoApertura)}</div>
            </div>

            {session.fechaCierre && (
                <div>
                    <h4 className="font-semibold mb-2">Reconciliation Summary</h4>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Payment Method</TableHead>
                                <TableHead className="text-right">System</TableHead>
                                <TableHead className="text-right">Declared</TableHead>
                                <TableHead className="text-right">Difference</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <DifferenceRow label="Cash" calculated={session.montoCierreCalculadoEfectivo} declared={session.montoCierreDeclaradoEfectivo} difference={session.descuadreEfectivo} />
                            <DifferenceRow label="Card" calculated={session.montoCierreCalculadoTarjeta} declared={session.montoCierreDeclaradoTarjeta} difference={session.descuadreTarjeta} />
                            <DifferenceRow label="Transfer" calculated={session.montoCierreCalculadoTransferencia} declared={session.montoCierreDeclaradoTransferencia} difference={session.descuadreTransferencia} />
                            <DifferenceRow label="Other" calculated={session.montoCierreCalculadoOtro} declared={session.montoCierreDeclaradoOtro} difference={session.descuadreOtro} />
                        </TableBody>
                    </Table>
                    {session.notasCierre && <p className="mt-2 text-sm"><span className="font-semibold">Notes:</span> {session.notasCierre}</p>}
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DenominationTable title="Opening Denominations" details={session.opening_details} />
                <DenominationTable title="Closing Denominations" details={session.closing_denominations} />
            </div>
        </div>
    );
};


export default function CashSessionsPage() {
    const t = useTranslations('CashSessionsPage');
    const { toast } = useToast();
    const [sessions, setSessions] = React.useState<CajaSesion[]>([]);
    const [sessionCount, setSessionCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
        id: false,
    });
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedSession, setSelectedSession] = React.useState<CajaSesion | null>(null);
    const [isDetailsLoading, setIsDetailsLoading] = React.useState(false);

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

    const handleRowSelectionChange = (selectedRows: CajaSesion[]) => {
        const session = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedSession(session);
    };

    const handleCloseDetails = () => {
        setSelectedSession(null);
        setRowSelection({});
    };

    const handleView = (session: CajaSesion) => {
        setSelectedSession(session);
        const rowIndex = sessions.findIndex(s => s.id === session.id);
        if(rowIndex !== -1) {
             setRowSelection({[rowIndex]: true});
        }
    };

    const columns = CashSessionsColumnsWrapper({ onView: handleView });

    return (
       <div className={cn("grid grid-cols-1 gap-4", selectedSession ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
            <div className={cn("transition-all duration-300", selectedSession ? "lg:col-span-2" : "lg:col-span-1")}>
                <Card>
                    <CardHeader>
                        <CardTitle>{t('title')}</CardTitle>
                        <CardDescription>{t('description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                            isRefreshing={isRefreshing}
                            columnVisibility={columnVisibility}
                            onColumnVisibilityChange={setColumnVisibility}
                            onRowSelectionChange={handleRowSelectionChange}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            enableSingleRowSelection
                        />
                    </CardContent>
                </Card>
            </div>
            {selectedSession && (
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                             <div>
                                <CardTitle>{t('detailsTitle')}</CardTitle>
                                <CardDescription>{t('detailsDescription', {id: selectedSession.id})}</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                <X className="h-5 w-5" />
                                <span className="sr-only">{t('closeDetails')}</span>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isDetailsLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <SessionDetails session={selectedSession} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

