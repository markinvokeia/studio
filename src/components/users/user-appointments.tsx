'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { AppointmentPanel } from '@/components/appointments/AppointmentPanel';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { CancellationNoteDialog } from '@/components/appointments/CancellationNoteDialog';
import { AppointmentStatusMenu } from '@/components/appointments/AppointmentStatusMenu';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { API_ROUTES } from '@/constants/routes';
import { normalizeAppointmentStatus, normalizeCancellationReason, canReschedule } from '@/constants/appointment-status';
import { useAppointmentStatus } from '@/hooks/use-appointment-status';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { useToast } from '@/hooks/use-toast';
import { Appointment, AppointmentStatus, CancellationReason, Invoice, Order, PatientSession, QuoteItem, User, Service, Calendar as CalendarType } from '@/lib/types';
import { api } from '@/services/api';
import { getQuoteItems } from '@/services/quotes';
import { updateAppointmentStatusRequest } from '@/services/appointments';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { FileText } from 'lucide-react';
import { addMonths, format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataCard } from '@/components/ui/data-card';

const isWhite = (color: string | null | undefined) => {
  if (!color) return true;
  const n = color.toLowerCase().replace(/\s/g, '');
  return n === '#ffffff' || n === '#fff' || n === 'white' || n === 'rgb(255,255,255)' || n === 'rgba(255,255,255,1)' || n === 'hsl(0,0%,100%)';
};

function getAppointmentDateTime(appointment: Appointment): Date | null {
  const startDateTime = appointment.start?.dateTime;
  if (typeof startDateTime === 'string') {
    const parsedStart = parseISO(startDateTime.replace(/Z$/, ''));
    if (!Number.isNaN(parsedStart.getTime())) return parsedStart;
  }

  const fallbackDateTime = `${appointment.date}T${appointment.time || '00:00'}:00`;
  const parsedFallback = parseISO(fallbackDateTime);
  return Number.isNaN(parsedFallback.getTime()) ? null : parsedFallback;
}

function sortAppointmentsForPatientTimeline(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');

  return [...appointments].sort((left, right) => {
    const leftDateTime = getAppointmentDateTime(left);
    const rightDateTime = getAppointmentDateTime(right);

    if (!leftDateTime || !rightDateTime) return 0;

    const leftDateKey = format(leftDateTime, 'yyyy-MM-dd');
    const rightDateKey = format(rightDateTime, 'yyyy-MM-dd');
    const leftIsToday = leftDateKey === todayKey;
    const rightIsToday = rightDateKey === todayKey;

    if (leftIsToday && !rightIsToday) return -1;
    if (!leftIsToday && rightIsToday) return 1;

    if (leftIsToday && rightIsToday) {
      const leftDistance = Math.abs(leftDateTime.getTime() - now.getTime());
      const rightDistance = Math.abs(rightDateTime.getTime() - now.getTime());
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      return leftDateTime.getTime() - rightDateTime.getTime();
    }

    const leftIsFuture = leftDateTime.getTime() >= now.getTime();
    const rightIsFuture = rightDateTime.getTime() >= now.getTime();

    if (leftIsFuture && !rightIsFuture) return -1;
    if (!leftIsFuture && rightIsFuture) return 1;

    return leftIsFuture
      ? leftDateTime.getTime() - rightDateTime.getTime()
      : rightDateTime.getTime() - leftDateTime.getTime();
  });
}

const getColumns = (
  t: (key: string) => string,
  onStatusChange: (appointment: Appointment, newStatus: AppointmentStatus, extra?: { cancellation_reason?: CancellationReason; cancellation_note?: string }) => void,
  onRequestCustomCancellation: (appointment: Appointment) => void,
): ColumnDef<Appointment>[] => [
  {
    accessorKey: 'summary',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('service')} />,
  },
  {
    accessorKey: 'doctorName',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('doctor')} />,
  },
  {
    accessorKey: 'quote_doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('quoteDocNo')} />,
    cell: ({ row }) => {
      const quoteDocNo = row.original.quote_doc_no;
      return quoteDocNo ? (
        <Badge variant="secondary" className="font-mono gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {quoteDocNo}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      );
    },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('date')} />,
  },
  {
    accessorKey: 'time',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('time')} />,
  },
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
            onRequestCustomCancellation={() => onRequestCustomCancellation(appointment)}
          />
        </div>
      );
    },
  },
];

