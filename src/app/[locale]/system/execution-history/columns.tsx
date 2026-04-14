
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AlertScheduleRun } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface ExecutionHistoryColumnsProps {
    onViewDetails?: (run: AlertScheduleRun) => void;
    t: (key: string) => string;
}

export const ExecutionHistoryColumns = ({ onViewDetails, t }: ExecutionHistoryColumnsProps): ColumnDef<AlertScheduleRun>[] => {
    const columns: ColumnDef<AlertScheduleRun>[] = [
        createSelectColumn<AlertScheduleRun>(),
        {
            accessorKey: 'run_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('runDate')} />,
            cell: ({ row }) => format(new Date(row.original.run_date), 'yyyy-MM-dd HH:mm'),
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
            cell: ({ row }) => {
                const status = row.original.status.toLowerCase();
                const variant: 'success' | 'destructive' | 'secondary' = status === 'completed' ? 'success' : status === 'failed' ? 'destructive' : 'secondary';
                return <Badge variant={variant} className="capitalize">{status}</Badge>;
            }
        },
        {
            accessorKey: 'alerts_created',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('alertsCreated')} />,
        },
        {
            accessorKey: 'emails_sent',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('emailsSent')} />,
        },
        {
            accessorKey: 'errors_count',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('errorsCount')} />,
        },
        {
            accessorKey: 'duration',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('duration')} />,
            cell: ({ row }) => {
                if (!row.original.completed_at) return 'N/A';
                const duration = new Date(row.original.completed_at).getTime() - new Date(row.original.started_at).getTime();
                return `${(duration / 1000).toFixed(2)}s`;
            }
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const run = row.original;
                return (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {onViewDetails && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onViewDetails(run)}>
                            <Eye className="h-3.5 w-3.5" />
                            <span className="text-[9px] font-medium leading-tight">{t('viewDetails')}</span>
                        </button>}
                    </div>
                );
            },
        },
    ];
    return columns;
};
