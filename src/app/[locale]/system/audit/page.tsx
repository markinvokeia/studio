
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AuditUserFilter } from '@/components/ui/audit-user-filter';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { AuditLog } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import api from '@/services/api';
import { ColumnDef, PaginationState, RowSelectionState, SortingState, VisibilityState } from '@tanstack/react-table';
import { format } from 'date-fns';
import { BarChart, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

type GetAuditLogsResponse = {
    auditLogs: AuditLog[];
    total: number;
};

type AuditLogFilters = {
    tableName: string;
    operation: string;
    changedBy: string;
    changedByName: string;
    dateRange: DateRange | undefined;
};

const EMPTY_FILTERS: AuditLogFilters = {
    tableName: 'all',
    operation: 'all',
    changedBy: '',
    changedByName: '',
    dateRange: undefined,
};

const OPERATIONS = ['INSERT', 'UPDATE', 'DELETE'] as const;

const OPERATION_BADGE_VARIANT: Record<string, 'success' | 'secondary' | 'destructive'> = {
    INSERT: 'success',
    UPDATE: 'secondary',
    DELETE: 'destructive',
};

async function getAuditLogs(
    pagination: PaginationState,
    filters: AuditLogFilters,
    sorting: SortingState
): Promise<GetAuditLogsResponse> {
    try {
        const params: Record<string, string> = {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        };
        if (filters.tableName !== 'all') params.table_name = filters.tableName;
        if (filters.operation !== 'all') params.operation = filters.operation;
        if (filters.changedBy) params.changed_by = filters.changedBy;
        if (filters.dateRange?.from) params.date_from = format(filters.dateRange.from, 'yyyy-MM-dd');
        if (filters.dateRange?.to) params.date_to = format(filters.dateRange.to, 'yyyy-MM-dd');
        if (sorting[0]) {
            params.sort_by = sorting[0].id;
            params.sort_order = sorting[0].desc ? 'desc' : 'asc';
        }

        const responseData = await api.get(API_ROUTES.SYSTEM.AUDIT_LOGS, params);
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
        const logsData = Array.isArray(data.data) ? data.data : (data.audit_logs || data.data || data.result || []);
        const total = data.total || (Array.isArray(data) ? data.length : 0);
        const mappedLogs = logsData.map((apiLog: any) => ({
            id: apiLog.id ? String(apiLog.id) : `aud_${Math.random().toString(36).substr(2, 9)}`,
            changed_at: apiLog.changed_at,
            changed_by: apiLog.changed_by,
            changed_by_name: apiLog.changed_by_name,
            table_name: apiLog.table_name,
            record_id: String(apiLog.record_id),
            operation: apiLog.operation,
            old_value: apiLog.old_value,
            new_value: apiLog.new_value,
        }));
        return { auditLogs: mappedLogs, total };
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return { auditLogs: [], total: 0 };
    }
}

async function getAuditEntities(): Promise<string[]> {
    try {
        const responseData = await api.get(API_ROUTES.SYSTEM.AUDIT_LOG_ENTITIES);
        // This endpoint returns the rows straight from the SELECT (no {data,total} wrapper),
        // so — unlike getAuditLogs — the array itself already *is* the row list.
        const rows = Array.isArray(responseData) ? responseData : (responseData?.data || responseData?.entities || []);
        return rows
            .map((row: any) => (typeof row === 'string' ? row : (row?.table_name ?? row?.json?.table_name)))
            .filter((v: any): v is string => Boolean(v));
    } catch (error) {
        console.error("Failed to fetch audit log entities:", error);
        return [];
    }
}

function formatJsonValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

export default function AuditLogPage() {
    const t = useTranslations('AuditLog');
    const { hasPermission } = usePermissions();
    const canViewList = hasPermission(SYSTEM_PERMISSIONS.AUDIT_LOG_VIEW_LIST);
    const isNarrow = useViewportNarrow();

    const [data, setData] = React.useState<AuditLog[]>([]);
    const [logCount, setLogCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [sorting, setSorting] = React.useState<SortingState>([{ id: 'changed_at', desc: true }]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ id: false });
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null);
    const [filters, setFilters] = React.useState<AuditLogFilters>(EMPTY_FILTERS);
    const [entities, setEntities] = React.useState<string[]>([]);

    const hasActiveFilters = filters.tableName !== 'all' || filters.operation !== 'all' || !!filters.changedBy || !!filters.dateRange;

    React.useEffect(() => {
        getAuditEntities().then(setEntities);
    }, []);

    const operationLabel = React.useCallback((operation: string) => {
        return OPERATIONS.includes(operation as typeof OPERATIONS[number])
            ? t(`operations.${operation}` as 'operations.INSERT' | 'operations.UPDATE' | 'operations.DELETE')
            : operation;
    }, [t]);

    const columns: ColumnDef<AuditLog>[] = React.useMemo(() => [
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} />, enableHiding: true },
        {
            accessorKey: 'changed_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.changedAt')} />,
            cell: ({ row }) => formatDateTime(row.original.changed_at),
        },
        { accessorKey: 'table_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.table')} /> },
        { accessorKey: 'record_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.recordId')} /> },
        {
            accessorKey: 'operation',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.operation')} />,
            cell: ({ row }) => (
                <Badge variant={OPERATION_BADGE_VARIANT[row.original.operation] || 'secondary'}>
                    {operationLabel(row.original.operation)}
                </Badge>
            ),
        },
        {
            accessorKey: 'changed_by',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.changedBy')} />,
            cell: ({ row }) => row.original.changed_by_name || row.original.changed_by || '-',
        },
    ], [t, operationLabel]);

    const loadLogs = React.useCallback(async () => {
        setIsRefreshing(true);
        const { auditLogs, total } = await getAuditLogs(pagination, filters, sorting);
        setData(auditLogs);
        setLogCount(total);
        setIsRefreshing(false);
    }, [pagination, filters, sorting]);

    React.useEffect(() => { loadLogs(); }, [loadLogs]);

    const handleRowSelection = (rows: AuditLog[]) => {
        setSelectedLog(rows[0] ?? null);
    };

    const handleBack = () => {
        setSelectedLog(null);
        setRowSelection({});
    };

    const updateFilters = (patch: Partial<AuditLogFilters>) => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        setFilters((prev) => ({ ...prev, ...patch }));
    };

    const clearFilters = () => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        setFilters(EMPTY_FILTERS);
    };

    const filterBar = (
        <div className="flex flex-wrap items-center gap-2 pb-3 flex-none">
            <Select value={filters.tableName} onValueChange={(value) => updateFilters({ tableName: value })}>
                <SelectTrigger className="h-9 w-[170px]">
                    <SelectValue placeholder={t('filters.entity')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('filters.allEntities')}</SelectItem>
                    {entities.map((entity) => (
                        <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={filters.operation} onValueChange={(value) => updateFilters({ operation: value })}>
                <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder={t('filters.operation')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('filters.allOperations')}</SelectItem>
                    {OPERATIONS.map((operation) => (
                        <SelectItem key={operation} value={operation}>{operationLabel(operation)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <AuditUserFilter
                value={filters.changedBy}
                selectedUserName={filters.changedByName}
                onValueChange={(userId, user) => updateFilters({ changedBy: userId, changedByName: user?.name || '' })}
                placeholder={t('filters.userPlaceholder')}
                triggerText={t('filters.user')}
                className="h-9 w-[200px]"
            />

            <DateRangePresets
                value={filters.dateRange}
                onChange={(range) => updateFilters({ dateRange: range })}
                allowAllTime
            />

            {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" />
                    {t('filters.clear')}
                </Button>
            )}
        </div>
    );

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><BarChart className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                {canViewList ? (
                    <>
                        {filterBar}
                        <DataTable
                            columns={columns}
                            data={data}
                            useGlobalFilter
                            filterPlaceholder={t('filterPlaceholder')}
                            onRefresh={loadLogs}
                            isRefreshing={isRefreshing}
                            isNarrow={isNarrow || !!selectedLog}
                            renderCard={(row: AuditLog, _isSelected: boolean) => (
                                <DataCard isSelected={_isSelected}
                                    title={row.table_name}
                                    subtitle={`${operationLabel(row.operation)} · ${formatDateTime(row.changed_at)}`}
                                    showArrow
                                />
                            )}
                            pageCount={Math.ceil(logCount / pagination.pageSize)}
                            rowCount={logCount}
                            pagination={pagination}
                            onPaginationChange={setPagination}
                            manualPagination={true}
                            sorting={sorting}
                            onSortingChange={setSorting}
                            columnVisibility={columnVisibility}
                            onColumnVisibilityChange={setColumnVisibility}
                            enableSingleRowSelection
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            onRowSelectionChange={handleRowSelection}
                        />
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">{t('noAccess')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const rightPanel = selectedLog ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><BarChart className="h-5 w-5" /></div>
                    <div className="min-w-0">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedLog.table_name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{operationLabel(selectedLog.operation)} · {selectedLog.record_id}</p>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.changedAt')}</dt>
                        <dd className="text-foreground">{formatDateTime(selectedLog.changed_at)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.changedBy')}</dt>
                        <dd className="text-foreground">{selectedLog.changed_by_name || selectedLog.changed_by || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.operation')}</dt>
                        <dd><Badge variant={OPERATION_BADGE_VARIANT[selectedLog.operation] || 'secondary'}>{operationLabel(selectedLog.operation)}</Badge></dd>
                    </div>
                    <Separator />
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('columns.oldValue')}</dt>
                        <dd>
                            <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-48 overflow-auto">
                                {formatJsonValue(selectedLog.old_value)}
                            </pre>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('columns.newValue')}</dt>
                        <dd>
                            <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-48 overflow-auto">
                                {formatJsonValue(selectedLog.new_value)}
                            </pre>
                        </dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    ) : <div />;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                isRightPanelOpen={!!selectedLog}
                onBack={handleBack}
                leftPanelDefaultSize={45}
                rightPanelDefaultSize={55}
            />
        </div>
    );
}
