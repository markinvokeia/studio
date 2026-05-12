
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Appointment, AppointmentStatus } from '@/lib/types';
import { CalendarSync, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { createSelectColumn } from '@/components/ui/table-select-column';
import { AppointmentStatusMenu } from '@/components/appointments/AppointmentStatusMenu';
import { canReschedule } from '@/constants/appointment-status';

interface AppointmentColumnsProps {
  t: (key: string) => string;
  tStatus: (key: string) => string;
  tReschedule: (key: string) => string;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
  onStatusChange: (
    appointment: Appointment,
    newStatus: AppointmentStatus,
    extra?: { cancellation_reason?: import('@/lib/types').CancellationReason; cancellation_note?: string },
  ) => void;
  onRequestCustomCancellation?: (appointment: Appointment) => void;
}

export const getAppointmentColumns = ({ t, tReschedule, onEdit, onCancel, onReschedule, onStatusChange, onRequestCustomCancellation }: AppointmentColumnsProps): ColumnDef<Appointment>[] => [
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
      const appointment = row.original;
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <AppointmentStatusMenu
            appointment={appointment}
            onChange={(s, extra) => onStatusChange(appointment, s, extra)}
            onRequestCustomCancellation={
              onRequestCustomCancellation
                ? () => onRequestCustomCancellation(appointment)
                : undefined
            }
          />
        </div>
      );
    },
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
        {onReschedule && (
          <button
            type="button"
            disabled={!canReschedule(appointment.status)}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => onReschedule(appointment)}
          >
            <CalendarSync className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{tReschedule('action')}</span>
          </button>
        )}
        <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onCancel(appointment)}>
          <X className="h-3.5 w-3.5" />
          <span className="text-[9px] font-medium leading-tight">{t('cancel')}</span>
        </button>
        </div>
      );
    },
  },
];

export function AppointmentColumnsWrapper({ onEdit, onCancel, onReschedule, onStatusChange, onRequestCustomCancellation }: { onEdit: (appointment: Appointment) => void; onCancel: (appointment: Appointment) => void; onReschedule?: (appointment: Appointment) => void; onStatusChange: (appointment: Appointment, newStatus: AppointmentStatus) => void; onRequestCustomCancellation?: (appointment: Appointment) => void; }) {
  const t = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tReschedule = useTranslations('AppointmentReschedule');
  const columns: ColumnDef<Appointment>[] = React.useMemo(() => getAppointmentColumns({ t, tStatus, tReschedule, onEdit, onCancel, onReschedule, onStatusChange, onRequestCustomCancellation }), [t, tStatus, tReschedule, onEdit, onCancel, onReschedule, onStatusChange, onRequestCustomCancellation]);
  return columns;
}
