'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { Appointment, PatientSession, User, Service, Calendar as CalendarType } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { FileText, Stethoscope, Calendar as CalendarIcon, Clock, UserCircle, RefreshCw, Info } from 'lucide-react';
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

const getColumns = (t: (key: string) => string, tStatus: (key: string) => string): ColumnDef<Appointment>[] => [
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
      const status = row.getValue('status') as string;
      const variant = {
        completed: 'success',
        confirmed: 'default',
        pending: 'info',
        cancelled: 'destructive',
        scheduled: 'info',
      }[status.toLowerCase()] ?? ('default' as any);

      return (
        <Badge variant={variant} className="capitalize">
          {tStatus(status.toLowerCase())}
        </Badge>
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
      id: apiCalendar.id || apiCalendar.google_calendar_id,
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
  calendarGoogleIds: string[]
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

    if (calendarGoogleIds.length > 0) {
      query.calendar_ids = calendarGoogleIds.join(',');
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

      const appointment = {
        id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id),
        patientId: String(user.id),
        patientName: user.name,
        doctorId: String(doctorId || ''),
        doctorName: doctorName,
        doctorEmail: apiAppt.doctor_email || apiAppt.doctorEmail || apiAppt.doctoremail || '',
        summary: apiAppt.summary || 'Cita',
        description: apiAppt.description || '',
        date: format(appointmentDateTime, 'yyyy-MM-dd'),
        time: format(appointmentDateTime, 'HH:mm'),
        status: apiAppt.status || 'confirmed',
        created_at: apiAppt.created_at || apiAppt.createdat,
        google_calendar_id: apiAppt.google_calendar_id || '',
        googleEventId: apiAppt.google_event_id || apiAppt.googleEventId || apiAppt.googleeventid || apiAppt.id,
        quote_id: apiAppt.quote_id || apiAppt.quoteId || apiAppt.quoteid || undefined,
        quote_doc_no: apiAppt.quote_doc_no || apiAppt.quoteDocNo || apiAppt.quotedocno || apiAppt.doc_no || apiAppt.docNo || apiAppt.docno || undefined,
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

    return appointments;
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return [];
  }
}

// Linked session columns
function getLinkedSessionColumns(t: (key: string) => string): ColumnDef<PatientSession>[] {
  return [
    {
      accessorKey: 'fecha_sesion',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} />,
      cell: ({ row }) => {
        const val: string = row.original.fecha_sesion;
        if (!val) return <span className="text-muted-foreground">—</span>;
        const d = parseISO(val);
        return <span>{format(d, 'dd/MM/yyyy')}</span>;
      },
    },
    {
      accessorKey: 'procedimiento_realizado',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.procedure')} />,
      cell: ({ row }) => (
        <span className="truncate max-w-[300px] block" title={row.original.procedimiento_realizado}>
          {row.original.procedimiento_realizado || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'doctor_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.doctor')} />,
      cell: ({ row }) => {
        const val = row.original.doctor_name || row.original.nombre_doctor;
        return <span>{val || '—'}</span>;
      },
    },
  ];
}

interface UserAppointmentsProps {
  user: User;
  refreshTrigger?: number;
}

