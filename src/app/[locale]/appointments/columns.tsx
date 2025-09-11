
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Appointment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

export const getAppointmentColumns = (t: (key: string) => string): ColumnDef<Appointment>[] => [
    { accessorKey: 'service_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('service')} /> },
    { accessorKey: 'user_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('user')} /> },
    { 
      accessorKey: 'date', 
      header: ({column}) => <DataTableColumnHeader column={column} title={t('date')} />,
      size: 200,
    },
    { accessorKey: 'time', header: ({column}) => <DataTableColumnHeader column={column} title={t('time')} /> },
    { 
      accessorKey: 'status', 
      header: ({column}) => <DataTableColumnHeader column={column} title={t('status')} />,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = {
            completed: 'success',
            confirmed: 'default',
            pending: 'info',
            cancelled: 'destructive',
        }[status.toLowerCase()] || 'default';

        return (
            <Badge variant={variant as any} className="capitalize">{status}</Badge>
        );
      }
    },
    {
        id: 'actions',
        cell: ({ row }) => {
        const appointment = row.original;
        return (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                <DropdownMenuItem>{t('edit')}</DropdownMenuItem>
                <DropdownMenuItem>{t('cancel')}</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        );
        },
    },
];

export const appointmentColumns: ColumnDef<Appointment>[] = [
    { accessorKey: 'service_name', header: ({column}) => <DataTableColumnHeader column={column} title="Service" /> },
    { accessorKey: 'user_name', header: ({column}) => <DataTableColumnHeader column={column} title="User" /> },
    { 
      accessorKey: 'date', 
      header: ({column}) => <DataTableColumnHeader column={column} title="Date" />,
      size: 200,
    },
    { accessorKey: 'time', header: ({column}) => <DataTableColumnHeader column={column} title="Time" /> },
    { 
      accessorKey: 'status', 
      header: ({column}) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = {
            completed: 'success',
            confirmed: 'default',
            pending: 'info',
            cancelled: 'destructive',
        }[status.toLowerCase()] || 'default';

        return (
            <Badge variant={variant as any} className="capitalize">{status}</Badge>
        );
      }
    },
    {
        id: 'actions',
        cell: function Cell() {
            const t = useTranslations('AppointmentsColumns');
            return (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                    <DropdownMenuItem>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem>{t('cancel')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
