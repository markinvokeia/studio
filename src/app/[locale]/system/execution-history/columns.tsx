
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AlertScheduleRun } from '@/lib/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface ExecutionHistoryColumnsProps {
    onViewDetails: (run: AlertScheduleRun) => void;
    t: (key: string) => string;
}

export const ExecutionHistoryColumns = ({ onViewDetails, t }: ExecutionHistoryColumnsProps): ColumnDef<AlertScheduleRun>[] => {
    const columns: ColumnDef<AlertScheduleRun>[] = [
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">{t('openMenu')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewDetails(run)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('viewDetails')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
    return columns;
};
