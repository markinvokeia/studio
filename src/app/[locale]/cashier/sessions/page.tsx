
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CajaSesion, CajaMovimiento } from '@/lib/types';
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
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';


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
            sessions: sessionsData.map((s: any) => {
              const openingDetails = typeof s.opening_details === 'string' ? JSON.parse(s.opening_details) : s.opening_details;
              const closingDetails = typeof s.closing_details === 'string' ? JSON.parse(s.closing_details) : s.closing_details;

              return { 
                id: String(s.id),
                user_name: s.user_name,
                cash_point_name: s.cash_point_name,
                estado: s.status,
                fechaApertura: s.opened_at,
                fechaCierre: s.closed_at,
                montoApertura: s.opening_amount,
                opening_details: openingDetails,
                montoCierreDeclaradoEfectivo: s.declared_cash,
                montoCierreCalculadoEfectivo: s.calculated_cash,
                montoCierreDeclaradoTarjeta: s.declared_card,
                montoCierreCalculadoTarjeta: s.calculated_card,
                montoCierreDeclaradoTransferencia: s.declared_transfer,
                montoCierreCalculadoTransferencia: s.calculated_transfer,
                montoCierreDeclaradoOtro: s.declared_other,
                montoCierreCalculadoOtro: s.calculated_other,
                descuadreEfectivo: s.cash_discrepancy || s.cash_variance,
                descuadreTarjeta: s.card_discrepancy,
                descuadreTransferencia: s.transfer_discrepancy,
                descuadreOtro: s.other_discrepancy,
                closing_denominations: closingDetails,
                notasCierre: s.notes,
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
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/movements?cash_session_id=${sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch session movements');
    const data = await response.json();
    const movementsData = Array.isArray(data) ? data : (data.data || []);
    return movementsData.map((mov: any): CajaMovimiento => ({
        id: String(mov.movement_id),
        cajaSesionId: sessionId,
        tipo: mov.type === 'INFLOW' ? 'INGRESO' : 'EGRESO',
        monto: parseFloat(mov.amount),
        descripcion: mov.description,
        fecha: mov.created_at,
        usuarioId: mov.registered_by_user,
        metodoPago: (mov.payment_method_name || 'otro').toUpperCase() as any,
    }));
  } catch(error) {
    console.error("Failed to fetch session movements:", error);
    return [];
  }
}

const SessionDetails = ({ session, movements }: { session: CajaSesion, movements: CajaMovimiento[] }) => {
    const t = useTranslations('CashSessionsPage');
    const tMovementColumns = useTranslations('CashierPage.activeSession.columns');

    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '$0.00';
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };
    
    const totalDeclaredAmount = (session.montoCierreDeclaradoEfectivo || 0) + (session.montoCierreDeclaradoTarjeta || 0) + (session.montoCierreDeclaradoTransferencia || 0) + (session.montoCierreDeclaradoOtro || 0);

    const DenominationTable = ({ title, details }: { title: string, details: string | object | null | undefined }) => {
        const tDenominations = useTranslations('CashSessionsPage.denominationDetails');
        let parsedDetails: Record<string, number> = {};

        if (typeof details === 'string') {
            try {
                parsedDetails = JSON.parse(details);
            } catch (e) {
                console.error("Failed to parse details", e);
                return null;
            }
        } else if (typeof details === 'object' && details !== null) {
            parsedDetails = details as Record<string, number>;
        }

        const denominations = Object.entries(parsedDetails)
            .map(([key, value]) => ({ denomination: Number(key), quantity: Number(value) }))
            .filter(item => !isNaN(item.denomination) && item.quantity > 0);

        if (denominations.length === 0) {
            return (
                <div className="space-y-2">
                    <h4 className="font-semibold">{title}</h4>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{tDenominations('denomination')}</TableHead>
                                <TableHead className="text-right">{tDenominations('quantity')}</TableHead>
                                <TableHead className="text-right">{tDenominations('subtotal')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">{t('noDetails')}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            );
        }
        
        const total = denominations.reduce((acc, { denomination, quantity }) => acc + (denomination * quantity), 0);

        return (
            <div className="space-y-2">
                <h4 className="font-semibold">{title}</h4>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{tDenominations('denomination')}</TableHead>
                            <TableHead className="text-right">{tDenominations('quantity')}</TableHead>
                            <TableHead className="text-right">{tDenominations('subtotal')}</TableHead>
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
                            <TableCell colSpan={2}>{tDenominations('total')}</TableCell>
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

    const movementColumns: ColumnDef<CajaMovimiento>[] = [
      { accessorKey: 'descripcion', header: ({column}) => <DataTableColumnHeader column={column} title={tMovementColumns('description')} /> },
      { accessorKey: 'monto', header: ({column}) => <DataTableColumnHeader column={column} title={tMovementColumns('amount')} />, cell: ({ row }) => `$${row.original.monto.toFixed(2)}` },
      { accessorKey: 'metodoPago', header: ({column}) => <DataTableColumnHeader column={column} title={tMovementColumns('method')} /> },
      { accessorKey: 'fecha', header: ({column}) => <DataTableColumnHeader column={column} title={tMovementColumns('date')} />, cell: ({ row }) => new Date(row.original.fecha).toLocaleTimeString() },
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
                    <div><span className="font-semibold">{t('columns.openingAmount')}:</span> {formatCurrency(session.montoApertura)}</div>
                    {session.fechaCierre && <div><span className="font-semibold">{t('columns.closingAmount')}:</span> {formatCurrency(totalDeclaredAmount)}</div>}
                </div>
            </div>
            
             <Collapsible className="space-y-2">
                <CollapsibleTrigger className="flex w-full items-center justify-between text-lg font-semibold rounded-lg border bg-card p-4 shadow-sm">
                    {t('denominationDetails.title')}
                    <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 pl-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border bg-card p-4 rounded-md shadow-sm">
                        <DenominationTable title={t('openingDenominations')} details={session.opening_details} />
                        <DenominationTable title={t('closingDenominations')} details={session.closing_denominations} />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen className="space-y-2">
                <CollapsibleTrigger className="flex w-full items-center justify-between text-lg font-semibold rounded-lg border bg-card p-4 shadow-sm">
                    {t('movements')}
                    <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 pl-4">
                    <DataTable columns={movementColumns} data={movements} />
                </CollapsibleContent>
            </Collapsible>

            {session.fechaCierre && (
                 <Collapsible defaultOpen className="space-y-2">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-lg font-semibold rounded-lg border bg-card p-4 shadow-sm">
                        {t('reconciliationSummary')}
                        <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4 pl-4">
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
                                <DifferenceRow label={t('reconciliation.cash')} calculated={session.montoCierreCalculadoEfectivo} declared={session.montoCierreDeclaradoEfectivo} difference={session.descuadreEfectivo} />
                                <DifferenceRow label={t('reconciliation.card')} calculated={session.montoCierreCalculadoTarjeta} declared={session.montoCierreDeclaradoTarjeta} difference={session.descuadreTarjeta} />
                                <DifferenceRow label={t('reconciliation.transfer')} calculated={session.montoCierreCalculadoTransferencia} declared={session.montoCierreDeclaradoTransferencia} difference={session.descuadreTransferencia} />
                                <DifferenceRow label={t('reconciliation.other')} calculated={session.montoCierreCalculadoOtro} declared={session.montoCierreDeclaradoOtro} difference={session.descuadreOtro} />
                            </TableBody>
                        </Table>
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
                        <SessionDetails session={selectedSession} movements={movements} />
                    </div>
                    </>
                 )}
            </DialogContent>
        </Dialog>
        </>
    );
}
