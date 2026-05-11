'use client';

import { PatientDetailSheet } from '@/components/appointments/PatientDetailSheet';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { DoctorAgentChat } from '@/components/dashboard/doctor-agent-chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { usePermissions } from '@/hooks/usePermissions';
import { canManageDoctorWorkspaceSessions } from '@/lib/permissions';
import { Appointment, DoctorAgentAction, PatientSession, QuoteItem, TreatmentDetail } from '@/lib/types';
import { formatDate, formatDateTime, formatDisplayDate } from '@/lib/utils';
import { api } from '@/services/api';
import { getQuoteItems } from '@/services/quotes';
import { format, parseISO } from 'date-fns';
import {
  Activity,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  TimerReset,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type AppointmentStatus = 'completed' | 'confirmed' | 'pending' | 'cancelled' | 'scheduled';

interface DoctorWorkspaceProps {
  locale: string;
}

const AUTO_REFRESH_MS = 60_000;

const STATUS_VARIANTS: Record<AppointmentStatus, 'success' | 'default' | 'info' | 'destructive'> = {
  completed: 'success',
  confirmed: 'default',
  pending: 'info',
  cancelled: 'destructive',
  scheduled: 'info',
};

function getStatusCount(appointments: Appointment[], status: AppointmentStatus) {
  return appointments.filter((appointment) => appointment.status.toLowerCase() === status).length;
}

function getTimeRangeLabel(appointment: Appointment): string {
  const startTime = appointment.time || '00:00';
  const endTime = appointment.end?.dateTime
    ? format(parseISO(appointment.end.dateTime.replace(/Z$/, '')), 'HH:mm')
    : undefined;

  return endTime ? `${startTime} - ${endTime}` : startTime;
}

async function getAppointmentsForDoctorToday(doctorId: string): Promise<Appointment[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

  const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
    doctor_id: doctorId,
    startingDateAndTime: formatDateForAPI(startOfDay),
    endingDateAndTime: formatDateForAPI(endOfDay),
  });

  let rawAppointments: any[] = [];
  if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
    rawAppointments = data.map((item: any) => item.json);
  } else if (Array.isArray(data)) {
    rawAppointments = data;
  }

  return rawAppointments
    .map((apiAppointment: any): Appointment | null => {
      const startNode = apiAppointment.start_time || apiAppointment.start;
      const startDateTime = typeof startNode === 'string' ? startNode : startNode?.dateTime;
      if (!startDateTime) return null;

      const parsedStart = parseISO(startDateTime.replace(/Z$/, ''));
      if (Number.isNaN(parsedStart.getTime())) return null;

      const endNode = apiAppointment.end_time || apiAppointment.end;
      const doctorIdValue = apiAppointment.doctor_id || apiAppointment.doctorId || apiAppointment.doctorid || doctorId;

      return {
        id: String(apiAppointment.appointment_id || apiAppointment.appointmentId || apiAppointment.id || ''),
        patientId: String(apiAppointment.patient_id || apiAppointment.patientId || apiAppointment.patientid || ''),
        patientName: apiAppointment.patient_name || apiAppointment.patientName || apiAppointment.patientname || '',
        patientEmail: apiAppointment.patient_email || apiAppointment.patientEmail || apiAppointment.patientemail || '',
        patientPhone: apiAppointment.patient_phone || apiAppointment.patientPhone || apiAppointment.patientphone || '',
        doctorId: String(doctorIdValue),
        doctorName: apiAppointment.doctor_name || apiAppointment.doctorName || apiAppointment.doctorname || '',
        doctorEmail: apiAppointment.doctor_email || apiAppointment.doctorEmail || apiAppointment.doctoremail || '',
        summary: apiAppointment.summary || '',
        service_name: apiAppointment.summary || '',
        description: apiAppointment.description || '',
        notes: apiAppointment.notes || '',
        date: format(parsedStart, 'yyyy-MM-dd'),
        time: format(parsedStart, 'HH:mm'),
        status: apiAppointment.status || 'confirmed',
        created_at: apiAppointment.created_at || apiAppointment.createdAt || '',
        google_calendar_id: apiAppointment.google_calendar_id || undefined,
        googleEventId: apiAppointment.google_event_id || apiAppointment.googleEventId || apiAppointment.id,
        calendar_source_id: apiAppointment.calendar_source_id != null ? String(apiAppointment.calendar_source_id) : '',
        calendar_name: apiAppointment.calendar_name || apiAppointment.organizer?.displayName || '',
        color: apiAppointment.color,
        colorId: String(apiAppointment.color_id || apiAppointment.colorId || ''),
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        services: Array.isArray(apiAppointment.services)
          ? apiAppointment.services.map((service: any) => ({
              id: String(service.id),
              name: service.name || '',
              price: Number(service.price || 0),
              category: '',
              duration_minutes: 30,
              is_active: true,
            }))
          : [],
        quote_id: apiAppointment.quote_id || apiAppointment.quoteId || undefined,
        quote_doc_no: apiAppointment.quote_doc_no || apiAppointment.quoteDocNo || undefined,
      } as Appointment;
    })
    .filter((appointment): appointment is Appointment => appointment !== null)
    .sort((left, right) => left.time.localeCompare(right.time));
}

