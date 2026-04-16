
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { AlertScheduleRun } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { format } from 'date-fns';
import { FileClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function ExecutionHistoryPage() {
  const t = useTranslations('ExecutionHistoryPage');
  const tColumns = useTranslations('ExecutionHistoryPage.columns');
  const { hasPermission } = usePermissions();
  const canViewList = hasPermission(SYSTEM_PERMISSIONS.ALERT_EXECUTIONS_VIEW_LIST);
  const isNarrow = useViewportNarrow();
  const [runs, setRuns] = React.useState<AlertScheduleRun[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedRun, setSelectedRun] = React.useState<AlertScheduleRun | null>(null);

  const fetchRuns = async (page: number, limit: number) => {
    try {
      const response = await api.get('/system/alert-execution-history', { page: page.toString(), limit: limit.toString() });
      setRuns(response);
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
    }
  };

  React.useEffect(() => { fetchRuns(1, 10); }, []);

  const handleRowSelection = (rows: AlertScheduleRun[]) => {
    setSelectedRun(rows[0] ?? null);
  };

  const handleBack = () => {
    setSelectedRun(null);
    setRowSelection({});
  };

  const onPaginationChange: React.Dispatch<React.SetStateAction<typeof pagination>> = (updater) => {
    const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
    setPagination(newPagination);
    fetchRuns(newPagination.pageIndex + 1, newPagination.pageSize);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchRuns(pagination.pageIndex + 1, pagination.pageSize);
    } finally {
      setIsRefreshing(false);
    }
  };

  const columns: ColumnDef<AlertScheduleRun>[] = React.useMemo(() => [
    {
      accessorKey: 'run_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('runDate')} />,
      cell: ({ row }) => row.original.run_date ? format(new Date(row.original.run_date), 'yyyy-MM-dd HH:mm') : '-',
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('status')} />,
      cell: ({ row }) => {
        const status = row.original.status?.toLowerCase();
        const variant: 'success' | 'destructive' | 'secondary' = status === 'completed' || status === 'success' ? 'success' : status === 'failed' ? 'destructive' : 'secondary';
        return <Badge variant={variant} className="capitalize">{row.original.status}</Badge>;
      },
    },
    { accessorKey: 'rules_processed', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('rulesProcessed') || 'Reglas'} /> },
    { accessorKey: 'alerts_created', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('alertsCreated')} /> },
    { accessorKey: 'emails_sent', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('emailsSent')} /> },
    { accessorKey: 'errors_count', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('errorsCount')} /> },
  ], [tColumns]);

  const leftPanel = (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4">
        <div className="flex items-start gap-3">
          <div className="header-icon-circle mt-0.5"><FileClock className="h-5 w-5" /></div>
          <div>
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription className="text-xs">{t('description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
        {canViewList ? (
          <DataTable
            columns={columns}
            data={runs}
            filterColumnId="status"
            filterPlaceholder={t('filterPlaceholder')}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            isNarrow={isNarrow || !!selectedRun}
            renderCard={(row: AlertScheduleRun) => (
              <DataCard
                title={row.run_date ? format(new Date(row.run_date), 'yyyy-MM-dd HH:mm') : ''}
                subtitle={`${row.rules_processed ?? 0} reglas · ${row.alerts_created} alertas`}
                badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.status === 'SUCCESS' || row.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.status}</span>}
                showArrow
              />
            )}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
            manualPagination
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRowSelectionChange={handleRowSelection}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noAccess')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const rightPanel = selectedRun ? (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4 pb-2 space-y-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="header-icon-circle flex-none"><FileClock className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base lg:text-lg truncate">{t('title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{selectedRun.run_date ? format(new Date(selectedRun.run_date), 'yyyy-MM-dd HH:mm') : ''}</p>
          </div>
          {(() => {
            const status = selectedRun.status?.toLowerCase();
            const variant: 'success' | 'destructive' | 'secondary' = status === 'completed' || status === 'success' ? 'success' : status === 'failed' ? 'destructive' : 'secondary';
            return <Badge variant={variant} className="flex-none capitalize">{selectedRun.status}</Badge>;
          })()}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 overflow-auto p-4">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('runDate')}</dt>
            <dd className="text-foreground">{selectedRun.run_date ? format(new Date(selectedRun.run_date), 'yyyy-MM-dd HH:mm:ss') : '-'}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Inicio</dt>
              <dd className="text-foreground text-xs">{selectedRun.started_at ? format(new Date(selectedRun.started_at), 'HH:mm:ss') : '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Fin</dt>
              <dd className="text-foreground text-xs">{selectedRun.completed_at ? format(new Date(selectedRun.completed_at), 'HH:mm:ss') : '-'}</dd>
            </div>
          </div>
          {selectedRun.started_at && selectedRun.completed_at && (
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('duration')}</dt>
              <dd className="text-foreground">{((new Date(selectedRun.completed_at).getTime() - new Date(selectedRun.started_at).getTime()) / 1000).toFixed(2)}s</dd>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Reglas procesadas</dt>
              <dd className="text-foreground">{selectedRun.rules_processed ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('alertsCreated')}</dt>
              <dd className="text-foreground">{selectedRun.alerts_created ?? '-'}</dd>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('emailsSent')}</dt>
              <dd className="text-foreground">{selectedRun.emails_sent ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('errorsCount')}</dt>
              <dd className="text-foreground">{selectedRun.errors_count ?? '-'}</dd>
            </div>
          </div>
          {selectedRun.error_details && (
            <div>
              <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Detalles de error</dt>
              <dd>
                <pre className="text-xs whitespace-pre-wrap break-all bg-red-50 text-red-700 rounded p-2 max-h-48 overflow-auto">
                  {typeof selectedRun.error_details === 'string' ? selectedRun.error_details : JSON.stringify(selectedRun.error_details, null, 2)}
                </pre>
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
        isRightPanelOpen={!!selectedRun}
        onBack={handleBack}
        leftPanelDefaultSize={50}
        rightPanelDefaultSize={50}
      />
    </div>
  );
}
