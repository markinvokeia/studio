
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Appointment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface AppointmentColumnsProps {
  t: (key: string) => string;
  tStatus: (key: string) => string;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
}

export const getAppointmentColumns = ({ t, tStatus, onEdit, onCancel }: AppointmentColumnsProps): ColumnDef<Appointment>[] => [
  createSelectColumn<Appointment>(),
  { accessorKey: 'summary', header: ({ column }) => <DataTableColumnHeader column={column} title={t('service')} /> },
  { accessorKey: 'patientName', header: ({ column }) => <DataTableColumnHeader column={column} title={t('patient')} /> },
  { accessorKey: 'doctorName', header: ({ column }) => <DataTableColumnHeader column={column} title={t('doctor')} /> },
  { accessorKey: 'calendar_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('calendar')} /> },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('date')} />,
    size: 200,
  },
  { accessorKey: 'time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('time')} /> },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = {
        completed: 'success',
        confirmed: 'default',
        pending: 'info',
        cancelled: 'destructive',
        scheduled: 'info',
      }[status.toLowerCase()] || 'default';

      return (
        <Badge variant={variant as any} className="capitalize">{tStatus(status.toLowerCase())}</Badge>
      );
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const appointment = row.original;
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(appointment)}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onCancel(appointment)}>
          <X className="h-3.5 w-3.5" />
          <span className="text-[9px] font-medium leading-tight">{t('cancel')}</span>
        </button>
        </div>
      );
    },
  },
];

export function AppointmentColumnsWrapper({ onEdit, onCancel }: { onEdit: (appointment: Appointment) => void; onCancel: (appointment: Appointment) => void; }) {
  const t = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const columns: ColumnDef<Appointment>[] = React.useMemo(() => getAppointmentColumns({ t, tStatus, onEdit, onCancel }), [t, tStatus, onEdit, onCancel]);
  return columns;
}
