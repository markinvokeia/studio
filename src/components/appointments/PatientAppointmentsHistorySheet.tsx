'use client';

import * as React from 'react';
import { addYears, differenceInMinutes, format, isValid, parseISO } from 'date-fns';
import { ArrowLeft, History } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ColumnDef, SortingState } from '@tanstack/react-table';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';

import { AppointmentPanel } from '@/components/appointments/AppointmentPanel';
import { CancellationNoteDialog } from '@/components/appointments/CancellationNoteDialog';
import { getStatusIcon } from '@/components/appointments/status-icons';
import { TreatmentTimeline } from '@/components/users/clinic-history-viewer';

import { usePatientAppointmentsSheet } from '@/stores/patient-appointments-sheet-store';
import { useAppointmentStatus } from '@/hooks/use-appointment-status';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { api } from '@/services/api';

import type { Appointment, AppointmentStatus, Calendar, CancellationReason, PatientSession } from '@/lib/types';
import { API_ROUTES } from '@/constants/routes';
import { normalizeAppointmentStatus, normalizeCancellationReason, STATUS_BADGE_VARIANT } from '@/constants/appointment-status';
import { formatDisplayDateWithWeekday } from '@/lib/utils';

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
  const locale = useLocale();

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
          patientEmail: apiAppt.patient_email || apiAppt.patientEmail || apiAppt.patientemail,
          patientPhone: apiAppt.patient_phone || apiAppt.patientPhone || apiAppt.patientphone,
          doctorId: String(apiAppt.doctor_id || apiAppt.doctorId || apiAppt.doctorid || ''),
          doctorName: apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || '',
          doctorEmail: apiAppt.doctor_email || apiAppt.doctorEmail || apiAppt.doctoremail || '',
          summary: apiAppt.summary || 'Cita',
          description: apiAppt.description || '',
          notes: apiAppt.notes || '',
          date: format(dt, 'yyyy-MM-dd'),
          time: format(dt, 'HH:mm'),
          status: normalizeAppointmentStatus(apiAppt.status),
          cancellation_reason: normalizeCancellationReason(
            apiAppt.cancellation_reason || apiAppt.cancellationReason || apiAppt.cancellationreason,
          ),
          cancellation_note: apiAppt.cancellation_note || apiAppt.cancellationNote || apiAppt.cancellationnote || null,
          created_at: apiAppt.created_at || apiAppt.createdat,
          google_calendar_id: apiAppt.google_calendar_id || apiAppt.googleCalendarId || undefined,
          googleEventId: apiAppt.google_event_id || apiAppt.googleEventId || apiAppt.googleeventid || apiAppt.id,
          calendar_source_id: calendarSourceId,
          calendar_name: apiAppt.organizer?.displayName || calendar?.name || apiAppt.calendar_name,
          color: apiAppt.color,
          start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
          end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
          services: Array.isArray(apiAppt.services) ? apiAppt.services.map((s: any) => ({
            id: String(s.id),
            name: s.name || '',
            price: Number(s.price || 0),
            category: '',
            duration_minutes: 30,
            is_active: true,
          })) : [],
          quote_id: apiAppt.quote_id || apiAppt.quoteId || apiAppt.quoteid || undefined,
          quote_doc_no: apiAppt.quote_doc_no || apiAppt.quoteDocNo || apiAppt.quotedocno || apiAppt.doc_no || apiAppt.docNo || apiAppt.docno || undefined,
          invoice_id: apiAppt.invoice_id || apiAppt.invoiceId || null,
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

  // Optimistically reflect a status change in the list (the backend is
  // eventually consistent, so re-fetching immediately can read back the old value).
  const applyStatusToList = React.useCallback(
    (
      appointmentId: string,
      newStatus: AppointmentStatus,
      extra?: { cancellation_reason?: CancellationReason | null; cancellation_note?: string | null },
    ) => {
      setAppointments(prev => prev.map(a => a.id === appointmentId
        ? {
            ...a,
            status: newStatus,
            cancellation_reason: newStatus === 'cancelled' ? extra?.cancellation_reason ?? null : null,
            cancellation_note: newStatus === 'cancelled' ? extra?.cancellation_note ?? null : null,
          }
        : a));
    },
    [],
  );

  // ── Appointment detail panel (same panel the timeline opens) ──────────────
  const [isApptPanelOpen, setIsApptPanelOpen] = React.useState(false);
  const [panelAppointment, setPanelAppointment] = React.useState<Appointment | null>(null);
  const [panelLinkedSession, setPanelLinkedSession] = React.useState<PatientSession | null>(null);
  const [isLoadingLinkedSession, setIsLoadingLinkedSession] = React.useState(false);
  const [pendingCancellation, setPendingCancellation] = React.useState<Appointment | null>(null);

  const { updateStatus } = useAppointmentStatus({
    onSuccess: (appointment, newStatus, extra) => {
      applyStatusToList(appointment.id, newStatus, extra);
      setPanelAppointment(prev => prev && prev.id === appointment.id
        ? {
            ...prev,
            status: newStatus,
            cancellation_reason: newStatus === 'cancelled' ? extra?.cancellation_reason ?? null : null,
            cancellation_note: newStatus === 'cancelled' ? extra?.cancellation_note ?? null : null,
          }
        : prev);
    },
  });

  const handlePanelStatusChange = React.useCallback(
    (appt: Appointment, newStatus: AppointmentStatus, extra?: { cancellation_reason?: CancellationReason; cancellation_note?: string }) => {
      updateStatus({ appointment: appt, newStatus, ...extra });
    },
    [updateStatus],
  );

  const openApptPanel = React.useCallback(async (appt: Appointment) => {
    setPanelAppointment(appt);
    setIsApptPanelOpen(true);
    setPanelLinkedSession(null);
    if (!userId) return;
    setIsLoadingLinkedSession(true);
    try {
      const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: userId });
      const raw: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);

      // Match by appointment_id first; fall back to quote_id for older sessions.
      const match =
        raw.find((s: any) => s?.appointment_id != null && String(s.appointment_id) === String(appt.id)) ??
        (appt.quote_id
          ? raw.find((s: any) => s?.quote_id != null && String(s.quote_id) === String(appt.quote_id))
          : undefined);

      setPanelLinkedSession(match ? {
        sesion_id: Number(match.sesion_id || match.id),
        tipo_sesion: match.tipo_sesion,
        fecha_sesion: match.fecha_sesion || '',
        diagnostico: match.diagnostico || null,
        procedimiento_realizado: match.procedimiento_realizado || '',
        notas_clinicas: match.notas_clinicas || '',
        plan_proxima_cita: match.plan_proxima_cita || undefined,
        fecha_proxima_cita: match.fecha_proxima_cita || undefined,
        doctor_id: match.doctor_id || null,
        doctor_name: match.doctor_name || match.nombre_doctor || undefined,
        nombre_doctor: match.nombre_doctor || match.doctor_name || undefined,
        estado_odontograma: match.estado_odontograma,
        tratamientos: match.tratamientos || [],
        archivos_adjuntos: match.archivos_adjuntos || [],
        quote_id: match.quote_id?.toString(),
        quote_doc_no: match.quote_doc_no,
        appointment_id: match.appointment_id?.toString(),
      } as PatientSession : null);
    } catch {
      setPanelLinkedSession(null);
    } finally {
      setIsLoadingLinkedSession(false);
    }
  }, [userId]);

  const columns = React.useMemo<ColumnDef<Appointment>[]>(() => [
    {
      id: 'date',
      accessorFn: (row) => row.start?.dateTime ?? row.date ?? '',
      header: t('columns.date'),
      cell: ({ row }) => {
        const dt = parseApptDateTime(row.original.start?.dateTime)
          ?? (row.original.date ? parseISO(row.original.date) : null);
        return <span className="whitespace-nowrap">{dt && isValid(dt) ? formatDisplayDateWithWeekday(dt, locale) : '—'}</span>;
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
  ], [t, tStatus, tReason, locale]);

  return (
    <>
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
              onRowClick={openApptPanel}
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
                onAppointmentStatusUpdated={applyStatusToList}
                hideToolbar
                forcedTypeFilter="appointment"
              />
            )}
          </div>
        )}
      </div>
    </ResizableSheet>

    {/* Same detail panel the timeline opens, reused for the table rows */}
    <AppointmentPanel
      open={isApptPanelOpen}
      onOpenChange={(open) => { setIsApptPanelOpen(open); if (!open) { setPanelAppointment(null); setPanelLinkedSession(null); } }}
      appointment={panelAppointment}
      linkedSession={panelLinkedSession}
      isLoadingLinkedSession={isLoadingLinkedSession}
      quoteOrder={null}
      quoteInvoices={[]}
      isLoadingQuoteInfo={false}
      onStatusChange={handlePanelStatusChange}
      onRequestCustomCancellation={(appt) => setPendingCancellation(appt)}
      onBillingSuccess={() => { if (userId) fetchAppointments(userId, userName); }}
      hidePatientActions
    />
    <CancellationNoteDialog
      open={!!pendingCancellation}
      onOpenChange={(open) => { if (!open) setPendingCancellation(null); }}
      onConfirm={(note) => {
        if (!pendingCancellation) return;
        handlePanelStatusChange(pendingCancellation, 'cancelled', { cancellation_reason: 'other', cancellation_note: note });
        setPendingCancellation(null);
      }}
    />
    </>
  );
}