export function DoctorWorkspace({ locale }: DoctorWorkspaceProps) {
  const t = useTranslations('DoctorWorkspace');
  const tStatus = useTranslations('AppointmentStatus');
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { createSession, updateSession } = useClinicHistory();
  const canManageSessions = React.useMemo(() => canManageDoctorWorkspaceSessions(permissions), [permissions]);

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [linkedSession, setLinkedSession] = React.useState<PatientSession | null>(null);
  const [patientSessions, setPatientSessions] = React.useState<PatientSession[]>([]);
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
  const [isLoadingLinkedSession, setIsLoadingLinkedSession] = React.useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [patientSheetOpen, setPatientSheetOpen] = React.useState(false);
  const [clinicSessionOpen, setClinicSessionOpen] = React.useState(false);
  const [patientSheetInitialTab, setPatientSheetInitialTab] = React.useState<'clinical-history' | 'appointments' | 'messages' | 'notes'>('clinical-history');
  const [patientSheetDefaultView, setPatientSheetDefaultView] = React.useState<'anamnesis' | 'timeline' | 'documents'>('timeline');
  const [agentSessionPrefill, setAgentSessionPrefill] = React.useState<{
    doctor_id?: string;
    doctor_name?: string;
    procedimiento_realizado?: string;
    plan_proxima_cita?: string;
    fecha_proxima_cita?: string;
  } | null>(null);
  const [agentSessionTreatments, setAgentSessionTreatments] = React.useState<TreatmentDetail[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);
  const contextRequestRef = React.useRef(0);

  const selectedAppointment = React.useMemo(
    () => appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? appointments[0] ?? null,
    [appointments, selectedAppointmentId],
  );

  const loadAppointments = React.useCallback(async (background = false) => {
    if (!user?.id) {
      setAppointments([]);
      setIsLoadingAppointments(false);
      return;
    }

    if (background) setIsRefreshing(true);
    else setIsLoadingAppointments(true);

    try {
      const data = await getAppointmentsForDoctorToday(String(user.id));
      React.startTransition(() => {
        setAppointments(data);
        setSelectedAppointmentId((current) => {
          if (current && data.some((appointment) => appointment.id === current)) return current;
          return data[0]?.id ?? null;
        });
        setLastUpdatedAt(new Date());
      });
    } catch (error) {
      console.error('Failed to load doctor workspace appointments:', error);
    } finally {
      setIsRefreshing(false);
      setIsLoadingAppointments(false);
    }
  }, [user?.id]);

  const loadLinkedSession = React.useCallback(async (appointment: Appointment | null, requestId?: number) => {
    if (!appointment?.patientId) {
      setLinkedSession(null);
      setPatientSessions([]);
      return;
    }

    setIsLoadingLinkedSession(true);
    try {
      const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: appointment.patientId });
      const rawSessions: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
      const sessions = rawSessions
        .map((session) => ({ ...session, sesion_id: Number(session.sesion_id) } as PatientSession))
        .sort((left, right) => {
          const leftDate = Date.parse(left.fecha_sesion || '');
          const rightDate = Date.parse(right.fecha_sesion || '');
          return Number.isNaN(rightDate) || Number.isNaN(leftDate) ? 0 : rightDate - leftDate;
        });
      const match = sessions.find((session) => String(session?.appointment_id ?? '') === appointment.id);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setPatientSessions(sessions);
      setLinkedSession(match ? ({ ...match, sesion_id: Number(match.sesion_id) } as PatientSession) : null);
    } catch (error) {
      console.error('Failed to load linked session:', error);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setLinkedSession(null);
      setPatientSessions([]);
    } finally {
      if (requestId == null || requestId === contextRequestRef.current) {
        setIsLoadingLinkedSession(false);
      }
    }
  }, []);

  const loadQuoteItems = React.useCallback(async (appointment: Appointment | null, requestId?: number) => {
    if (!appointment?.quote_id) {
      setQuoteItems([]);
      return;
    }

    try {
      const items = await getQuoteItems(appointment.quote_id);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setQuoteItems(items);
    } catch (error) {
      console.error('Failed to load quote items for doctor workspace:', error);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setQuoteItems([]);
    }
  }, []);

  React.useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  React.useEffect(() => {
    if (!selectedAppointment) {
      setLinkedSession(null);
      setPatientSessions([]);
      setQuoteItems([]);
      return;
    }

    contextRequestRef.current += 1;
    const requestId = contextRequestRef.current;

    loadLinkedSession(selectedAppointment, requestId);
    loadQuoteItems(selectedAppointment, requestId);
  }, [loadLinkedSession, loadQuoteItems, selectedAppointment]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      loadAppointments(true);
    }, AUTO_REFRESH_MS);

    const handleFocus = () => {
      loadAppointments(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadAppointments]);

  const handleSaveClinicSession = React.useCallback(async (data: ClinicSessionFormData) => {
    if (!selectedAppointment?.patientId) return;

    if (linkedSession?.sesion_id) {
      await updateSession(
        linkedSession.sesion_id,
        selectedAppointment.patientId,
        data,
        data.archivos_adjuntos,
        data.deletedAttachmentIds,
        linkedSession.archivos_adjuntos,
      );
    } else {
      await createSession(selectedAppointment.patientId, data, data.archivos_adjuntos);
    }

    await loadLinkedSession(selectedAppointment);
    await loadAppointments(true);
  }, [
    createSession,
    linkedSession?.archivos_adjuntos,
    linkedSession?.sesion_id,
    loadAppointments,
    loadLinkedSession,
    selectedAppointment,
    updateSession,
  ]);

  const kpis = [
    { id: 'total', label: t('kpis.totalToday'), value: appointments.length, icon: CalendarCheck2 },
    { id: 'confirmed', label: t('kpis.confirmed'), value: getStatusCount(appointments, 'confirmed'), icon: Activity },
    { id: 'pending', label: t('kpis.pending'), value: getStatusCount(appointments, 'pending') + getStatusCount(appointments, 'scheduled'), icon: Clock3 },
    { id: 'completed', label: t('kpis.completed'), value: getStatusCount(appointments, 'completed'), icon: ClipboardCheck },
  ];

  const prefillTreatments = React.useMemo(
    () =>
      quoteItems.map((item) => {
        const toothNumber = item.tooth_number != null ? Number(item.tooth_number) : null;

        return {
          numero_diente: toothNumber != null && !Number.isNaN(toothNumber) && toothNumber > 0 ? toothNumber : null,
          descripcion: item.service_name,
        };
      }),
    [quoteItems],
  );

  const nextActionLabel = linkedSession ? t('focus.editSession') : t('focus.completeSession');
  const sessionHeadline = linkedSession?.procedimiento_realizado || t('focus.noSessionLinked');
  const sessionNotesPreview = linkedSession?.notas_clinicas || linkedSession?.diagnostico || t('focus.noSessionNotes');
  const sessionPlanPreview = linkedSession?.plan_proxima_cita || t('focus.noSessionPlan');
  const quoteItemPreview = quoteItems.slice(0, 4);

  const clearAgentSessionDraft = React.useCallback(() => {
    setAgentSessionPrefill(null);
    setAgentSessionTreatments([]);
  }, []);

  const handlePatientSheetOpenChange = React.useCallback((open: boolean) => {
    setPatientSheetOpen(open);
    if (!open) {
      setPatientSheetInitialTab('clinical-history');
      setPatientSheetDefaultView('timeline');
    }
  }, []);

  const handleClinicSessionOpenChange = React.useCallback((open: boolean) => {
    setClinicSessionOpen(open);
    if (!open) {
      clearAgentSessionDraft();
    }
  }, [clearAgentSessionDraft]);

  const handleDoctorAgentAction = React.useCallback((action: DoctorAgentAction) => {
    const payload = action.payload || {};

    if (payload.appointment_id) {
      setSelectedAppointmentId(payload.appointment_id);
    }

    switch (action.type) {
      case 'select_appointment':
        return;
      case 'open_patient_detail':
        setPatientSheetInitialTab('clinical-history');
        setPatientSheetDefaultView('timeline');
        setPatientSheetOpen(true);
        return;
      case 'open_clinical_history':
        setPatientSheetInitialTab('clinical-history');
        setPatientSheetDefaultView(payload.clinical_history_view || 'timeline');
        setPatientSheetOpen(true);
        return;
      case 'open_patient_appointments':
        setPatientSheetInitialTab('appointments');
        setPatientSheetDefaultView('timeline');
        setPatientSheetOpen(true);
        return;
      case 'open_patient_messages':
        setPatientSheetInitialTab('messages');
        setPatientSheetDefaultView('timeline');
        setPatientSheetOpen(true);
        return;
      case 'open_patient_notes':
        setPatientSheetInitialTab('notes');
        setPatientSheetDefaultView('timeline');
        setPatientSheetOpen(true);
        return;
      case 'open_clinic_session':
        setAgentSessionPrefill({
          doctor_id: payload.doctor_id,
          doctor_name: payload.doctor_name,
          procedimiento_realizado: payload.procedimiento_realizado,
          plan_proxima_cita: payload.plan_proxima_cita,
          fecha_proxima_cita: payload.fecha_proxima_cita,
        });
        setAgentSessionTreatments(payload.tratamientos || []);
        setClinicSessionOpen(true);
        return;
      default:
        return;
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 pr-2 min-h-0">
      <div className="flex w-full flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,30%)_minmax(0,70%)]">
          <Card className="min-h-[720px] border-border/70 xl:sticky xl:top-4">
            <CardHeader className="space-y-4 border-b border-border/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{t('agenda.title')}</CardTitle>
                  <CardDescription>{t('agenda.description')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadAppointments(true)} disabled={isRefreshing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {t('agenda.refresh')}
                </Button>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('todayLabel', { date: formatDisplayDate(new Date()) })}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {lastUpdatedAt ? t('lastUpdated', { time: formatDateTime(lastUpdatedAt) }) : t('lastUpdatedPending')}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                    {t('autoRefresh', { seconds: AUTO_REFRESH_MS / 1000 })}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {kpis.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/70 bg-white/80 px-3 py-3 shadow-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{item.label}</span>
                      <item.icon className="h-4 w-4 text-sky-600" />
                    </div>
                    <div className="text-2xl font-semibold leading-none text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </CardHeader>

            <CardContent className="min-h-0 space-y-3 overflow-auto">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('agenda.title')}</p>
              </div>

              {isLoadingAppointments ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <p className="text-sm font-medium text-foreground">{t('agenda.emptyTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('agenda.emptyDescription')}</p>
                </div>
              ) : (
                appointments.map((appointment) => {
                  const normalizedStatus = (appointment.status.toLowerCase() || 'confirmed') as AppointmentStatus;
                  const serviceLabel = appointment.services?.length
                    ? appointment.services.map((service) => service.name).join(', ')
                    : appointment.service_name || appointment.summary;

                  return (
                    <DataCard
                      key={appointment.id}
                      title={appointment.patientName || t('agenda.unknownPatient')}
                      subtitle={`${getTimeRangeLabel(appointment)} • ${serviceLabel}`}
                      avatar={appointment.patientName || 'P'}
                      accentColor={selectedAppointment?.id === appointment.id ? '#0f766e' : undefined}
                      badge={
                        <Badge variant={STATUS_VARIANTS[normalizedStatus] || 'default'} className="capitalize">
                          {tStatus(normalizedStatus)}
                        </Badge>
                      }
                      isSelected={selectedAppointment?.id === appointment.id}
                      showArrow
                      onClick={() => setSelectedAppointmentId(appointment.id)}
                      className="border-border/70 rounded-2xl bg-white/85"
                      actions={
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setSelectedAppointmentId(appointment.id); setPatientSheetOpen(true); }}>
                            <UserRound className="mr-1.5 h-3.5 w-3.5" />
                            {t('agenda.viewPatient')}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={!canManageSessions}
                            onClick={() => {
                              if (!canManageSessions) return;
                              setSelectedAppointmentId(appointment.id);
                              setClinicSessionOpen(true);
                            }}
                          >
                            <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
                            {t('agenda.startSession')}
                          </Button>
                        </div>
                      }
                    />
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="min-h-[720px] border-border/70">
              <CardHeader className="border-b border-border/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))]">
                <CardTitle>{t('focus.title')}</CardTitle>
                <CardDescription>{t('focus.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAppointment ? (
                  <>
                    <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                      <div className="border-b border-slate-200/80 px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('focus.workspaceLabel')}</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedAppointment.patientName || t('agenda.unknownPatient')}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{selectedAppointment.service_name || selectedAppointment.summary}</p>
                          </div>
                          <Badge variant={STATUS_VARIANTS[(selectedAppointment.status.toLowerCase() as AppointmentStatus)] || 'default'} className="capitalize rounded-full px-3 py-1">
                            {tStatus(selectedAppointment.status.toLowerCase())}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('focus.date')}</p>
                          <p className="mt-2 text-sm font-semibold">{formatDisplayDate(selectedAppointment.date)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('focus.time')}</p>
                          <p className="mt-2 text-sm font-semibold">{getTimeRangeLabel(selectedAppointment)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('focus.calendar')}</p>
                          <p className="mt-2 text-sm font-semibold">{selectedAppointment.calendar_name || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('focus.quote')}</p>
                          <p className="mt-2 text-sm font-semibold">{selectedAppointment.quote_doc_no || '—'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-border/70 bg-white/85 p-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('focus.sessionStatusTitle')}</p>
                          </div>
                          {isLoadingLinkedSession ? (
                            <div className="mt-3 space-y-3">
                              <Skeleton className="h-8 w-full rounded-2xl" />
                              <Skeleton className="h-20 w-full rounded-3xl" />
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              <div className="rounded-2xl bg-emerald-50/80 p-3">
                                <p className="text-sm font-semibold text-emerald-900">{linkedSession ? t('focus.sessionReady') : t('focus.sessionMissing')}</p>
                                <p className="mt-1 text-sm leading-6 text-emerald-950/80">{sessionHeadline}</p>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('focus.notesPreviewTitle')}</p>
                                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">{sessionNotesPreview}</p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('focus.planPreviewTitle')}</p>
                                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">{sessionPlanPreview}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-3xl border border-border/70 bg-white/85 p-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <TimerReset className="h-4 w-4 text-sky-600" />
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('focus.patientSnapshotTitle')}</p>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('focus.recentSessionsTitle')}</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">{patientSessions.length}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('focus.quoteItemsTitle')}</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">{quoteItems.length}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('focus.nextActionTitle')}</p>
                              <p className="mt-2 text-sm font-semibold text-foreground">{nextActionLabel}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-3xl border border-border/70 bg-white/85 p-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-700" />
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('focus.quoteItemsPanelTitle')}</p>
                          </div>
                          <div className="mt-3 space-y-2">
                            {quoteItemPreview.length > 0 ? (
                              quoteItemPreview.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-border/70 bg-slate-50/80 p-3">
                                  <p className="text-sm font-medium text-foreground">{item.service_name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.tooth_number ? `${t('focus.toothLabel')} ${item.tooth_number}` : t('focus.generalTreatmentLabel')}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 p-3 text-sm text-muted-foreground">
                                {t('focus.noQuoteItems')}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-border/70 bg-white/85 p-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-amber-600" />
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('focus.actionsTitle')}</p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => setPatientSheetOpen(true)}>
                              <UserRound className="mr-2 h-4 w-4" />
                              {t('focus.openPatient')}
                            </Button>
                            <Button onClick={() => setClinicSessionOpen(true)} disabled={!canManageSessions}>
                              <ClipboardCheck className="mr-2 h-4 w-4" />
                              {nextActionLabel}
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-dashed border-border bg-slate-50/80 p-4 shadow-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('focus.agentPanelTitle')}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('focus.agentPanelDescription')}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                    {t('focus.empty')}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      <DoctorAgentChat
        appointmentId={selectedAppointment?.id}
        locale={locale}
        patientName={selectedAppointment?.patientName}
        userId={user?.id ? String(user.id) : undefined}
        onAction={handleDoctorAgentAction}
      />

      {selectedAppointment && (
        <PatientDetailSheet
          open={patientSheetOpen}
          onOpenChange={handlePatientSheetOpenChange}
          userId={selectedAppointment.patientId}
          userName={selectedAppointment.patientName}
          userEmail={selectedAppointment.patientEmail}
          userPhone={selectedAppointment.patientPhone}
          mode="doctor"
          clinicalHistoryDefaultView={patientSheetDefaultView}
          initialTab={patientSheetInitialTab}
        />
      )}

      {selectedAppointment && canManageSessions && (
        <ClinicSessionDialog
          open={clinicSessionOpen}
          onOpenChange={handleClinicSessionOpenChange}
          onSave={handleSaveClinicSession}
          userId={selectedAppointment.patientId}
          appointmentId={selectedAppointment.id}
          quoteId={selectedAppointment.quote_id}
          serviceName={selectedAppointment.services?.length
            ? selectedAppointment.services.map((service) => service.name).join(', ')
            : selectedAppointment.service_name}
          defaultDate={selectedAppointment.start?.dateTime
            ? parseISO(selectedAppointment.start.dateTime.replace(/Z$/, ''))
            : parseISO(`${formatDate(selectedAppointment.date)}T${selectedAppointment.time || '00:00'}:00`)}
          showTreatments={true}
          showAttachments={true}
          prefillData={{
            doctor_id: selectedAppointment.doctorId,
            doctor_name: selectedAppointment.doctorName,
            procedimiento_realizado: agentSessionPrefill?.procedimiento_realizado,
            plan_proxima_cita: agentSessionPrefill?.plan_proxima_cita,
            fecha_proxima_cita: agentSessionPrefill?.fecha_proxima_cita,
          }}
          prefillTreatments={agentSessionTreatments.length > 0 ? agentSessionTreatments : prefillTreatments}
          existingSession={linkedSession ?? undefined}
          hideNextAppointmentDate
          lockDoctor
        />
      )}
    </div>
  );
}