export function UserAppointments({ user, refreshTrigger }: UserAppointmentsProps) {
  const t = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tAppointmentsPage = useTranslations('AppointmentsPage');
  const tUserAppointments = useTranslations('UserAppointments');
  const { hasPermission } = usePermissions();
  const isViewportNarrow = useViewportNarrow();
  
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Linked sessions state
  const [linkedSessions, setLinkedSessions] = React.useState<PatientSession[]>([]);
  const [isLoadingLinkedSessions, setIsLoadingLinkedSessions] = React.useState(false);

  const columns = React.useMemo(() => getColumns(t, tStatus), [t, tStatus]);

  const loadCalendars = React.useCallback(async () => {
    const fetchedCalendars = await getCalendars();
    setCalendars(fetchedCalendars);
  }, []);

  const loadAppointments = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const googleCalendarIds = calendars
      .map(c => c.google_calendar_id)
      .filter((id): id is string => !!id);

    const fetchedAppointments = await getAppointmentsForUser(user, googleCalendarIds);
    setAppointments(fetchedAppointments);
    setIsLoading(false);
  }, [user, calendars]);

  // Load linked sessions for an appointment: fetch all patient sessions, then filter by quote_id
  const loadLinkedSessions = React.useCallback(async (userId: string, quoteId: string) => {
    if (!userId || !quoteId) {
      setLinkedSessions([]);
      return;
    }
    setIsLoadingLinkedSessions(true);
    try {
      const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: userId });
      const sessionsData: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);

      // Filter by quote_id on the client side
      const filtered = sessionsData.filter((s: any) => s.quote_id != null && String(s.quote_id) === String(quoteId));

      setLinkedSessions(filtered.map((s: any): PatientSession => ({
        sesion_id: Number(s.sesion_id || s.id),
        tipo_sesion: s.tipo_sesion,
        fecha_sesion: s.fecha_sesion || '',
        diagnostico: s.diagnostico || null,
        procedimiento_realizado: s.procedimiento_realizado || '',
        notas_clinicas: s.notas_clinicas || '',
        plan_proxima_cita: s.plan_proxima_cita || undefined,
        fecha_proxima_cita: s.fecha_proxima_cita || undefined,
        doctor_id: s.doctor_id || null,
        doctor_name: s.doctor_name || s.nombre_doctor || undefined,
        nombre_doctor: s.nombre_doctor || s.doctor_name || undefined,
        estado_odontograma: s.estado_odontograma,
        tratamientos: s.tratamientos || [],
        archivos_adjuntos: s.archivos_adjuntos || [],
        quote_id: s.quote_id?.toString(),
        quote_doc_no: s.quote_doc_no,
        appointment_id: s.appointment_id?.toString(),
      })));
    } catch (error) {
      console.error("Failed to fetch linked sessions:", error);
      setLinkedSessions([]);
    } finally {
      setIsLoadingLinkedSessions(false);
    }
  }, []);

  React.useEffect(() => {
    const init = async () => {
      await loadCalendars();
    };
    init();
  }, [loadCalendars]);

  React.useEffect(() => {
    if (calendars.length > 0) {
      loadAppointments();
    }
  }, [calendars, loadAppointments]);

  // Efecto para refrescar cuando cambia refreshTrigger
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadAppointments();
    }
  }, [refreshTrigger, loadAppointments]);

  // Handle row selection
  const handleRowSelectionChange = React.useCallback((selectedRows: Appointment[]) => {
    const appointment = selectedRows[0] ?? null;
    setSelectedAppointment(appointment);
    if (appointment) {
      setIsSheetOpen(true);
      if (appointment.quote_id) {
        loadLinkedSessions(String(user.id), appointment.quote_id);
      } else {
        setLinkedSessions([]);
      }
    } else {
      setIsSheetOpen(false);
      setLinkedSessions([]);
    }
  }, [loadLinkedSessions]);

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
            renderCard={(appointment: Appointment, _isSelected: boolean) => {
              const statusLower = appointment.status?.toLowerCase() || '';
              const statusVariant = ({
                completed: 'success',
                confirmed: 'default',
                pending: 'info',
                cancelled: 'destructive',
                scheduled: 'info',
              }[statusLower] ?? 'default') as any;
              return (
                <DataCard isSelected={_isSelected}
                  title={appointment.summary || '-'}
                  subtitle={`${appointment.date || ''} ${appointment.time || ''}`.trim()}
                  badge={
                    statusLower ? (
                      <Badge variant={statusVariant} className="capitalize text-[10px]">
                        {tStatus(statusLower)}
                      </Badge>
                    ) : undefined
                  }
                  fields={[
                    { label: t('doctor'), value: appointment.doctorName || '-' },
                    { label: t('quoteDocNo'), value: appointment.quote_doc_no || '-' },
                  ]}
                />
              );
            }}
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

      {/* Appointment Detail Sheet */}
      <ResizableSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setRowSelection({});
            setSelectedAppointment(null);
            setLinkedSessions([]);
          }
        }}
        defaultWidth={700}
        minWidth={500}
        maxWidth={1200}
        storageKey="user-appointments-sheet-width"
      >
        {selectedAppointment && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-none border-b border-border bg-card">
              <div className="px-6 py-5 pr-12">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <SheetTitle className="text-lg font-semibold text-card-foreground truncate">
                      {selectedAppointment.summary}
                    </SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                      {tUserAppointments('appointmentDetails')}
                    </SheetDescription>
                  </div>
                  <Badge
                    variant={
                      selectedAppointment.status === 'completed' ? 'success' :
                      selectedAppointment.status === 'cancelled' ? 'destructive' :
                      selectedAppointment.status === 'pending' ? 'info' : 'default'
                    }
                    className="capitalize shrink-0"
                  >
                    {tStatus(selectedAppointment.status.toLowerCase())}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Appointment Info Grid */}
            <div className="flex-none px-6 py-4 border-b border-border">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground leading-none">{tUserAppointments('date')}</p>
                    <p className="text-sm font-medium mt-0.5">{selectedAppointment.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground leading-none">{tUserAppointments('time')}</p>
                    <p className="text-sm font-medium mt-0.5">{selectedAppointment.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground leading-none">{tUserAppointments('doctor')}</p>
                    <p className="text-sm font-medium mt-0.5">{selectedAppointment.doctorName || '—'}</p>
                  </div>
                </div>
                {selectedAppointment.quote_doc_no && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">{tUserAppointments('quote')}</p>
                      <Badge variant="secondary" className="font-mono mt-0.5 text-xs">
                        {selectedAppointment.quote_doc_no}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {selectedAppointment.description && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tUserAppointments('notes')}</p>
                    <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
                      {selectedAppointment.description}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Linked Sessions */}
            <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  {tUserAppointments('linkedSessions')}
                  {linkedSessions.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 font-normal">
                      {linkedSessions.length}
                    </Badge>
                  )}
                </h4>
                {selectedAppointment.quote_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => selectedAppointment.quote_id && loadLinkedSessions(String(user.id), selectedAppointment.quote_id)}
                    disabled={isLoadingLinkedSessions}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLinkedSessions ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {!selectedAppointment.quote_id ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                      <Info className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tUserAppointments('noLinkedQuote')}
                    </p>
                  </div>
                ) : linkedSessions.length === 0 && !isLoadingLinkedSessions ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                      <Stethoscope className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tUserAppointments('noLinkedSessions')}
                    </p>
                  </div>
                ) : (
                  <DataTable
                    columns={getLinkedSessionColumns(tUserAppointments)}
                    data={linkedSessions}
                    isRefreshing={isLoadingLinkedSessions}
                    onRefresh={() => selectedAppointment.quote_id && loadLinkedSessions(String(user.id), selectedAppointment.quote_id)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </ResizableSheet>
    </>
  );
}
