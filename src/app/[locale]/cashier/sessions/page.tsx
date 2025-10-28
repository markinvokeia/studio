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
import { X, MoreHorizontal } from 'lucide-react';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';

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
             })),
            total
        };
    } catch (error) {
        console.error("Failed to fetch cash sessions:", error);
        return { sessions: [], total: 0 };
    }
}

async function getSessionMovements(sessionId: string): Promise<CajaMovimiento[]> {
    if(!sessionId) return [];
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
    } catch (error) {
        console.error(error);
        return [];
    }
}

const movementColumns: ColumnDef<CajaMovimiento>[] = [
  { accessorKey: 'descripcion', header: 'Description' },
  { accessorKey: 'monto', header: 'Amount', cell: ({ row }) => `$${row.original.monto.toFixed(2)}` },
  { accessorKey: 'metodoPago', header: 'Method' },
  { accessorKey: 'fecha', header: 'Date', cell: ({ row }) => new Date(row.original.fecha).toLocaleTimeString() },
];


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
    const [sessionMovements, setSessionMovements] = React.useState<CajaMovimiento[]>([]);
    const [isMovementsLoading, setIsMovementsLoading] = React.useState(false);

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

    React.useEffect(() => {
        if(selectedSession) {
            setIsMovementsLoading(true);
            getSessionMovements(selectedSession.id).then(movements => {
                setSessionMovements(movements);
                setIsMovementsLoading(false);
            });
        }
    }, [selectedSession]);
    
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
            <div className={cn("transition-all duration-300", selectedSession ? "lg:col-span-3" : "lg:col-span-5")}>
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
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                             <div>
                                <CardTitle>Session Movements</CardTitle>
                                <CardDescription>Movements for session #{selectedSession.id}</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                <X className="h-5 w-5" />
                                <span className="sr-only">Close details</span>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isMovementsLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <DataTable columns={movementColumns} data={sessionMovements} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
