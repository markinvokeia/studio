
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertScheduleRun } from '@/lib/types';
import { api } from '@/services/api';
import { FileClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DataCard } from '@/components/ui/data-card';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { ExecutionHistoryColumns } from './columns';
import { ExecutionDetailDialog } from './execution-detail-dialog';

export default function ExecutionHistoryPage() {
  const t = useTranslations('ExecutionHistoryPage');
  const { hasPermission } = usePermissions();
  const canViewList = hasPermission(SYSTEM_PERMISSIONS.ALERT_EXECUTIONS_VIEW_LIST);
  const canViewDetail = hasPermission(SYSTEM_PERMISSIONS.ALERT_EXECUTIONS_VIEW_DETAIL);
  const isNarrow = useViewportNarrow();
  const [runs, setRuns] = React.useState<AlertScheduleRun[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [selectedRun, setSelectedRun] = React.useState<AlertScheduleRun | null>(null);

  const fetchRuns = async (page: number, limit: number) => {
    try {
      const response = await api.get('/system/alert-execution-history', { page: page.toString(), limit: limit.toString() });
      setRuns(response);
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
    }
  };

  React.useEffect(() => {
    fetchRuns(1, 10);
  }, []);

  const handleViewDetails = (run: AlertScheduleRun) => {
    setSelectedRun(run);
    setDetailDialogOpen(true);
  };

  const tColumns = useTranslations('ExecutionHistoryPage.columns');
  const columns = React.useMemo(() => ExecutionHistoryColumns({ onViewDetails: canViewDetail ? handleViewDetails : undefined, t: tColumns }), [tColumns, canViewDetail]);

  const onPaginationChange: React.Dispatch<React.SetStateAction<typeof pagination>> = (updater) => {
    const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
    setPagination(newPagination);
    fetchRuns(newPagination.pageIndex + 1, newPagination.pageSize);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchRuns(pagination.pageIndex + 1, pagination.pageSize);
    } catch (error) {
      console.error('Failed to refresh execution history:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-0">
        <CardHeader className="flex-none p-4">
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <FileClock className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-left">
              <CardTitle className="text-lg">{t('title')}</CardTitle>
              <CardDescription className="text-xs">{t('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
          {canViewList ? (
            <DataTable
              columns={columns}
              data={runs}
              filterColumnId="status"
              filterPlaceholder={t('filterPlaceholder')}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              isNarrow={isNarrow}
              renderCard={(row: AlertScheduleRun) => (
                <DataCard
                  title={row.run_date}
                  subtitle={`${row.rules_processed} reglas · ${row.alerts_created} alertas`}
                  badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.status}</span>}
                  showArrow
                />
              )}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              manualPagination
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">{t('noAccess')}</p>
            </div>
          )}
        </CardContent>
        <ExecutionDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          run={selectedRun}
        />
      </Card>
    </div>
  );
}
