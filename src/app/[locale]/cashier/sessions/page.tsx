
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
import { X, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


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
    
    const totalDeclaredAmount = (session.montoCierreDeclaradoEfectivo || 0) + (session.montoCierreDeclaradoTarjeta || 0) + (session.montoCierreDeclaradoTransferencia || 0) + (session.montoCierreDeclaradoOtro || 0);


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
        
        const denominations = Object.entries(parsedDetails).map(([key, value]) => ({ denomination: Number(key), quantity: Number(value) })).filter(item => item.quantity > 0);
        if (denominations.length === 0) return null;
        
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
                         <TableRow className="font-bold border-t">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
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
                {session.fechaCierre && <div><span className="font-semibold">{t('columns.closingAmount')}:</span> {formatCurrency(totalDeclaredAmount)}</div>}
            </div>

            {(session.opening_details || session.closing_denominations) && (
                 <Collapsible>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted px-4 py-2 text-sm font-semibold">
                        {t('denominationDetails')}
                        <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DenominationTable title={t('openingDenominations')} details={session.opening_details} />
                            <DenominationTable title={t('closingDenominations')} details={session.closing_denominations} />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            {session.fechaCierre && (
                 <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted px-4 py-2 text-sm font-semibold">
                        {t('reconciliationSummary')}
                        <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
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
                        {session.notasCierre && <p className="mt-4 text-sm"><span className="font-semibold">Notes:</span> {session.notasCierre}</p>}
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
    const [sessionCount, setSessionCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
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

    const handleView = (session: CajaSesion) => {
        setSelectedSession(session);
        setIsDetailsDialogOpen(true);
    };

    const columns = CashSessionsColumnsWrapper({ onView: handleView });

    return (
       <>
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
                        <DialogDescription>{t('detailsDescription', {id: selectedSession.id})}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[70vh] overflow-y-auto">
                        <SessionDetails session={selectedSession} />
                    </div>
                    </>
                 )}
            </DialogContent>
        </Dialog>
        </>
    );
}
