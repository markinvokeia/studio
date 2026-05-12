'use client';

import * as React from 'react';

import { PatientDetailSheet } from '@/components/appointments/PatientDetailSheet';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { DoctorAgentChat } from '@/components/dashboard/doctor-agent-chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataCard } from '@/components/ui/data-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { usePermissions } from '@/hooks/usePermissions';
import { Appointment, DoctorAgentAction, PatientSession, QuoteItem, TreatmentDetail } from '@/lib/types';
import { canManageDoctorWorkspaceSessions } from '@/lib/permissions';
import { formatDate, formatDateTime, formatDisplayDate } from '@/lib/utils';
import { api } from '@/services/api';
import { getQuoteItems } from '@/services/quotes';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  FileText,
  Heart,
  Link2,
  RefreshCw,
  Sparkles,
  Stethoscope,
  User,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type AppointmentStatus = 'completed' | 'confirmed' | 'pending' | 'cancelled' | 'scheduled';

type PatientAlertTag = {
  label: string;
  type: 'allergy' | 'condition';
};

interface DoctorWorkspaceProps {
  locale: string;
}

interface DoctorPatientTimelineProps {
  linkedAppointmentId?: string;
  sessions: PatientSession[];
  isLoading: boolean;
}

const AUTO_REFRESH_MS = 60_000;
const KNOWN_APPOINTMENTS_STORAGE_PREFIX = 'doctor-workspace:known-appointments';

const STATUS_VARIANTS: Record<AppointmentStatus, 'success' | 'default' | 'info' | 'destructive'> = {
  completed: 'success',
  confirmed: 'default',
  pending: 'info',
  cancelled: 'destructive',
  scheduled: 'info',
};

function getTimeRangeLabel(appointment: Appointment): string {
  const startTime = appointment.time || '00:00';
  const endTime = appointment.end?.dateTime
    ? format(parseISO(appointment.end.dateTime.replace(/Z$/, '')), 'HH:mm')
    : undefined;

  return endTime ? `${startTime} - ${endTime}` : startTime;
}

function getKnownAppointmentsStorageKey(doctorId: string, dateKey: string): string {
  return `${KNOWN_APPOINTMENTS_STORAGE_PREFIX}:${doctorId}:${dateKey}`;
}

function readKnownAppointmentIds(storageKey: string): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue.map((value) => String(value)) : [];
  } catch (error) {
    console.error('Failed to read known doctor appointments:', error);
    return [];
  }
}

function writeKnownAppointmentIds(storageKey: string, appointmentIds: string[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(appointmentIds));
  } catch (error) {
    console.error('Failed to store known doctor appointments:', error);
  }
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

