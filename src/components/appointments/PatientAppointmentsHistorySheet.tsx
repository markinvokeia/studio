'use client';

import * as React from 'react';
import { addYears, differenceInMinutes, format, isValid, parseISO } from 'date-fns';
import { ArrowLeft, History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ColumnDef, SortingState } from '@tanstack/react-table';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';

import { getStatusIcon } from '@/components/appointments/status-icons';
import { TreatmentTimeline } from '@/components/users/clinic-history-viewer';

import { usePatientAppointmentsSheet } from '@/stores/patient-appointments-sheet-store';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { api } from '@/services/api';

import type { Appointment, Calendar } from '@/lib/types';
import { API_ROUTES } from '@/constants/routes';
import { normalizeAppointmentStatus, normalizeCancellationReason, STATUS_BADGE_VARIANT } from '@/constants/appointment-status';

const parseApptDateTime = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = parseISO(value.replace(/Z$/, ''));
  return isValid(parsed) ? parsed : null;
};

/**
 * Global host for the "Historial de Citas" panel opened from the custom
 * calendar mode context menu: every appointment of a patient with its
 * schedule, calendar (agenda) and attendance status.
 */
export function PatientAppointmentsHistorySheet() {
  const { isOpen, userId, userName, close } = usePatientAppointmentsSheet();
  const t = useTranslations('PatientAppointmentsSheet');
  const tStatus = useTranslations('AppointmentStatus');
  const tReason = useTranslations('CancellationReason');

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'date', desc: true }]);
  const [viewMode, setViewMode] = useTableViewMode('patient-appointments-sheet', 'table');
  const calendarsRef = React.useRef<Calendar[]>([]);

  // Only the session-related callbacks the timeline requires; instantiating the
  // hook triggers no fetches by itself.
  const {
    doctors,
    isLoadingDoctors,
    fetchDoctors,
    isSubmittingSession,
    createSession,
    updateSession,
    deleteSession,
    fetchPatientSessions,
    getSessionAttachment,
  } = useClinicHistory();

  const fetchAppointments = React.useCallback(async (currentUserId: string, currentUserName?: string) => {
    setIsLoading(true);
    try {
      if (calendarsRef.current.length === 0) {
        try {
          const data = await api.get(API_ROUTES.CALENDARS);
          const list = Array.isArray(data) ? data : (data?.calendars || data?.data || data?.result || []);
          calendarsRef.current = list.map((c: any) => ({ id: String(c.id), name: c.name } as Calendar));
        } catch {
          calendarsRef.current = [];
        }
      }

      const now = new Date();
      const formatRange = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');
      const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
        startingDateAndTime: formatRange(addYears(now, -10)),
        endingDateAndTime: formatRange(addYears(now, 2)),
        user_id: currentUserId,
      });
      let raw: any[] = [];
      if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
        raw = data.map((item: any) => item.json);
      } else if (Array.isArray(data)) {
        raw = data;
      }
      const mapped: Appointment[] = raw.map((apiAppt: any) => {
        const startNode = apiAppt.start_time || apiAppt.start;
        const dtStr = typeof startNode === 'string' ? startNode : startNode?.dateTime;
        if (!dtStr) return null;
        const dt = parseApptDateTime(dtStr);
        if (!dt) return null;
        const endNode = apiAppt.end_time || apiAppt.end;
        const calendarSourceId = apiAppt.calendar_source_id != null ? String(apiAppt.calendar_source_id) : '';
        const calendar = calendarsRef.current.find((c) => String(c.id) === calendarSourceId);
        return {
          id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id),
          patientId: currentUserId,
          patientName: apiAppt.patient_name || apiAppt.patientName || apiAppt.patientname || currentUserName || '',
          doctorId: String(apiAppt.doctor_id || apiAppt.doctorId || apiAppt.doctorid || ''),
          doctorName: apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || '',
          summary: apiAppt.summary || 'Cita',
          date: format(dt, 'yyyy-MM-dd'),
          time: format(dt, 'HH:mm'),
          status: normalizeAppointmentStatus(apiAppt.status),
          cancellation_reason: normalizeCancellationReason(
            apiAppt.cancellation_reason || apiAppt.cancellationReason || apiAppt.cancellationreason,
          ),
          calendar_source_id: calendarSourceId,
          calendar_name: apiAppt.organizer?.displayName || calendar?.name || apiAppt.calendar_name,
          start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
          end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        } as Appointment;
      }).filter(Boolean) as Appointment[];
      setAppointments(mapped);
    } catch {
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen && userId) {
      fetchAppointments(userId, userName);
    } else if (!isOpen) {
      setAppointments([]);
    }
  }, [isOpen, userId, userName, fetchAppointments]);

  const columns = React.useMemo<ColumnDef<Appointment>[]>(() => [
    {
      id: 'date',
      accessorFn: (row) => row.start?.dateTime ?? row.date ?? '',
      header: t('columns.date'),
      cell: ({ row }) => {
        const dt = parseApptDateTime(row.original.start?.dateTime)
          ?? (row.original.date ? parseISO(row.original.date) : null);
        return <span className="whitespace-nowrap">{dt && isValid(dt) ? format(dt, 'dd/MM/yyyy') : '—'}</span>;
      },
    },
    {
      id: 'time',
      header: t('columns.time'),
      enableSorting: false,
      cell: ({ row }) => {
        const start = parseApptDateTime(row.original.start?.dateTime);
        const end = parseApptDateTime(row.original.end?.dateTime);
        if (!start) return '—';
        return (
          <span className="whitespace-nowrap">
            {format(start, 'HH:mm')}{end ? ` – ${format(end, 'HH:mm')}` : ''}
          </span>
        );
      },
    },
    {
      id: 'duration',
      header: t('columns.duration'),
      enableSorting: false,
      cell: ({ row }) => {
        const start = parseApptDateTime(row.original.start?.dateTime);
        const end = parseApptDateTime(row.original.end?.dateTime);
        if (!start || !end) return '—';
        return <span className="whitespace-nowrap">{t('durationMinutes', { min: differenceInMinutes(end, start) })}</span>;
      },
    },
    {
      accessorKey: 'calendar_name',
      header: t('columns.calendar'),
      cell: ({ row }) => row.original.calendar_name || '—',
    },
    {
      accessorKey: 'status',
      header: t('columns.attendance'),
      cell: ({ row }) => {
        const appt = row.original;
        const StatusIcon = getStatusIcon(appt.status, appt.cancellation_reason);
        const statusVariant = (STATUS_BADGE_VARIANT[appt.status] ?? 'default') as
          'default' | 'success' | 'destructive' | 'info' | 'warning' | 'secondary' | 'outline';
        return (
          <Badge variant={statusVariant} className="capitalize gap-1 text-xs px-2 py-0.5">
            <StatusIcon className="h-3 w-3" />
            {appt.status === 'cancelled' && appt.cancellation_reason
              ? tReason(appt.cancellation_reason)
              : tStatus(appt.status)}
          </Badge>
        );
      },
    },
  ], [t, tStatus, tReason]);

  return (
    <ResizableSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) close(); }}
      defaultWidth={860}
      minWidth={520}
      maxWidth={1200}
      storageKey="patient-appointments-sheet-width"
    >
      <div className="flex h-full flex-col overflow-hidden bg-card">
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4 pr-20">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-foreground">{t('title')}</SheetTitle>
            <SheetDescription className="truncate text-sm text-muted-foreground">{userName || ''}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <Button variant="ghost" size="sm" onClick={close}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t('back')}
          </Button>
          <ViewModeToggle value={viewMode} onChange={setViewMode} className="ml-auto" />
        </div>
        {viewMode === 'table' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <DataTable
              columns={columns}
              data={appointments}
              isLoading={isLoading}
              sorting={sorting}
              onSortingChange={setSorting}
              useGlobalFilter
              filterPlaceholder={t('searchPlaceholder')}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {userId && (
              <TreatmentTimeline
                sessions={[]}
                appointments={appointments}
                isLoading={false}
                isLoadingAppointments={isLoading}
                userId={userId}
                userName={userName}
                doctors={doctors}
                isLoadingDoctors={isLoadingDoctors}
                isSubmittingSession={isSubmittingSession}
                onCreateSession={createSession}
                onUpdateSession={updateSession}
                onDeleteSession={deleteSession}
                onFetchDoctors={fetchDoctors}
                onRefreshAll={async (uid) => { await fetchPatientSessions(uid); }}
                onLoadSessionAttachment={getSessionAttachment}
                onRefreshAppointments={() => fetchAppointments(userId, userName)}
                onAppointmentStatusUpdated={(appointmentId, newStatus, extra) => {
                  setAppointments(prev => prev.map(a => a.id === appointmentId
                    ? {
                        ...a,
                        status: newStatus,
                        cancellation_reason: newStatus === 'cancelled' ? extra?.cancellation_reason ?? null : null,
                        cancellation_note: newStatus === 'cancelled' ? extra?.cancellation_note ?? null : null,
                      }
                    : a));
                }}
                hideToolbar
                forcedTypeFilter="appointment"
              />
            )}
          </div>
        )}
      </div>
    </ResizableSheet>
  );
}
