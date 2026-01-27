
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertScheduleRun } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { api } from '@/services/api';
import { ExecutionDetailDialog } from './execution-detail-dialog';
import { ExecutionHistoryColumns } from './columns';

export default function ExecutionHistoryPage() {
  const t = useTranslations('ExecutionHistoryPage');
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
  const columns = React.useMemo(() => ExecutionHistoryColumns({ onViewDetails: handleViewDetails, t: tColumns }), []);

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
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="flex-none">
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <DataTable
              columns={columns}
              data={runs}
              filterColumnId="status"
              filterPlaceholder={t('filterPlaceholder')}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              manualPagination
          />
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