const CALENDAR_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(150, 70%, 45%)',
  'hsl(340, 80%, 60%)',
  'hsl(45, 90%, 55%)',
  'hsl(270, 70%, 65%)',
  'hsl(180, 60%, 40%)',
  'hsl(0, 75%, 55%)',
];

async function getCalendars(): Promise<CalendarType[]> {
  try {
    const data = await api.get(API_ROUTES.CALENDARS);
    const calendarsData = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);
    return calendarsData.map((apiCalendar: any, index: number) => ({
      id: String(apiCalendar.id),
      name: apiCalendar.name,
      google_calendar_id: apiCalendar.google_calendar_id,
      is_active: apiCalendar.is_active,
      color: apiCalendar.color || CALENDAR_COLORS[index % CALENDAR_COLORS.length],
    }));
  } catch (error) {
    console.error("Failed to fetch calendars:", error);
    return [];
  }
}

async function getAppointmentsForUser(
  user: User | null,
  calendarSourceIds: string[],
  calendars: CalendarType[] = []
): Promise<Appointment[]> {
  if (!user || !user.id) return [];

  const now = new Date();
  const startDate = addMonths(now, -6);
  const endDate = addMonths(now, 6);
  const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

  try {
    const query: Record<string, string> = {
      startingDateAndTime: formatDateForAPI(startDate),
      endingDateAndTime: formatDateForAPI(endDate),
      user_id: String(user.id),
    };

    if (calendarSourceIds.length > 0) {
      query.calendar_source_ids = calendarSourceIds.join(',');
    }

    const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, query);
    let appointmentsData: any[] = [];

    if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
      appointmentsData = data.map(item => item.json);
    } else if (Array.isArray(data)) {
      appointmentsData = data;
    }

    if (!Array.isArray(appointmentsData)) {
      console.error("Fetched data could not be resolved to an array:", data);
      return [];
    }

    const appointments = appointmentsData.map((apiAppt: any) => {
      const startNode = apiAppt.start_time || apiAppt.start;
      const appointmentDateTimeStr = typeof startNode === 'string' ? startNode : (startNode?.dateTime);
      if (!appointmentDateTimeStr) return null;

      const appointmentDateTime = parseISO(appointmentDateTimeStr.replace(/Z$/, ''));
      if (isNaN(appointmentDateTime.getTime())) return null;

      const doctorId = apiAppt.doctor_id || apiAppt.doctorId || apiAppt.doctorid;
      const doctorName = apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || 'Doctor';

      const endNode = apiAppt.end_time || apiAppt.end;
      const calendarSourceId = apiAppt.calendar_source_id != null ? String(apiAppt.calendar_source_id) : '';
      const calendar = calendars.find(c => String(c.id) === calendarSourceId);

      const appointment = {
        id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id),
        patientId: String(user.id),
        patientName: apiAppt.patient_name || apiAppt.patientName || apiAppt.patientname || user.name,
        patientEmail: apiAppt.patient_email || apiAppt.patientEmail || apiAppt.patientemail,
        patientPhone: apiAppt.patient_phone || apiAppt.patientPhone || apiAppt.patientphone,
        doctorId: String(doctorId || ''),
        doctorName: doctorName,
        doctorEmail: apiAppt.doctor_email || apiAppt.doctorEmail || apiAppt.doctoremail || '',
        summary: apiAppt.summary || 'Cita',
        description: apiAppt.description || '',
        notes: apiAppt.notes || '',
        calendar_source_id: calendarSourceId,
        calendar_name: apiAppt.organizer?.displayName || calendar?.name || apiAppt.calendar_name,
        date: format(appointmentDateTime, 'yyyy-MM-dd'),
        time: format(appointmentDateTime, 'HH:mm'),
        status: normalizeAppointmentStatus(apiAppt.status),
        cancellation_reason: normalizeCancellationReason(
          apiAppt.cancellation_reason || apiAppt.cancellationReason || apiAppt.cancellationreason,
        ),
        cancellation_note: apiAppt.cancellation_note || apiAppt.cancellationNote || apiAppt.cancellationnote || null,
        created_at: apiAppt.created_at || apiAppt.createdat,
        google_calendar_id: apiAppt.google_calendar_id || undefined,
        googleEventId: apiAppt.google_event_id || apiAppt.googleEventId || apiAppt.googleeventid || apiAppt.id,
        quote_id: apiAppt.quote_id || apiAppt.quoteId || apiAppt.quoteid || undefined,
        quote_doc_no: apiAppt.quote_doc_no || apiAppt.quoteDocNo || apiAppt.quotedocno || apiAppt.doc_no || apiAppt.docNo || apiAppt.docno || undefined,
        invoice_id: apiAppt.invoice_id != null ? String(apiAppt.invoice_id) : null,
        color: (() => {
          const c = (apiAppt.color && ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].includes(String(apiAppt.color)))
            ? {
              "1": "#a4bdfc", "2": "#7ae7bf", "3": "#dbadff", "4": "#ff887c", "5": "#fbd75b",
              "6": "#ffb878", "7": "#46d6db", "8": "#e1e1e1", "9": "#5484ed", "10": "#51b749", "11": "#dc2127"
            }[String(apiAppt.color)]
            : apiAppt.color;
          return isWhite(c) ? undefined : c;
        })(),
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        services: Array.isArray(apiAppt.services) ? apiAppt.services.map((s: any) => ({
          id: String(s.id),
          name: s.name || '',
          price: Number(s.price || 0),
          category: '',
          duration_minutes: 30,
          is_active: true
        } as Service)) : []
      } as Appointment;
      return appointment;
    }).filter((apt): apt is Appointment => apt !== null);

    return sortAppointmentsForPatientTimeline(appointments);
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return [];
  }
}