function DoctorPatientTimeline({ linkedAppointmentId, sessions, isLoading }: DoctorPatientTimelineProps) {
  const t = useTranslations('DoctorWorkspace');
  const tTimeline = useTranslations('ClinicHistoryPage.timeline');
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (sessions.length === 0) {
      setOpenItems([]);
      return;
    }

    const latestSessionId = String(sessions[0].sesion_id);
    setOpenItems((current) => {
      if (current.includes(latestSessionId)) return current;
      return [latestSessionId];
    });
  }, [sessions]);

  const toggleItem = React.useCallback((sessionId: string) => {
    setOpenItems((current) => (
      current.includes(sessionId)
        ? current.filter((item) => item !== sessionId)
        : [...current, sessionId]
    ));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-[1.5rem]" />
        <Skeleton className="h-24 w-full rounded-[1.5rem]" />
        <Skeleton className="h-24 w-full rounded-[1.5rem]" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm font-medium text-foreground">{tTimeline('noSessions')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('focus.timelineEmptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      <div className="absolute bottom-0 left-[11px] top-0 w-0.5 bg-gradient-to-b from-primary/50 via-muted to-muted" />
      {sessions.map((session, index) => {
        const sessionId = String(session.sesion_id);
        const isOpen = openItems.includes(sessionId);
        const hasTreatments = Array.isArray(session.tratamientos) && session.tratamientos.length > 0;
        const hasAttachments = Array.isArray(session.archivos_adjuntos) && session.archivos_adjuntos.length > 0;
        const isLinkedToCurrentAppointment = Boolean(linkedAppointmentId && String(session.appointment_id ?? '') === linkedAppointmentId);
        const SessionIcon = session.tipo_sesion === 'odontograma' ? Heart : Stethoscope;

        return (
          <Collapsible key={session.sesion_id} open={isOpen} onOpenChange={() => toggleItem(sessionId)}>
            <div className="relative flex items-start pl-8 sm:pl-10">
              <div className="absolute left-0 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-card shadow-md">
                <SessionIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <Card className="min-w-0 flex-1 border-muted/60 transition-shadow duration-200 hover:shadow-md">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="break-words text-sm font-semibold leading-tight text-foreground sm:text-base">
                          {session.procedimiento_realizado || tTimeline('noTitle')}
                        </CardTitle>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {index === 0 && (
                            <Badge variant="secondary" className="rounded-full bg-sky-100 text-sky-800 hover:bg-sky-100">
                              {t('focus.latestSessionBadge')}
                            </Badge>
                          )}
                          {isLinkedToCurrentAppointment && (
                            <Badge variant="outline" className="rounded-full">
                              {t('focus.currentAppointmentBadge')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                          <CalendarIcon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                          {formatDisplayDate(session.fecha_sesion)}
                        </p>
                        {(session.nombre_doctor || session.doctor_name) && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                            <User className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                            <span className="truncate">{session.nombre_doctor || session.doctor_name}</span>
                          </p>
                        )}
                        {session.quote_id && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                            <Link2 className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                            {tTimeline('quote')}: {session.quote_doc_no || session.quote_id}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-full justify-start px-4 py-1 text-xs text-muted-foreground hover:text-foreground">
                    {isOpen ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
                    {isOpen ? tTimeline('hideDetails') : tTimeline('showDetails')}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="space-y-3 px-4 pb-4 pt-1 sm:px-6">
                  {session.diagnostico && (
                    <div className="rounded-r-md border-l-2 border-red-400/50 bg-red-50/40 py-1 pl-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                        {tTimeline('diagnosis')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">{session.diagnostico}</p>
                    </div>
                  )}
                  {session.notas_clinicas && (
                    <div className="rounded-r-md border-l-2 border-cyan-400/50 bg-cyan-50/40 py-1 pl-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-cyan-600">
                        {tTimeline('notes')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">{session.notas_clinicas}</p>
                    </div>
                  )}
                  {session.plan_proxima_cita && (
                    <div className="rounded-r-md border-l-2 border-blue-400/50 bg-blue-50/40 py-1 pl-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                        {tTimeline('nextPlan')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">{session.plan_proxima_cita}</p>
                    </div>
                  )}
                  {hasTreatments && (
                    <div className="rounded-r-md border-l-2 border-green-500/50 bg-green-50/40 py-1 pl-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600">
                        {tTimeline('treatments')}
                      </p>
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        {session.tratamientos.map((treatment, treatmentIndex) => (
                          <div
                            key={`${session.sesion_id}-treatment-${treatmentIndex}`}
                            className="flex min-w-0 items-baseline gap-2"
                          >
                            {treatment.numero_diente ? (
                              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-medium text-primary">
                                {tTimeline('tooth')} {treatment.numero_diente}
                              </span>
                            ) : null}
                            <p className="break-words text-sm leading-relaxed text-muted-foreground">
                              {treatment.descripcion}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasAttachments && (
                    <div className="rounded-r-md border-l-2 border-amber-500/50 bg-amber-50/40 py-1 pl-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                        {tTimeline('attachments')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {session.archivos_adjuntos.map((attachment, attachmentIndex) => (
                          <div
                            key={`${session.sesion_id}-attachment-${attachmentIndex}`}
                            className="flex items-center gap-1 rounded border border-muted bg-background px-2 py-1 text-xs"
                          >
                            <FileText className="h-3 w-3 text-amber-500" />
                            {attachment.file_name || attachment.ruta || 'Adjunto'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

export function DoctorWorkspace({ locale }: DoctorWorkspaceProps) {
  const t = useTranslations('DoctorWorkspace');
  const tStatus = useTranslations('AppointmentStatus');
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { createSession, updateSession } = useClinicHistory();
  const canManageSessions = React.useMemo(() => canManageDoctorWorkspaceSessions(permissions), [permissions]);
  const isMobile = useViewportNarrow(1024);

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [linkedSession, setLinkedSession] = React.useState<PatientSession | null>(null);
  const [patientSessions, setPatientSessions] = React.useState<PatientSession[]>([]);
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
  const [patientAlertTags, setPatientAlertTags] = React.useState<PatientAlertTag[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = React.useState(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [patientSheetOpen, setPatientSheetOpen] = React.useState(false);
  const [clinicSessionOpen, setClinicSessionOpen] = React.useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = React.useState(false);
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
  const [newAppointmentsAlertOpen, setNewAppointmentsAlertOpen] = React.useState(false);
  const [newAppointmentsAlertItems, setNewAppointmentsAlertItems] = React.useState<Appointment[]>([]);
  const contextRequestRef = React.useRef(0);

  const selectedAppointment = React.useMemo(
    () => appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? appointments[0] ?? null,
    [appointments, selectedAppointmentId],
  );

  React.useEffect(() => {
    if (!isMobile) {
      setMobileDetailsOpen(false);
    }
  }, [isMobile]);

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
      const dateKey = formatDate(new Date());
      const storageKey = getKnownAppointmentsStorageKey(String(user.id), dateKey);
      const previousAppointmentIds = readKnownAppointmentIds(storageKey);
      const previousAppointmentIdsSet = new Set(previousAppointmentIds);
      const newAppointments = previousAppointmentIds.length > 0
        ? data.filter((appointment) => !previousAppointmentIdsSet.has(appointment.id))
        : [];

      writeKnownAppointmentIds(storageKey, data.map((appointment) => appointment.id));

      React.startTransition(() => {
        setAppointments(data);
        setSelectedAppointmentId((current) => {
          if (current && data.some((appointment) => appointment.id === current)) return current;
          return data[0]?.id ?? null;
        });
        setLastUpdatedAt(new Date());
      });

      if (newAppointments.length > 0) {
        setNewAppointmentsAlertItems(newAppointments);
        setNewAppointmentsAlertOpen(true);
      }
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
      setIsLoadingTimeline(false);
      return;
    }

    setIsLoadingTimeline(true);
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
        setIsLoadingTimeline(false);
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

  const loadPatientAlertTags = React.useCallback(async (appointment: Appointment | null, requestId?: number) => {
    if (!appointment?.patientId) {
      setPatientAlertTags([]);
      return;
    }

    try {
      const [allergiesData, personalHistoryData] = await Promise.all([
        api.get(API_ROUTES.CLINIC_HISTORY.ALLERGIES, { user_id: appointment.patientId }),
        api.get(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY, { user_id: appointment.patientId }),
      ]);

      if (requestId != null && requestId !== contextRequestRef.current) return;

      const allergiesRaw = Array.isArray(allergiesData)
        ? allergiesData
        : (allergiesData.antecedentes_alergias || allergiesData.data || []);
      const personalHistoryRaw = Array.isArray(personalHistoryData)
        ? personalHistoryData
        : (personalHistoryData.antecedentes_personales || personalHistoryData.data || []);

      const nextTags: PatientAlertTag[] = [
        ...allergiesRaw.map((item: any) => ({
          label: String(item.alergeno || 'N/A'),
          type: 'allergy' as const,
        })),
        ...personalHistoryRaw.map((item: any) => ({
          label: String(item.padecimiento_nombre || item.nombre || 'N/A'),
          type: 'condition' as const,
        })),
      ];

      setPatientAlertTags(nextTags);
    } catch (error) {
      console.error('Failed to load patient alert tags for doctor workspace:', error);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setPatientAlertTags([]);
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
      setPatientAlertTags([]);
      return;
    }

    contextRequestRef.current += 1;
    const requestId = contextRequestRef.current;

    loadLinkedSession(selectedAppointment, requestId);
    loadQuoteItems(selectedAppointment, requestId);
    loadPatientAlertTags(selectedAppointment, requestId);
  }, [loadLinkedSession, loadPatientAlertTags, loadQuoteItems, selectedAppointment]);

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
  const visibleAlertTags = patientAlertTags.slice(0, 4);
  const hiddenAlertCount = Math.max(patientAlertTags.length - visibleAlertTags.length, 0);
  const firstNewAppointmentAlertItem = newAppointmentsAlertItems[0] ?? null;

  const clearAgentSessionDraft = React.useCallback(() => {
    setAgentSessionPrefill(null);
    setAgentSessionTreatments([]);
  }, []);

  const selectAppointment = React.useCallback((appointmentId: string, openMobileDetails = false) => {
    setSelectedAppointmentId(appointmentId);
    if (isMobile && openMobileDetails) {
      setMobileDetailsOpen(true);
    }
  }, [isMobile]);

  const handleOpenNewAppointment = React.useCallback(() => {
    if (!firstNewAppointmentAlertItem) return;

    selectAppointment(firstNewAppointmentAlertItem.id, true);
    setNewAppointmentsAlertOpen(false);
  }, [firstNewAppointmentAlertItem, selectAppointment]);

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
      selectAppointment(payload.appointment_id, true);
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
        if (isMobile) {
          setMobileDetailsOpen(true);
          return;
        }
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
  }, [isMobile, selectAppointment]);

  const renderDetailPanel = selectedAppointment ? (
    <Card className="border-border/70 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
      <CardContent className="space-y-4 p-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden">
        {isMobile && (
          <Button variant="ghost" className="h-9 w-fit px-2" onClick={() => setMobileDetailsOpen(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('focus.backToAgenda')}
          </Button>
        )}

        <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/8">
                {patientAlertTags.length > 0 ? (
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                ) : (
                  <UserRound className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-tight text-foreground">
                  {selectedAppointment.patientName || t('agenda.unknownPatient')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {visibleAlertTags.length > 0 ? (
                    <>
                      {visibleAlertTags.map((item, index) => (
                        item.type === 'allergy' ? (
                          <Badge
                            key={`${item.label}-${index}`}
                            variant="destructive"
                            className="gap-1 text-xs font-normal"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {item.label}
                          </Badge>
                        ) : (
                          <Badge
                            key={`${item.label}-${index}`}
                            variant="secondary"
                            className="gap-1 bg-amber-100 text-xs font-normal text-amber-800 hover:bg-amber-100"
                          >
                            <Heart className="h-3 w-3" />
                            {item.label}
                          </Badge>
                        )
                      ))}
                      {hiddenAlertCount > 0 && (
                        <span className="text-xs text-primary">
                          {t('focus.moreAlertTags', { count: hiddenAlertCount })}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('focus.noClinicalSignals')}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button onClick={() => setClinicSessionOpen(true)} disabled={!canManageSessions}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                {nextActionLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className={isMobile ? 'space-y-4' : 'grid min-h-0 flex-1 gap-4 xl:h-full xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]'}>
          <div className="rounded-[2rem] border border-border/70 bg-white/88 p-4 shadow-sm xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t('focus.timelineKicker')}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{t('focus.timelineTitle')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('focus.timelineDescription')}</p>
              </div>
            </div>

            <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
              <DoctorPatientTimeline
                linkedAppointmentId={selectedAppointment.id}
                sessions={patientSessions}
                isLoading={isLoadingTimeline}
              />
            </div>
          </div>

          {!isMobile && (
            <DoctorAgentChat
              appointmentId={selectedAppointment.id}
              locale={locale}
              patientName={selectedAppointment.patientName}
              userId={user?.id ? String(user.id) : undefined}
              onAction={handleDoctorAgentAction}
              presentation="embedded"
            />
          )}
        </div>
      </CardContent>
    </Card>
  ) : (
    <Card className="border-border/70">
      <CardContent className="p-6">
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          {t('focus.empty')}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden p-4 pr-2">
      <div className="flex h-full w-full min-h-0 flex-col gap-4">
        {isMobile && mobileDetailsOpen ? (
          renderDetailPanel
        ) : (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(320px,30%)_minmax(0,70%)]">
            <Card className="border-border/70 xl:sticky xl:top-4 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('todayLabel', { date: formatDisplayDate(new Date()) })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lastUpdatedAt ? t('lastUpdated', { time: formatDateTime(lastUpdatedAt) }) : t('lastUpdatedPending')}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="min-h-0 space-y-3 overflow-auto xl:flex-1">
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
                        badge={(
                          <Badge variant={STATUS_VARIANTS[normalizedStatus] || 'default'} className="capitalize">
                            {tStatus(normalizedStatus)}
                          </Badge>
                        )}
                        isSelected={selectedAppointment?.id === appointment.id}
                        showArrow
                        onClick={() => selectAppointment(appointment.id, true)}
                        className="border-border/70 rounded-2xl bg-white/85"
                      />
                    );
                  })
                )}
              </CardContent>
            </Card>

            {!isMobile && renderDetailPanel}
          </div>
        )}
      </div>

      {isMobile && (
        <DoctorAgentChat
          appointmentId={selectedAppointment?.id}
          locale={locale}
          patientName={selectedAppointment?.patientName}
          userId={user?.id ? String(user.id) : undefined}
          onAction={handleDoctorAgentAction}
          presentation="floating"
        />
      )}

      <Dialog open={newAppointmentsAlertOpen} onOpenChange={setNewAppointmentsAlertOpen}>
        <DialogContent maxWidth="md" className="overflow-hidden border-primary/20 p-0">
          <DialogHeader className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.95))] text-white">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">
                  {newAppointmentsAlertItems.length === 1
                    ? t('appointmentAlerts.singleTitle')
                    : t('appointmentAlerts.multipleTitle', { count: newAppointmentsAlertItems.length })}
                </DialogTitle>
                <DialogDescription className="mt-1 text-white/75">
                  {newAppointmentsAlertItems.length === 1
                    ? t('appointmentAlerts.modalSingleDescription')
                    : t('appointmentAlerts.modalMultipleDescription', { count: newAppointmentsAlertItems.length })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 bg-background px-6 py-5">
            {newAppointmentsAlertItems.map((appointment) => {
              const serviceLabel = appointment.services?.length
                ? appointment.services.map((service) => service.name).join(', ')
                : appointment.service_name || appointment.summary || t('appointmentAlerts.unknownService');

              return (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => {
                    selectAppointment(appointment.id, true);
                    setNewAppointmentsAlertOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-4 rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] px-4 py-4 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/70"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">
                      {appointment.patientName || t('agenda.unknownPatient')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {serviceLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-sky-700">{getTimeRangeLabel(appointment)}</p>
                    <Badge variant={STATUS_VARIANTS[(appointment.status.toLowerCase() as AppointmentStatus)] || 'default'} className="mt-2 capitalize">
                      {tStatus(appointment.status.toLowerCase())}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter className="bg-background">
            <Button variant="outline" onClick={() => setNewAppointmentsAlertOpen(false)}>
              {t('appointmentAlerts.dismiss')}
            </Button>
            <Button onClick={handleOpenNewAppointment} disabled={!firstNewAppointmentAlertItem}>
              {t('appointmentAlerts.openFirst')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