interface UserAppointmentsProps {
  user: User;
  refreshTrigger?: number;
}

export function UserAppointments({ user, refreshTrigger }: UserAppointmentsProps) {
  const t = useTranslations('AppointmentsColumns');
  const tAppointmentsPage = useTranslations('AppointmentsPage');
  const { toast } = useToast();
  const isViewportNarrow = useViewportNarrow();
  const { createSession, updateSession } = useClinicHistory();

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Linked session
  const [linkedSession, setLinkedSession] = React.useState<PatientSession | null>(null);
  const [isLoadingLinkedSession, setIsLoadingLinkedSession] = React.useState(false);

  // Quote / invoice info
  const [quoteOrder, setQuoteOrder] = React.useState<Order | null>(null);
  const [quoteInvoices, setQuoteInvoices] = React.useState<Invoice[]>([]);
  const [isLoadingQuoteInfo, setIsLoadingQuoteInfo] = React.useState(false);

  // Clinic session dialog
  const [isClinicSessionOpen, setIsClinicSessionOpen] = React.useState(false);
  const [clinicSessionAppointment, setClinicSessionAppointment] = React.useState<Appointment | null>(null);
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);

  // Edit / reschedule dialog
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [isReschedulingMode, setIsReschedulingMode] = React.useState(false);

  // Cancellation
  const [pendingCancellation, setPendingCancellation] = React.useState<Appointment | null>(null);

  const { updateStatus } = useAppointmentStatus({
    onSuccess: (appt, newStatus, extra) => {
      const patch = {
        status: newStatus,
        cancellation_reason: extra?.cancellation_reason ?? null,
        cancellation_note: extra?.cancellation_note ?? null,
      };
      setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, ...patch } : a)));
      setSelectedAppointment((prev) => prev && prev.id === appt.id ? { ...prev, ...patch } : prev);
    },
  });

  const handleStatusChange = React.useCallback(
    (appointment: Appointment, newStatus: AppointmentStatus, extra?: { cancellation_reason?: CancellationReason; cancellation_note?: string }) => {
      updateStatus({ appointment, newStatus, ...extra });
    },
    [updateStatus],
  );

  const handleRequestCustomCancellation = React.useCallback((appointment: Appointment) => {
    setPendingCancellation(appointment);
  }, []);

  const handleConfirmCustomCancellation = React.useCallback((note: string) => {
    if (!pendingCancellation) return;
    updateStatus({ appointment: pendingCancellation, newStatus: 'cancelled', cancellation_reason: 'other', cancellation_note: note });
    setPendingCancellation(null);
  }, [pendingCancellation, updateStatus]);

  const columns = React.useMemo(
    () => getColumns(t, handleStatusChange, handleRequestCustomCancellation),
    [t, handleStatusChange, handleRequestCustomCancellation],
  );

  const loadCalendars = React.useCallback(async () => {
    const fetchedCalendars = await getCalendars();
    setCalendars(fetchedCalendars);
  }, []);

  const loadAppointments = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const calendarSourceIds = calendars.map(c => String(c.id));
    const fetchedAppointments = await getAppointmentsForUser(user, calendarSourceIds, calendars);
    setAppointments(fetchedAppointments);
    setIsLoading(false);
  }, [user, calendars]);

  const loadLinkedSession = React.useCallback(async (appointment: Appointment) => {
    const patientId = appointment.patientId;
    if (!patientId) { setLinkedSession(null); return; }
    setIsLoadingLinkedSession(true);
    try {
      const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: patientId });
      const sessions: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);

      // Match by appointment_id first; fall back to quote_id for sessions created
      // before appointment_id was persisted.
      const match =
        sessions.find((s: any) => s?.appointment_id?.toString() === appointment.id) ??
        (appointment.quote_id
          ? sessions.find((s: any) => s?.quote_id != null && String(s.quote_id) === String(appointment.quote_id))
          : undefined);

      if (match) {
        const s = match;
        setLinkedSession({
          sesion_id: Number(s.sesion_id),
          tipo_sesion: s.tipo_sesion,
          fecha_sesion: s.fecha_sesion || '',
          diagnostico: s.diagnostico || null,
          procedimiento_realizado: s.procedimiento_realizado || '',
          notas_clinicas: s.notas_clinicas || '',
          plan_proxima_cita: s.plan_proxima_cita,
          fecha_proxima_cita: s.fecha_proxima_cita,
          doctor_id: s.doctor_id || null,
          doctor_name: s.doctor_name || s.nombre_doctor,
          nombre_doctor: s.nombre_doctor || s.doctor_name,
          estado_odontograma: s.estado_odontograma,
          tratamientos: s.tratamientos || [],
          archivos_adjuntos: s.archivos_adjuntos || [],
          quote_id: s.quote_id?.toString(),
          quote_doc_no: s.quote_doc_no,
          appointment_id: s.appointment_id?.toString(),
        });
      } else {
        setLinkedSession(null);
      }
    } catch {
      setLinkedSession(null);
    } finally {
      setIsLoadingLinkedSession(false);
    }
  }, []);

  const loadQuoteInfo = React.useCallback(async (quoteId: string) => {
    setIsLoadingQuoteInfo(true);
    try {
      const [ordersData, invoicesData] = await Promise.all([
        api.get(API_ROUTES.SALES.QUOTES_ORDERS, { quote_id: quoteId }).catch(() => []),
        api.get(API_ROUTES.SALES.QUOTES_INVOICES, { quote_id: quoteId }).catch(() => []),
      ]);
      const orders: any[] = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);
      const invoices: any[] = Array.isArray(invoicesData) ? invoicesData : (invoicesData.invoices || invoicesData.data || []);
      const firstOrder = orders.length > 0 ? orders[0] : null;
      setQuoteOrder(firstOrder ? {
        id: String(firstOrder.id || ''),
        doc_no: firstOrder.doc_no,
        user_id: firstOrder.user_id,
        quote_id: firstOrder.quote_id,
        quote_doc_no: firstOrder.quote_doc_no,
        status: firstOrder.status || 'pending',
        is_invoiced: firstOrder.is_invoiced ?? false,
        currency: firstOrder.currency,
        createdAt: firstOrder.created_at || firstOrder.createdAt || '',
        updatedAt: firstOrder.updated_at || firstOrder.updatedAt || '',
      } : null);
      setQuoteInvoices(invoices.map((inv: any) => ({
        id: String(inv.id || ''),
        invoice_ref: inv.invoice_ref || '',
        doc_no: inv.doc_no || inv.invoice_doc_no,
        order_id: inv.order_id || '',
        order_doc_no: inv.order_doc_no,
        invoice_doc_no: inv.invoice_doc_no || inv.doc_no,
        quote_id: inv.quote_id || quoteId,
        quote_doc_no: inv.quote_doc_no,
        user_name: inv.user_name || '',
        user_id: inv.user_id || '',
        total: parseFloat(inv.total) || 0,
        paid_amount: parseFloat(inv.paid_amount) || 0,
        status: inv.status || 'draft',
        payment_status: inv.payment_state || inv.payment_status || 'unpaid',
        type: inv.type || 'invoice',
        currency: inv.currency,
        is_historical: inv.is_historical || false,
        createdAt: inv.created_at || inv.createdAt || '',
        updatedAt: inv.updated_at || inv.updatedAt || '',
      })));
    } catch {
      setQuoteOrder(null);
      setQuoteInvoices([]);
    } finally {
      setIsLoadingQuoteInfo(false);
    }
  }, []);

  const handleOpenClinicSession = React.useCallback(async (appointment: Appointment) => {
    setClinicSessionAppointment(appointment);
    setLinkedSession(null);

    const tasks: Promise<any>[] = [loadLinkedSession(appointment)];
    if (appointment.quote_id) {
      tasks.push(
        getQuoteItems(appointment.quote_id)
          .then((items) => setQuoteItems(items))
          .catch(() => setQuoteItems([])),
      );
    } else {
      setQuoteItems([]);
    }

    await Promise.all(tasks);
    setIsClinicSessionOpen(true);
  }, [loadLinkedSession]);

  const handleSaveClinicSession = React.useCallback(async (data: ClinicSessionFormData) => {
    if (!clinicSessionAppointment?.patientId) return;
    try {
      const sessionData = {
        ...data,
        appointment_id: clinicSessionAppointment.id,
        quote_id: clinicSessionAppointment.quote_id,
      };

      if (data.sesion_id) {
        await updateSession(data.sesion_id, clinicSessionAppointment.patientId, sessionData, data.archivos_adjuntos, data.deletedAttachmentIds);
        toast({ title: tAppointmentsPage('toasts.sessionUpdated') });
      } else {
        await createSession(clinicSessionAppointment.patientId, sessionData, data.archivos_adjuntos);
        if (clinicSessionAppointment.status !== 'completed') {
          await updateAppointmentStatusRequest({ appointment: clinicSessionAppointment, newStatus: 'completed' });
          const patch = { status: 'completed' as AppointmentStatus };
          setAppointments((prev) => prev.map((a) => a.id === clinicSessionAppointment.id ? { ...a, ...patch } : a));
          setSelectedAppointment((prev) => prev && prev.id === clinicSessionAppointment.id ? { ...prev, ...patch } : prev);
        }
        toast({ title: tAppointmentsPage('toasts.sessionCreated'), description: tAppointmentsPage('toasts.sessionCreatedDesc') });
      }

      setIsClinicSessionOpen(false);
      setClinicSessionAppointment(null);
      loadLinkedSession(clinicSessionAppointment);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tAppointmentsPage('toasts.errorCreatingSession'),
        description: error instanceof Error ? error.message : tAppointmentsPage('toasts.errorCreatingSessionDesc'),
      });
      throw error;
    }
  }, [clinicSessionAppointment, createSession, updateSession, loadLinkedSession, toast, tAppointmentsPage]);

  const handleEdit = React.useCallback((appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsReschedulingMode(false);
    setIsCreateOpen(true);
  }, []);

  const handleReschedule = React.useCallback((appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsReschedulingMode(true);
    setIsCreateOpen(true);
  }, []);

  const prefillTreatments = React.useMemo(() => {
    return quoteItems.map(item => {
      const toothNum = item.tooth_number != null ? Number(item.tooth_number) : null;
      return {
        numero_diente: toothNum != null && !isNaN(toothNum) && toothNum > 0 ? toothNum : null,
        descripcion: item.service_name,
      };
    });
  }, [quoteItems]);

  React.useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  React.useEffect(() => {
    if (calendars.length > 0) loadAppointments();
  }, [calendars, loadAppointments]);

  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) loadAppointments();
  }, [refreshTrigger, loadAppointments]);

  const handleRowSelectionChange = React.useCallback((selectedRows: Appointment[]) => {
    const appointment = selectedRows[0] ?? null;
    setSelectedAppointment(appointment);
    if (appointment) {
      setIsSheetOpen(true);
      setLinkedSession(null);
      setQuoteOrder(null);
      setQuoteInvoices([]);
      setIsLoadingQuoteInfo(false);

      const tasks: Promise<void>[] = [loadLinkedSession(appointment)];
      if (appointment.quote_id) tasks.push(loadQuoteInfo(appointment.quote_id));
      Promise.all(tasks);
    } else {
      setIsSheetOpen(false);
      setLinkedSession(null);
      setQuoteOrder(null);
      setQuoteInvoices([]);
    }
  }, [loadLinkedSession, loadQuoteInfo]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <Card className="flex-1 flex flex-col min-h-0 shadow-none border-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <DataTable
            columns={columns}
            data={appointments}
            filterColumnId="summary"
            filterPlaceholder={tAppointmentsPage('filterByService')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            isNarrow={isViewportNarrow}
            renderCard={(appointment: Appointment, _isSelected: boolean) => (
              <DataCard isSelected={_isSelected}
                title={appointment.summary || '-'}
                subtitle={`${appointment.date || ''} ${appointment.time || ''}`.trim()}
                badge={
                  <AppointmentStatusMenu
                    appointment={appointment}
                    onChange={(s, extra) => handleStatusChange(appointment, s, extra)}
                    onRequestCustomCancellation={() => handleRequestCustomCancellation(appointment)}
                  />
                }
                fields={[
                  { label: t('doctor'), value: appointment.doctorName || '-' },
                  { label: t('quoteDocNo'), value: appointment.quote_doc_no || '-' },
                ]}
              />
            )}
            columnTranslations={{
              service_name: t('service'),
              doctorName: t('doctor'),
              date: t('date'),
              time: t('time'),
              status: t('status'),
            }}
          />
        </CardContent>
      </Card>

      <AppointmentPanel
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setRowSelection({});
            setSelectedAppointment(null);
            setLinkedSession(null);
            setQuoteOrder(null);
            setQuoteInvoices([]);
          }
        }}
        appointment={selectedAppointment}
        linkedSession={linkedSession}
        isLoadingLinkedSession={isLoadingLinkedSession}
        quoteOrder={quoteOrder}
        quoteInvoices={quoteInvoices}
        isLoadingQuoteInfo={isLoadingQuoteInfo}
        onEdit={handleEdit}
        onReschedule={handleReschedule}
        onOpenClinicSession={handleOpenClinicSession}
        onStatusChange={handleStatusChange}
        onRequestCustomCancellation={handleRequestCustomCancellation}
        onBillingSuccess={loadAppointments}
      />

      {clinicSessionAppointment && (
        <ClinicSessionDialog
          open={isClinicSessionOpen}
          onOpenChange={(open) => {
            setIsClinicSessionOpen(open);
            if (!open) setClinicSessionAppointment(null);
          }}
          onSave={handleSaveClinicSession}
          userId={clinicSessionAppointment.patientId}
          patientName={clinicSessionAppointment.patientName}
          quoteId={clinicSessionAppointment.quote_id}
          appointmentId={clinicSessionAppointment.id}
          defaultDate={clinicSessionAppointment.date ? new Date(clinicSessionAppointment.date) : undefined}
          serviceName={clinicSessionAppointment.summary || clinicSessionAppointment.service_name}
          showTreatments={true}
          showAttachments={true}
          prefillData={{
            doctor_id: clinicSessionAppointment.doctorId,
            doctor_name: clinicSessionAppointment.doctorName,
          }}
          prefillTreatments={prefillTreatments}
          existingSession={linkedSession ?? undefined}
        />
      )}

      <AppointmentFormDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) { setEditingAppointment(null); setIsReschedulingMode(false); }
        }}
        editingAppointment={editingAppointment}
        mode={isReschedulingMode ? 'reschedule' : (editingAppointment ? 'edit' : 'create')}
        onSaveSuccess={() => { setIsCreateOpen(false); loadAppointments(); }}
      />

      <CancellationNoteDialog
        open={!!pendingCancellation}
        onOpenChange={(open) => { if (!open) setPendingCancellation(null); }}
        onConfirm={handleConfirmCustomCancellation}
      />
    </>
  );
}
