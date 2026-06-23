
'use client';

import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { CalendarCreateTypeDialog } from '@/components/appointments/CalendarCreateTypeDialog';
import Calendar, { type CalendarGroupBy, type CalendarGroupingColumn, type CalendarView } from '@/components/calendar/Calendar';
import { CalendarSettingsPopover } from '@/components/calendar/calendar-settings-popover';
import { CalendarSettingsForm } from '@/components/calendar/calendar-settings-form';
import { getCalendarSettings } from '@/components/calendar/calendar-settings-utils';
import { DEFAULT_EVENT_LABEL_FORMAT, HOUR_SLOT_HEIGHT } from '@/components/calendar/calendar-constants';
import { ReminderFormDialog, type ReminderFormValues } from '@/components/appointments/ReminderFormDialog';
import { ReminderPanel } from '@/components/appointments/ReminderPanel';
import { useCalendarBreakpoint } from '@/hooks/use-calendar-breakpoint';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { Appointment, AppointmentBulkFilterParams, AppointmentDatePreset, AppointmentStatus, Calendar as CalendarType, CalendarReminder, CalendarSettings, Invoice, Order, PatientSession, Quote, QuoteItem, Sede, Service, SessionPreloadedService, User as UserType } from '@/lib/types';
import { cn, toLocalISOString } from '@/lib/utils';
import api from '@/services/api';
import { getQuoteItems } from '@/services/quotes';
import { updateAppointmentStatusRequest } from '@/services/appointments';
import { getSalesServices, getUsersServicesBatch, fetchServicesByIds } from '@/services/services';
import { ColumnDef } from '@tanstack/react-table';
import { addMinutes, endOfMonth, endOfWeek, format, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { BellRing, Calendar as CalendarIcon, CalendarPlus, CalendarSync, Check, ChevronDown, ClipboardCheck, Edit, FileText, Layers, Loader2, PlusCircle, RefreshCw, Stethoscope, Trash2, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { AppointmentPanel } from '@/components/appointments/AppointmentPanel';
import { BulkReassignDoctorDialog } from '@/components/appointments/BulkReassignDoctorDialog';
import { AppointmentStatusContextItems } from '@/components/appointments/AppointmentStatusMenu';
import { useAppointmentStatus } from '@/hooks/use-appointment-status';
import { canReschedule, normalizeAppointmentStatus, normalizeCancellationReason } from '@/constants/appointment-status';
import { CancellationNoteDialog } from '@/components/appointments/CancellationNoteDialog';
import { getAppointmentColumns } from './columns';
import { useNotifications } from '@/context/notifications-context';
import { useAuth } from '@/context/AuthContext';
import { normalizeReminder } from '@/lib/reminders';
import { QuoteFormDialog } from '@/components/sales/quotes/QuoteFormDialog';
import { InvoiceFormDialog } from '@/components/tables/invoices-table';


// ── Notification action deep-link ────────────────────────────────────────────
// Reads ?act=quote|schedule|invoice&patientId=...&patientName=...&date=...&sessionRef=...
// Triggers the corresponding dialog when the page loads from a notification card
// If sessionRef is present, reads pre-loaded AI services from sessionStorage.


interface NotifActCallbacks {
  onQuote: (patientId: string, patientName: string, items?: SessionPreloadedService[], notifId?: string) => void | Promise<void>;
  onSchedule: (
    patientId: string,
    patientName: string,
    date?: string,
    doctorId?: string,
    doctorName?: string,
    items?: SessionPreloadedService[],
    quoteId?: string,
    calendarId?: string,
    notifId?: string,
  ) => void;
  onInvoice: (patientId: string, patientName: string, items?: SessionPreloadedService[], notifId?: string) => void | Promise<void>;
}

function NotificationActDeepLink({ onQuote, onSchedule, onInvoice }: NotifActCallbacks) {
  const searchParams = useSearchParams();
  // Keep callbacks in a ref so they don't need to be listed as deps.
  const cbRef = React.useRef({ onQuote, onSchedule, onInvoice });
  React.useEffect(() => { cbRef.current = { onQuote, onSchedule, onInvoice }; });

  React.useEffect(() => {
    const act = searchParams.get('act');
    const patientId = searchParams.get('patientId');
    if (!act || !patientId) return;

    const patientName = searchParams.get('patientName') ?? '';
    const sessionRef = searchParams.get('sessionRef');
    const { onQuote, onSchedule, onInvoice } = cbRef.current;

    // Limpiar la URL inmediatamente para que un segundo click en la misma
    // notificación vuelva a disparar el efecto (searchParams cambia → vacío → params).
    // Usar replaceState evita una re-navegación/re-render de Next.js.
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch { /* no-op */ }

    // Leer servicios pre-cargados por IA desde sessionStorage
    let preloadedItems: SessionPreloadedService[] | undefined;
    if (sessionRef) {
      try {
        const raw = sessionStorage.getItem(`notif-services:${sessionRef}`);
        if (raw) {
          preloadedItems = JSON.parse(raw) as SessionPreloadedService[];
          sessionStorage.removeItem(`notif-services:${sessionRef}`);
        }
      } catch {
        // sessionStorage no disponible — continuar sin pre-carga
      }
    }

    const notifId = searchParams.get('notifId') ?? undefined;

    if (act === 'quote') {
      onQuote(patientId, patientName, preloadedItems, notifId);
    } else if (act === 'schedule') {
      onSchedule(
        patientId,
        patientName,
        searchParams.get('date') ?? undefined,
        searchParams.get('doctorId') ?? undefined,
        searchParams.get('doctorName') ?? undefined,
        preloadedItems,
        searchParams.get('quoteId') ?? undefined,
        searchParams.get('calendarId') ?? undefined,
        notifId,
      );
    } else if (act === 'invoice') {
      onInvoice(patientId, patientName, preloadedItems, notifId);
    }
  }, [searchParams]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

const CALENDAR_COLORS = [
    'hsl(210, 80%, 55%)',
    'hsl(150, 70%, 45%)',
    'hsl(340, 80%, 60%)',
    'hsl(45, 90%, 55%)',
    'hsl(270, 70%, 65%)',
    'hsl(180, 60%, 40%)',
    'hsl(0, 75%, 55%)',
];

const GOOGLE_CALENDAR_COLORS = [
    { id: "1", hex: "#a4bdfc" }, // Lavender
    { id: "2", hex: "#7ae7bf" }, // Sage
    { id: "3", hex: "#dbadff" }, // Grape
    { id: "4", hex: "#ff887c" }, // Flamingo
    { id: "5", hex: "#fbd75b" }, // Banana
    { id: "6", hex: "#ffb878" }, // Tangerine
    { id: "7", hex: "#46d6db" }, // Peacock
    { id: "8", hex: "#e1e1e1" }, // Graphite
    { id: "9", hex: "#5484ed" }, // Blueberry
    { id: "10", hex: "#51b749" },// Basil
    { id: "11", hex: "#dc2127" },// Tomato
];

const colorMap = new Map(GOOGLE_CALENDAR_COLORS.map(c => [c.id, c.hex]));

// Builds the label shown on each appointment by concatenating its fields
// according to the configured format (see EVENT_LABEL_FORMATS).
function buildEventLabel(appt: Appointment, start: Date, fmt: string): string {
    const time = format(start, 'HH:mm');
    const patient = (appt.patientName || '').trim();
    const treatment = (appt.summary || appt.service_name || '').trim();
    const notes = (appt.notes || '').trim();
    if (fmt === 'patient_treatment_time') {
        return [patient, treatment, time].filter(Boolean).join(' ');
    }
    // default: time_patient_notes -> "HH:mm Patient (Notes)"
    const base = [time, patient].filter(Boolean).join(' ');
    return notes ? `${base} (${notes})` : base;
}

const SETTINGS_VIEW_MAP: Record<string, CalendarView> = {
    day: 'day',
    '2_days': '2-day',
    '3_days': '3-day',
    week: 'week',
    month: 'month',
    agenda: 'schedule',
};

const isWhite = (color: string | null | undefined) => {
    if (!color) return true;
    const n = color.toLowerCase().replace(/\s/g, '');
    return n === '#ffffff' || n === '#fff' || n === 'white' || n === 'rgb(255,255,255)' || n === 'rgba(255,255,255,1)' || n === 'hsl(0,0%,100%)';
};


async function getAppointments(
    calendarSourceIds: string[],
    startDate: Date,
    endDate: Date,
    calendars: CalendarType[],
    services: Service[],
    doctors: UserType[],
    t: (key: string) => string
): Promise<Appointment[]> {
    if (!isValid(startDate) || !isValid(endDate)) {
        console.error("Invalid start or end date provided to getAppointments");
        return [];
    }
    const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

    try {
        const query: any = {
            startingDateAndTime: formatDateForAPI(startDate),
            endingDateAndTime: formatDateForAPI(endDate),
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

        return appointmentsData.map((apiAppt: any) => {
            // Handle both structure where start is an object or a direct string
            const startNode = apiAppt.start_time || apiAppt.start;
            const appointmentDateTimeStr = typeof startNode === 'string' ? startNode : (startNode?.dateTime);

            if (!appointmentDateTimeStr) {
                console.warn("Appointment missing start time:", apiAppt);
                return null;
            }

            const appointmentDateTime = parseISO(appointmentDateTimeStr.replace(/Z$/, ''));
            if (isNaN(appointmentDateTime.getTime())) {
                console.error("Invalid appointment date:", appointmentDateTimeStr, apiAppt);
                return null;
            }

            // Normalize fields prioritizing snake_case from backend
            const calendarSourceId = apiAppt.calendar_source_id != null ? String(apiAppt.calendar_source_id) : '';
            const calendar = calendars.find(c => String(c.id) === calendarSourceId);

            const doctorId = apiAppt.doctor_id || apiAppt.doctorId || apiAppt.doctorid || apiAppt.assignee_id;
            const doctorEmail = apiAppt.doctor_email || apiAppt.doctorEmail || apiAppt.doctoremail || apiAppt.assignee_email;
            const doctor = doctors.find(d => String(d.id) === String(doctorId) || (doctorEmail && d.email === doctorEmail));

            // Try to find a service match from summary or from the services array if it exists
            const apiApptServices = Array.isArray(apiAppt.services) ? apiAppt.services : [];
            const service = services.find(s =>
                s.name === apiAppt.summary ||
                String(s.id) === String(apiAppt.service_id) ||
                apiApptServices.some((as: any) => String(as.id) === String(s.id))
            );

            const appointmentColorId = String(apiAppt.color_id || apiAppt.colorId || apiAppt.colorid || '');
            let finalColor = apiAppt.color;

            // If the color field contains a Google Color ID, map it to hex
            if (finalColor && colorMap.has(String(finalColor))) {
                finalColor = colorMap.get(String(finalColor));
            }

            // Fallback algorithm: Appointment Color Tag > Service Color > Doctor Color > Calendar Color
            // We skip white colors (255, 255, 255) as they are considered "no color"
            if (!finalColor || (typeof finalColor === 'string' && !finalColor.startsWith('#') && !finalColor.startsWith('hsl'))) {
                const tagColor = colorMap.get(appointmentColorId);
                const sColor = service?.color;
                const dColor = doctor?.color;
                const cColor = calendar?.color;

                finalColor = (!isWhite(tagColor) ? tagColor : null) ||
                    (!isWhite(sColor) ? sColor : null) ||
                    (!isWhite(dColor) ? dColor : null) ||
                    (!isWhite(cColor) ? cColor : null);
            }

            const patientId = apiAppt.patient_id || apiAppt.patientId || apiAppt.patientid || apiAppt.user_id || apiAppt.userid;
            const patientName = apiAppt.patient_name || apiAppt.patientName || apiAppt.patientname || apiAppt.user_name || apiAppt.username || (apiAppt.attendees && apiAppt.attendees.length > 0 ? apiAppt.attendees.map((a: any) => a.email).join(', ') : 'N/A');
            const doctorName = apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || apiAppt.assignee_name || doctor?.name || 'Doctor';

            const endNode = apiAppt.end_time || apiAppt.end;
            const rawEndDateTimeStr = typeof endNode === 'string' ? endNode : (endNode?.dateTime);
            let endDateTimeStr = rawEndDateTimeStr;
            const parsedEnd = endDateTimeStr ? parseISO(endDateTimeStr.replace(/Z$/, '')) : null;
            if (!parsedEnd || !isValid(parsedEnd) || parsedEnd.getTime() <= appointmentDateTime.getTime()) {
                endDateTimeStr = format(addMinutes(appointmentDateTime, 15), "yyyy-MM-dd'T'HH:mm:ss");
            }

            const appointment: Appointment = {
                id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id || ''),
                patientId: String(patientId || ''),
                patientName: patientName,
                patientEmail: apiAppt.patient_email || apiAppt.patientEmail || apiAppt.patientemail || apiAppt.user_email,
                patientPhone: apiAppt.patient_phone || apiAppt.patientPhone || apiAppt.patientphone || apiAppt.user_phone || apiAppt.phone_number,
                doctorId: String(doctorId || ''),
                doctorName: doctorName,
                doctorEmail: doctorEmail || doctor?.email || '',
                summary: apiAppt.summary || t('createDialog.none'),
                service_name: apiAppt.summary || t('createDialog.none'),
                description: apiAppt.description || '',
                notes: apiAppt.notes || '',
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'HH:mm'),
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
                color: finalColor,
                colorId: appointmentColorId,
                start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
                end: { dateTime: endDateTimeStr },
                services: Array.isArray(apiAppt.services) ? apiAppt.services.map((s: any) => ({
                    id: String(s.id),
                    name: s.name || '',
                    price: Number(s.price || 0),
                    category: '',
                    duration_minutes: 30,
                    is_active: true
                } as Service)) : [],
                quote_id: apiAppt.quote_id || apiAppt.quoteId || apiAppt.quoteid || undefined,
                quote_doc_no: apiAppt.quote_doc_no || apiAppt.quoteDocNo || apiAppt.quotedocno || apiAppt.doc_no || apiAppt.docNo || apiAppt.docno || undefined,
                invoice_id: apiAppt.invoice_id != null ? String(apiAppt.invoice_id) : null,
            };

            return appointment;
        }).filter((apt): apt is Appointment => apt !== null);
    } catch (error) {
        console.error("Failed to fetch appointments:", error);
        return [];
    }
}

async function getReminders(startDate: Date, endDate: Date, userId?: string | null): Promise<CalendarReminder[]> {
    if (!isValid(startDate) || !isValid(endDate)) return [];
    if (!userId) return [];
    const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

    try {
        const response = await api.get(API_ROUTES.REMINDERS, {
            from: formatDateForAPI(startDate),
            to: formatDateForAPI(endDate),
            created_by: userId,
        });
        const remindersData = Array.isArray(response)
            ? response
            : (response?.reminders || response?.data || response?.result || []);

        return remindersData
            .map(normalizeReminder)
            .filter((reminder: CalendarReminder | null): reminder is CalendarReminder => reminder !== null);
    } catch (error) {
        console.error("Failed to fetch reminders:", error);
        return [];
    }
}

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
            sede_id: apiCalendar.sede_id ? String(apiCalendar.sede_id) : undefined,
            sede_name: apiCalendar.sede_name || undefined,
        }));
    } catch (error) {
        console.error("Failed to fetch calendars:", error);
        return [];
    }
}

async function getSedes(): Promise<Sede[]> {
    try {
        const data = await api.get(API_ROUTES.SEDES, { page: '1', limit: '200' });
        const raw = Array.isArray(data) ? data : (data.sedes || data.data || []);
        return raw.map((s: any) => ({
            id: String(s.id),
            clinic_id: String(s.clinic_id),
            name: s.name || '',
            is_active: s.is_active !== undefined ? s.is_active : true,
        }));
    } catch {
        return [];
    }
}

async function getServices(): Promise<Service[]> {
    try {
        const result = await getSalesServices({ limit: 100 });
        return result.items.map((s: any) => ({ ...s, id: String(s.id) }));
    } catch (error) {
        console.error("Failed to fetch services:", error);
        return [];
    }
}

async function getDoctors(): Promise<UserType[]> {
    try {
        const data = await api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' });

        let doctorsData = [];
        if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0];
            if (firstElement.json && typeof firstElement.json === 'object') {
                doctorsData = firstElement.json.data || [];
            } else if (firstElement.data) {
                doctorsData = firstElement.data;
            }
        } else if (typeof data === 'object' && data !== null && data.data) {
            doctorsData = data.data;
        }

        return doctorsData.map((d: any) => ({ ...d, id: String(d.id) }));
    } catch (error) {
        console.error("Failed to fetch doctors:", error);
        return [];
    }
}


export default function AppointmentsPage() {
    const breakpoint = useCalendarBreakpoint();
    const isMobile = breakpoint === 'mobile';

    const t = useTranslations('AppointmentsPage');
    const tColumns = useTranslations('AppointmentsColumns');
    const tStatus = useTranslations('AppointmentStatus');
    const tStatusMenu = useTranslations('AppointmentStatusMenu');
    const tReschedule = useTranslations('AppointmentReschedule');
    const tGeneral = useTranslations('General');
    const tUserRoles = useTranslations('UserRoles');
    const tToasts = useTranslations('AppointmentsPage.toasts');
    const tOrderStatus = useTranslations('OrderStatus');
    const tReminders = useTranslations('Reminders');

    const { refreshNotifications: refreshReminders, markSessionAction } = useNotifications();
    const { user } = useAuth();

    const { toast } = useToast();

    const [appointments, setAppointments] = React.useState<Appointment[]>([]);
    const [reminders, setReminders] = React.useState<CalendarReminder[]>([]);
    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [sedes, setSedes] = React.useState<Sede[]>([]);
    const [services, setServices] = React.useState<Service[]>([]);
    const [doctors, setDoctors] = React.useState<UserType[]>([]);
    const [doctorServiceMap, setDoctorServiceMap] = React.useState<Map<string, Service[]>>(new Map());
    const [selectedCalendarIds, setSelectedCalendarIds] = React.useState<string[]>([]);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [fetchRange, setFetchRange] = React.useState<{ start: Date; end: Date } | null>(null);
    const [checkCalendarAvailability, setCheckCalendarAvailability] = React.useState(false);
    const [checkDoctorAvailability, setCheckDoctorAvailability] = React.useState(false);

    const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
    const [isReschedulingMode, setIsReschedulingMode] = React.useState(false);
    const [deletingAppointment, setDeletingAppointment] = React.useState<Appointment | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);

    const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
    const [isDetailViewOpen, setIsDetailViewOpen] = React.useState(false);
    const [selectedReminder, setSelectedReminder] = React.useState<CalendarReminder | null>(null);
    const [isReminderPanelOpen, setIsReminderPanelOpen] = React.useState(false);
    const [isReminderFormOpen, setIsReminderFormOpen] = React.useState(false);
    const [editingReminder, setEditingReminder] = React.useState<CalendarReminder | null>(null);
    const [reminderInitialDate, setReminderInitialDate] = React.useState<Date | null>(null);
    const [isCreateTypeOpen, setIsCreateTypeOpen] = React.useState(false);
    const [pendingSlotDate, setPendingSlotDate] = React.useState<Date | null>(null);

    const [selectedDoctorIds, setSelectedDoctorIds] = React.useState<string[]>([]);
    const [groupBy, setGroupBy] = React.useState<CalendarGroupBy>('none');
    const [currentView, setCurrentView] = React.useState<CalendarView>('month');

    // ── Bulk selection mode ──────────────────────────────────────────────────
    const [isBulkMode, setIsBulkMode] = React.useState(false);
    const [bulkSelectedIds, setBulkSelectedIds] = React.useState<Set<string>>(new Set());
    const [bulkDatePreset, setBulkDatePreset] = React.useState<AppointmentDatePreset>('today');
    const [bulkDoctorIds, setBulkDoctorIds] = React.useState<string[]>([]);
    const [bulkCalendarIds, setBulkCalendarIds] = React.useState<string[]>([]);
    const [bulkStatuses, setBulkStatuses] = React.useState<AppointmentStatus[]>([]);
    const [isBulkLoading, setIsBulkLoading] = React.useState(false);
    const [isReassignDialogOpen, setIsReassignDialogOpen] = React.useState(false);
    const [isReassignLoading, setIsReassignLoading] = React.useState(false);
    const prevViewRef = React.useRef<CalendarView>('month');
    const [hourSlotHeight, setHourSlotHeight] = React.useState<number>(HOUR_SLOT_HEIGHT);
    const [eventLabelFormat, setEventLabelFormat] = React.useState<string>(DEFAULT_EVENT_LABEL_FORMAT);
    const [defaultSede, setDefaultSede] = React.useState<string>('');

    const tBulk = useTranslations('AppointmentsPage.bulk');

    const getBulkDateRange = (preset: AppointmentDatePreset) => {
        const today = new Date();
        if (preset === 'today') return { date_from: format(today, 'yyyy-MM-dd'), date_to: format(today, 'yyyy-MM-dd') };
        if (preset === 'this_week') return { date_from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), date_to: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
        return { date_from: format(startOfMonth(today), 'yyyy-MM-dd'), date_to: format(endOfMonth(today), 'yyyy-MM-dd') };
    };

    const handleToggleBulkMode = React.useCallback(() => {
        setIsBulkMode((prev) => {
            if (!prev) {
                skipNextBulkFilterRef.current = true; // entering — skip auto-trigger
                prevViewRef.current = currentView;
                setCurrentView('schedule');
            } else {
                setCurrentView(prevViewRef.current);
            }
            return !prev;
        });
        setBulkSelectedIds(new Set());
        setBulkDoctorIds([]);
        setBulkCalendarIds([]);
        setBulkStatuses([]);
        setBulkDatePreset('today');
    }, [currentView]);

    const handleApplyBulkFilter = React.useCallback(async () => {
        setIsBulkLoading(true);
        try {
            const dateRange = getBulkDateRange(bulkDatePreset);
            const params: AppointmentBulkFilterParams = { ...dateRange };
            if (bulkDoctorIds.length > 0) params.doctor_ids = bulkDoctorIds;
            if (bulkCalendarIds.length > 0) params.calendar_source_ids = bulkCalendarIds;
            if (bulkStatuses.length > 0) params.statuses = bulkStatuses;
            const response = await api.post(API_ROUTES.APPOINTMENTS_FILTER_IDS, params);
            const ids: string[] = (response?.ids ?? []).map(String);
            setBulkSelectedIds(new Set(ids));
            toast({ title: tBulk('filterResult', { count: ids.length }) });
        } catch {
            toast({ variant: 'destructive', title: tBulk('filterError') });
        } finally {
            setIsBulkLoading(false);
        }
    }, [bulkDatePreset, bulkDoctorIds, bulkCalendarIds, bulkStatuses, tBulk]);

    const handleToggleAppointmentSelect = React.useCallback((id: string) => {
        setBulkSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const handleBulkReassign = React.useCallback(async (doctorId: string, doctorName: string, doctorEmail?: string) => {
        setIsReassignLoading(true);
        try {
            const response = await api.post(API_ROUTES.APPOINTMENTS_BULK_REASSIGN_DOCTOR, {
                appointment_ids: Array.from(bulkSelectedIds),
                doctor_id: doctorId,
                doctor_name: doctorName,
                doctor_email: doctorEmail,
            });
            const updated: number = response?.updated ?? 0;
            const failed: number = response?.failed ?? 0;
            if (failed > 0) {
                toast({ title: tBulk('reassignPartial', { updated, failed }) });
            } else {
                toast({ title: tBulk('reassignSuccess', { count: updated }) });
            }
            setIsReassignDialogOpen(false);
            setIsBulkMode(false);
            setCurrentView(prevViewRef.current);
            setBulkSelectedIds(new Set());
            setBulkDoctorIds([]);
            setBulkCalendarIds([]);
            setBulkStatuses([]);
            setBulkDatePreset('today');
            refreshCalendarDataRef.current();
        } catch {
            toast({ variant: 'destructive', title: tBulk('reassignError') });
        } finally {
            setIsReassignLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bulkSelectedIds, tBulk]);

    const BULK_SELECTABLE_STATUSES: AppointmentStatus[] = ['scheduled', 'confirmed', 'pending', 'arrived', 'no_show'];

    const handleSelectAllVisible = React.useCallback((checked: boolean) => {
        if (checked) {
            const ids = appointments
                .filter(a => !['completed', 'cancelled', 'in_progress'].includes(a.status))
                .map(a => a.id);
            setBulkSelectedIds(new Set(ids));
        } else {
            setBulkSelectedIds(new Set());
        }
    }, [appointments]);

    const handleSelectBulkDoctor = React.useCallback((id: string, checked: boolean) => {
        setBulkDoctorIds((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id));
    }, []);

    const handleSelectBulkCalendar = React.useCallback((id: string, checked: boolean) => {
        setBulkCalendarIds((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id));
    }, []);

    const handleToggleBulkStatus = React.useCallback((status: AppointmentStatus, checked: boolean) => {
        setBulkStatuses((prev) => checked ? [...prev, status] : prev.filter((s) => s !== status));
    }, []);

    // Auto-apply bulk filter when filter values change — but NOT on programmatic resets
    // (entering/exiting bulk mode or clearing selection).
    const isBulkModeRef = React.useRef(isBulkMode);
    React.useEffect(() => { isBulkModeRef.current = isBulkMode; }, [isBulkMode]);
    const skipNextBulkFilterRef = React.useRef(false);
    const bulkFilterMountRef = React.useRef(true);
    React.useEffect(() => {
        if (bulkFilterMountRef.current) { bulkFilterMountRef.current = false; return; }
        if (!isBulkModeRef.current) return;
        if (skipNextBulkFilterRef.current) { skipNextBulkFilterRef.current = false; return; }
        handleApplyBulkFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bulkDoctorIds, bulkCalendarIds, bulkDatePreset]);

    // Compact mode: collapse filter/action buttons to icons when the viewport is narrow.
    // Threshold 980px: sidebar (~70px) + toolbar full-label content (~900px) = ~970px needed.
    const bulkToolbarRef = React.useRef<HTMLDivElement>(null);
    const [isBulkToolbarCompact, setIsBulkToolbarCompact] = React.useState(false);
    React.useEffect(() => {
        const check = () => setIsBulkToolbarCompact(window.innerWidth < 980);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const handleSettingsChange = React.useCallback((settings: CalendarSettings) => {
        const mappedView = SETTINGS_VIEW_MAP[settings.default_view] || 'month';
        setCurrentView(mappedView);
        setGroupBy(settings.grouped_by as CalendarGroupBy);
        setCheckCalendarAvailability(settings.check_availability);
        setCheckDoctorAvailability(settings.filter_doctors_by_service);
        setHourSlotHeight(settings.hour_height ?? HOUR_SLOT_HEIGHT);
        setEventLabelFormat(settings.event_label_format ?? DEFAULT_EVENT_LABEL_FORMAT);
        setDefaultSede(settings.default_sede ?? '');
    }, []);

    const handleSettingsEditorChange = React.useCallback((settings: CalendarSettings) => {
        setCheckCalendarAvailability(settings.check_availability);
        setCheckDoctorAvailability(settings.filter_doctors_by_service);
        setHourSlotHeight(settings.hour_height ?? HOUR_SLOT_HEIGHT);
        setEventLabelFormat(settings.event_label_format ?? DEFAULT_EVENT_LABEL_FORMAT);
        setDefaultSede(settings.default_sede ?? '');
    }, []);

    // Tracks the last applied default sede so the effect below only re-scopes the
    // calendars when the sede actually changes (preserving manual selections).
    const prevSedeRef = React.useRef<string>('');
    React.useEffect(() => {
        if (calendars.length === 0) return;
        if (prevSedeRef.current === defaultSede) return;
        prevSedeRef.current = defaultSede;
        const ids = (defaultSede
            ? calendars.filter(c => String(c.sede_id) === String(defaultSede))
            : calendars
        ).map(c => c.id).filter(Boolean);
        setSelectedCalendarIds(ids);
    }, [defaultSede, calendars]);

    // Clinic Session Dialog state
    const [isClinicSessionOpen, setIsClinicSessionOpen] = React.useState(false);
    const [clinicSessionAppointment, setClinicSessionAppointment] = React.useState<Appointment | null>(null);
    const [linkedSession, setLinkedSession] = React.useState<PatientSession | null>(null);
    const [isLoadingLinkedSession, setIsLoadingLinkedSession] = React.useState(false);
    const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
    const [quoteOrder, setQuoteOrder] = React.useState<Order | null>(null);
    const [quoteInvoices, setQuoteInvoices] = React.useState<Invoice[]>([]);
    const [isLoadingQuoteInfo, setIsLoadingQuoteInfo] = React.useState(false);
    const { createSession, updateSession, isSubmittingSession } = useClinicHistory();
    const eventClickAbortRef = React.useRef<AbortController | null>(null);
    const refreshCalendarDataRef = React.useRef<() => void>(() => undefined);






    const handleOpenChange = (open: boolean) => {
        setCreateOpen(open);
        if (!open) {
            setEditingAppointment(null);
            setIsReschedulingMode(false);
            setSlotInitialData(null);
            setScheduleNextData(null);
            setPendingScheduleNotifId(undefined);
            setScheduleNextResolvedServices(undefined);
        }
    };

    const handleNewAppointmentClick = () => {
        setEditingAppointment(null);
        setIsReschedulingMode(false);
        setSlotInitialData(null);
        setCreateOpen(true);
    };

    const handleNewReminderClick = () => {
        setEditingReminder(null);
        setReminderInitialDate(new Date());
        setPendingSlotDate(null);
        setIsReminderFormOpen(true);
    };

    const [slotInitialData, setSlotInitialData] = React.useState<{
        date: string;
        time: string;
        summary?: string;
        doctor?: UserType | null;
        calendar?: CalendarType | null;
    } | null>(null);

    const [scheduleNextData, setScheduleNextData] = React.useState<{
        patientId: string;
        patientName: string;
        date?: string;
        time?: string;
        doctorId?: string;
        doctorName?: string;
        services?: SessionPreloadedService[];
        quoteId?: string;
        calendarId?: string;
    } | null>(null);

    const handleSlotClick = React.useCallback((date: Date, context?: { groupBy: 'doctor' | 'calendar' | 'sede'; value: string }) => {
        setEditingAppointment(null);
        const base: {
            date: string;
            time: string;
            doctor?: UserType | null;
            calendar?: CalendarType | null;
        } = {
            date: format(date, 'yyyy-MM-dd'),
            time: format(date, 'HH:mm'),
        };
        if (context?.groupBy === 'doctor') {
            const doctor = doctors.find(d => String(d.id) === String(context.value));
            if (doctor) base.doctor = doctor;
        } else if (context?.groupBy === 'calendar') {
            const calendar = calendars.find(c => String(c.id) === String(context.value));
            if (calendar) base.calendar = calendar;
        }
        setSlotInitialData(base);
        setPendingSlotDate(date);
        setIsCreateTypeOpen(true);
    }, [doctors, calendars]);

    const handleCreateAppointmentFromSlot = React.useCallback(() => {
        setEditingAppointment(null);
        setIsReschedulingMode(false);
        setIsCreateTypeOpen(false);
        setCreateOpen(true);
    }, []);

    const handleCreateReminderFromSlot = React.useCallback(() => {
        setEditingReminder(null);
        setReminderInitialDate(pendingSlotDate ?? new Date());
        setIsCreateTypeOpen(false);
        setIsReminderFormOpen(true);
    }, [pendingSlotDate]);


    React.useEffect(() => {
        if (groupBy === 'doctor' && selectedDoctorIds.length === 0) {
            setGroupBy('none');
        }
    }, [groupBy, selectedDoctorIds]);

    React.useEffect(() => {
        if (groupBy === 'calendar' && selectedCalendarIds.length === 0) {
            setGroupBy('none');
        }
    }, [groupBy, selectedCalendarIds]);

    const loadLinkedSession = React.useCallback(async (appointment: Appointment, signal?: AbortSignal) => {
        const patientId = appointment.patientId;
        if (!patientId) { setLinkedSession(null); return; }
        setIsLoadingLinkedSession(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: patientId });
            if (signal?.aborted) return;
            const sessions: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
            const match = sessions.find((s: any) => s?.appointment_id?.toString() === appointment.id);
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
            if (signal?.aborted) return;
            setLinkedSession(null);
        } finally {
            if (!signal?.aborted) setIsLoadingLinkedSession(false);
        }
    }, []);

    const loadQuoteInfo = React.useCallback(async (quoteId: string, signal?: AbortSignal) => {
        setIsLoadingQuoteInfo(true);
        try {
            const [ordersData, invoicesData] = await Promise.all([
                api.get(API_ROUTES.SALES.QUOTES_ORDERS, { quote_id: quoteId }).catch(() => []),
                api.get(API_ROUTES.SALES.QUOTES_INVOICES, { quote_id: quoteId }).catch(() => []),
            ]);
            if (signal?.aborted) return;
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
            if (signal?.aborted) return;
            setQuoteOrder(null);
            setQuoteInvoices([]);
        } finally {
            if (!signal?.aborted) setIsLoadingQuoteInfo(false);
        }
    }, []);

    const handleEventClick = (eventData: (Appointment & { kind?: 'appointment' }) | (CalendarReminder & { kind?: 'reminder' })) => {
        if (eventData.kind === 'reminder') {
            setSelectedReminder(eventData);
            setIsReminderPanelOpen(true);
            return;
        }

        const appointment = eventData as Appointment;
        eventClickAbortRef.current?.abort();
        const controller = new AbortController();
        eventClickAbortRef.current = controller;

        setSelectedAppointment(appointment);
        setLinkedSession(null);
        setQuoteOrder(null);
        setQuoteInvoices([]);
        setIsLoadingQuoteInfo(false);
        setIsDetailViewOpen(true);

        const tasks: Promise<void>[] = [loadLinkedSession(appointment, controller.signal)];
        if (appointment.quote_id) tasks.push(loadQuoteInfo(appointment.quote_id, controller.signal));
        Promise.all(tasks);
    };

    const handleSaveReminder = React.useCallback(async (values: ReminderFormValues) => {
        const now = toLocalISOString(new Date());
        const reminderId = editingReminder?.id ?? (
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `local-${Date.now()}`
        );
        const optimisticReminder: CalendarReminder = {
            id: reminderId,
            title: values.title,
            description: values.description,
            start_datetime: values.start_datetime,
            end_datetime: values.end_datetime,
            color: values.color,
            priority: values.priority,
            status: editingReminder?.status ?? 'pending',
            visibility: 'clinic',
            created_by: editingReminder?.created_by ?? null,
            created_at: editingReminder?.created_at ?? now,
            updated_at: editingReminder ? now : null,
        };

        setReminders((prev) => {
            if (editingReminder) {
                return prev.map((item) => (item.id === editingReminder.id ? optimisticReminder : item));
            }
            return [...prev, optimisticReminder];
        });
        setSelectedReminder((prev) => (prev && prev.id === optimisticReminder.id ? optimisticReminder : prev));
        setEditingReminder(null);
        setReminderInitialDate(null);

        try {
            const response = await api.post(API_ROUTES.REMINDERS_UPSERT, {
                id: editingReminder?.id || undefined,
                title: values.title,
                description: values.description,
                start_datetime: values.start_datetime,
                end_datetime: values.end_datetime,
                color: values.color,
                priority: values.priority,
                status: editingReminder?.status ?? 'pending',
                visibility: 'clinic',
                raise_alert: editingReminder?.raise_alert ?? true,
                created_by: editingReminder?.created_by ?? user?.id ?? undefined,
            });
            const result = Array.isArray(response) ? response[0] : response;
            if (result?.error || (result?.code && result.code >= 400)) {
                throw new Error(result?.message || tReminders('errorDesc'));
            }

            const savedReminder = normalizeReminder(result?.reminder || result);
            if (savedReminder) {
                setReminders((prev) => {
                    const filtered = prev.filter((item) => item.id !== reminderId && item.id !== savedReminder.id);
                    return [...filtered, savedReminder];
                });
                setSelectedReminder((prev) => (prev && (prev.id === reminderId || prev.id === savedReminder.id) ? savedReminder : prev));
            }
            toast({ title: tReminders('saved') });
            refreshReminders();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tReminders('error'),
                description: error instanceof Error ? error.message : tReminders('errorDesc'),
            });
            refreshCalendarDataRef.current();
        }
    }, [editingReminder, tReminders, toast, refreshReminders]);

    const handleEditReminder = React.useCallback((reminder: CalendarReminder) => {
        setEditingReminder(reminder);
        setReminderInitialDate(null);
        setIsReminderFormOpen(true);
    }, []);

    const handleMarkReminderDone = React.useCallback(async (reminder: CalendarReminder) => {
        const now = toLocalISOString(new Date());
        const updated: CalendarReminder = { ...reminder, status: 'done', updated_at: now, completed_at: now };
        setReminders((prev) => prev.map((item) => (item.id === reminder.id ? updated : item)));
        setSelectedReminder(updated);
        try {
            const response = await api.post(API_ROUTES.REMINDERS_UPSERT, {
                ...reminder,
                status: 'done',
                raise_alert: reminder.raise_alert ?? true,
            });
            const result = Array.isArray(response) ? response[0] : response;
            if (result?.error || (result?.code && result.code >= 400)) {
                throw new Error(result?.message || tReminders('errorDesc'));
            }
            const savedReminder = normalizeReminder(result?.reminder || result);
            if (savedReminder) {
                setReminders((prev) => prev.map((item) => (item.id === reminder.id ? savedReminder : item)));
                setSelectedReminder(savedReminder);
            }
            toast({ title: tReminders('done') });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tReminders('error'),
                description: error instanceof Error ? error.message : tReminders('errorDesc'),
            });
            refreshCalendarDataRef.current();
        }
    }, [tReminders, toast]);

    const handleDeleteReminder = React.useCallback(async (reminder: CalendarReminder) => {
        setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
        setSelectedReminder(null);
        setIsReminderPanelOpen(false);
        try {
            const response = await api.post(API_ROUTES.REMINDERS_DELETE, { id: reminder.id });
            const result = Array.isArray(response) ? response[0] : response;
            if (result?.error || (result?.code && result.code >= 400)) {
                throw new Error(result?.message || tReminders('errorDesc'));
            }
            toast({ title: tReminders('deleted') });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tReminders('error'),
                description: error instanceof Error ? error.message : tReminders('errorDesc'),
            });
            refreshCalendarDataRef.current();
        }
    }, [tReminders, toast]);

    const handleEdit = (appointment: Appointment) => {
        setEditingAppointment(appointment);
        setIsReschedulingMode(false);
        setCreateOpen(true);
    };

    const handleReschedule = (appointment: Appointment) => {
        setEditingAppointment(appointment);
        setIsReschedulingMode(true);
        setCreateOpen(true);
    };


    const handleCancel = (appointment: Appointment) => {
        setDeletingAppointment(appointment);
        setIsDeleteAlertOpen(true);
    };

    const { updateStatus } = useAppointmentStatus({
        onSuccess: (appt, newStatus, extra) => {
            const patch = {
                status: newStatus,
                cancellation_reason: extra?.cancellation_reason ?? null,
                cancellation_note: extra?.cancellation_note ?? null,
            };

            // Optimistic update so the UI feels instant; the next refresh confirms.
            setAppointments((prev) =>
                prev.map((a) => (a.id === appt.id ? { ...a, ...patch } : a)),
            );
            setSelectedAppointment((prev) =>
                prev && prev.id === appt.id ? { ...prev, ...patch } : prev,
            );
        },
    });

    const handleStatusChange = React.useCallback(
        (
            appointment: Appointment,
            newStatus: AppointmentStatus,
            extra?: { cancellation_reason?: import('@/lib/types').CancellationReason; cancellation_note?: string },
        ) => {
            updateStatus({ appointment, newStatus, ...extra });
        },
        [updateStatus],
    );

    const [pendingCancellation, setPendingCancellation] = React.useState<Appointment | null>(null);
    const handleRequestCustomCancellation = React.useCallback((appointment: Appointment) => {
        setPendingCancellation(appointment);
    }, []);
    const handleConfirmCustomCancellation = React.useCallback((note: string) => {
        if (!pendingCancellation) return;
        updateStatus({
            appointment: pendingCancellation,
            newStatus: 'cancelled',
            cancellation_reason: 'other',
            cancellation_note: note,
        });
        setPendingCancellation(null);
    }, [pendingCancellation, updateStatus]);

    // Clinic Session Handlers
    const handleOpenClinicSession = async (appointment: Appointment) => {
        setClinicSessionAppointment(appointment);
        setLinkedSession(null);

        const tasks: Promise<any>[] = [loadLinkedSession(appointment)];

        if (appointment.quote_id) {
            tasks.push(
                getQuoteItems(appointment.quote_id)
                    .then((items) => setQuoteItems(items))
                    .catch((error) => {
                        console.error('Error al cargar ítems del presupuesto:', error);
                        setQuoteItems([]);
                        toast({
                            variant: 'destructive',
                            title: tToasts('errorLoadingQuoteItems'),
                            description: tToasts('errorLoadingQuoteItemsDesc'),
                        });
                    })
            );
        } else {
            setQuoteItems([]);
        }

        await Promise.all(tasks);
        setIsClinicSessionOpen(true);
    };

    const handleSaveClinicSession = async (data: ClinicSessionFormData) => {
        if (!clinicSessionAppointment?.patientId) {
            toast({
                variant: 'destructive',
                title: t('toasts.errorCreatingSession'),
                description: t('toasts.patientIdRequired'),
            });
            return;
        }

        try {
            const sessionData = {
                ...data,
                appointment_id: clinicSessionAppointment.id,
                quote_id: clinicSessionAppointment.quote_id,
            };

            if (data.sesion_id) {
                await updateSession(
                    data.sesion_id,
                    clinicSessionAppointment.patientId,
                    sessionData,
                    data.archivos_adjuntos,
                    data.deletedAttachmentIds,
                );
                toast({ title: t('toasts.sessionUpdated') });
            } else {
                await createSession(clinicSessionAppointment.patientId, sessionData, data.archivos_adjuntos);
                if (clinicSessionAppointment.status !== 'completed') {
                    await updateAppointmentStatusRequest({
                        appointment: clinicSessionAppointment,
                        newStatus: 'completed',
                    });
                    setAppointments((prev) =>
                        prev.map((appointment) =>
                            appointment.id === clinicSessionAppointment.id
                                ? { ...appointment, status: 'completed' }
                                : appointment,
                        ),
                    );
                    setSelectedAppointment((prev) =>
                        prev && prev.id === clinicSessionAppointment.id
                            ? { ...prev, status: 'completed' }
                            : prev,
                    );
                }
                toast({ title: t('toasts.sessionCreated'), description: t('toasts.sessionCreatedDesc') });
            }

            setIsClinicSessionOpen(false);
            setClinicSessionAppointment(null);
            loadLinkedSession(clinicSessionAppointment);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toasts.errorCreatingSession'),
                description: error instanceof Error ? error.message : t('toasts.errorCreatingSessionDesc'),
            });
            throw error;
        }
    };

    const appointmentColumns: ColumnDef<Appointment>[] = React.useMemo(
        () => getAppointmentColumns({ t: tColumns, tStatus, tReschedule, onEdit: handleEdit, onCancel: handleCancel, onReschedule: handleReschedule, onStatusChange: handleStatusChange, onRequestCustomCancellation: handleRequestCustomCancellation }),
        [tColumns, tStatus, tReschedule, handleStatusChange, handleRequestCustomCancellation],
    );

    const loadAppointments = React.useCallback(async () => {
        if (!fetchRange || !fetchRange.start || !fetchRange.end || !isValid(fetchRange.start) || !isValid(fetchRange.end) || calendars.length === 0) {
            return;
        }

        setIsRefreshing(true);
        const [fetchedAppointments, fetchedReminders] = await Promise.all([
            getAppointments(selectedCalendarIds, fetchRange.start, fetchRange.end, calendars, services, doctors, t),
            getReminders(fetchRange.start, fetchRange.end, user?.id),
        ]);
        setAppointments(fetchedAppointments);
        setReminders(fetchedReminders);

        setIsRefreshing(false);
    }, [selectedCalendarIds, fetchRange, calendars, services, doctors, t, user?.id]);

    const forceRefresh = React.useCallback(() => {
        loadAppointments();
    }, [loadAppointments]);

    React.useEffect(() => { refreshCalendarDataRef.current = forceRefresh; }, [forceRefresh]);

    const [isQuickQuoteOpen, setIsQuickQuoteOpen] = React.useState(false);
    const [quickQuotePatient, setQuickQuotePatient] = React.useState<UserType | null>(null);
    const [quickQuoteInitialItems, setQuickQuoteInitialItems] = React.useState<SessionPreloadedService[] | undefined>();
    // notifId pendiente: se usa para marcar la acción en el contexto de notificaciones
    // solo cuando el guardado del formulario es exitoso (no al abrir el dialog).
    const [pendingQuoteNotifId, setPendingQuoteNotifId] = React.useState<string | undefined>();
    const [isInvoiceFormOpen, setIsInvoiceFormOpen] = React.useState(false);
    const [invoicePatient, setInvoicePatient] = React.useState<UserType | null>(null);
    const [invoiceInitialItems, setInvoiceInitialItems] = React.useState<SessionPreloadedService[] | undefined>();
    const [pendingInvoiceNotifId, setPendingInvoiceNotifId] = React.useState<string | undefined>();
    const [pendingScheduleNotifId, setPendingScheduleNotifId] = React.useState<string | undefined>();
    const [scheduleNextResolvedServices, setScheduleNextResolvedServices] = React.useState<Service[] | undefined>();

    // ── Notification deep-link handlers ───────────────────────────────────────
    /**
     * Enriches preloaded AI service items with prices from the loaded services catalog.
     * AI treatments only carry service_id/name — prices must come from the catalog.
     */
    const enrichItemsWithPrices = React.useCallback(async (items?: SessionPreloadedService[]): Promise<SessionPreloadedService[] | undefined> => {
        if (!items || items.length === 0) return undefined;
        const ids = items.map(i => i.service_id).filter((id): id is string => Boolean(id));
        const catalogItems = await fetchServicesByIds(ids);
        return items.map(item => {
            const catalogService = catalogItems.find(s => String(s.id) === String(item.service_id));
            return {
                ...item,
                unit_price: catalogService?.price ?? item.unit_price,
                service_name: catalogService?.name ?? item.service_name,
            };
        });
    }, []);

    const handleNotifQuote = React.useCallback(async (patientId: string, patientName: string, items?: SessionPreloadedService[], notifId?: string) => {
        setQuickQuotePatient({ id: patientId, name: patientName, email: '', phone_number: '', is_active: true, avatar: '' } as UserType);
        setQuickQuoteInitialItems(await enrichItemsWithPrices(items));
        setPendingQuoteNotifId(notifId);
        setIsQuickQuoteOpen(true);
    }, [enrichItemsWithPrices]);

    const handleNotifSchedule = React.useCallback((
        patientId: string,
        patientName: string,
        date?: string,
        doctorId?: string,
        doctorName?: string,
        items?: SessionPreloadedService[],
        quoteId?: string,
        calendarId?: string,
        notifId?: string,
    ) => {
        setScheduleNextData({ patientId, patientName, date, doctorId, doctorName, services: items, quoteId, calendarId });
        setPendingScheduleNotifId(notifId);
        setCreateOpen(true);
    }, []);

    const handleNotifInvoice = React.useCallback(async (patientId: string, patientName: string, items?: SessionPreloadedService[], notifId?: string) => {
        setInvoicePatient({ id: patientId, name: patientName, email: '', phone_number: '', is_active: true, avatar: '' } as UserType);
        setInvoiceInitialItems(await enrichItemsWithPrices(items));
        setPendingInvoiceNotifId(notifId);
        setIsInvoiceFormOpen(true);
    }, [enrichItemsWithPrices]);

    // Fetch the catalog services for the AI-detected IDs whenever scheduleNextData changes.
    React.useEffect(() => {
        const ids = scheduleNextData?.services
            ?.map(s => s.service_id)
            .filter((id): id is string => Boolean(id));
        if (!ids || ids.length === 0) {
            setScheduleNextResolvedServices(undefined);
            return;
        }
        fetchServicesByIds(ids).then(items => {
            setScheduleNextResolvedServices(items.length > 0 ? items : undefined);
        }).catch(() => setScheduleNextResolvedServices(undefined));
    }, [scheduleNextData]);

    // Resolved initialData for the "schedule next" dialog — memoized to avoid a new
    // object reference on every render while the dialog is open.
    const scheduleNextInitialData = React.useMemo(() => {
        if (!scheduleNextData) return undefined;
        const doctor = scheduleNextData.doctorId
            ? (doctors.find(d => String(d.id) === scheduleNextData.doctorId) ?? null)
            : null;
        const calendar = scheduleNextData.calendarId
            ? (calendars.find(c => String(c.id) === scheduleNextData.calendarId) ?? null)
            : null;
        const quote: Quote | null = scheduleNextData.quoteId
            ? {
                id: scheduleNextData.quoteId,
                user_id: scheduleNextData.patientId,
                total: 0,
                status: 'draft',
                payment_status: 'unpaid',
                billing_status: 'not_invoiced',
                createdAt: '',
            }
            : null;
        return {
            user: { id: scheduleNextData.patientId, name: scheduleNextData.patientName } as UserType,
            date: scheduleNextData.date,
            doctor,
            calendar,
            services: scheduleNextResolvedServices,
            quote,
        };
    }, [scheduleNextData, doctors, calendars, scheduleNextResolvedServices]);
    // ─────────────────────────────────────────────────────────────────────────

    const loadInitialData = React.useCallback(async () => {
        setIsDataLoading(true);
        const [fetchedCalendars, fetchedServices, fetchedDoctors, fetchedSettings, fetchedSedes] = await Promise.all([
            getCalendars(),
            getServices(),
            getDoctors(),
            getCalendarSettings(),
            getSedes(),
        ]);
        setCalendars(fetchedCalendars);
        setSedes(fetchedSedes);
        setServices(fetchedServices);
        setDoctors(fetchedDoctors);

        handleSettingsChange(fetchedSettings);

        const doctorIds = fetchedDoctors.map(d => d.id).filter(Boolean);
        const serviceMap = await getUsersServicesBatch(doctorIds);
        setDoctorServiceMap(serviceMap);

        setSelectedDoctorIds(fetchedDoctors.map(d => d.id));
        // Honor the configured default branch (sede): show only its calendars by
        // default. Empty = all. prevSedeRef keeps the live-change effect from
        // re-applying this same selection right after load.
        const defaultSedeId = fetchedSettings.default_sede || '';
        const initialCalendarIds = (defaultSedeId
            ? fetchedCalendars.filter(c => String(c.sede_id) === String(defaultSedeId))
            : fetchedCalendars
        ).map(c => c.id).filter(id => id);
        prevSedeRef.current = defaultSedeId;
        setSelectedCalendarIds(initialCalendarIds);
        setIsDataLoading(false);
    }, [handleSettingsChange]);

    // Moved doctor filtering to AppointmentFormDialog



    React.useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    React.useEffect(() => {
        if (!isDataLoading && fetchRange) {
            loadAppointments();
        }
    }, [loadAppointments, selectedCalendarIds, fetchRange, isDataLoading]);

    // Silent calendar refresh when the notification system detects new events
    // (new appointments, status changes, completed sessions) or after a
    // notification action is taken from the panel while on this page.
    React.useEffect(() => {
        const handler = () => { if (!isDataLoading) forceRefresh(); };
        window.addEventListener('clinic:calendar:refresh', handler);
        return () => window.removeEventListener('clinic:calendar:refresh', handler);
    }, [forceRefresh, isDataLoading]);

    // Moved searches to AppointmentFormDialog


    // Moved checkAvailability to AppointmentFormDialog



    const handleSaveSuccess = () => {
        forceRefresh();
        setCreateOpen(false);
        setEditingAppointment(null);
        setSlotInitialData(null);
        if (pendingScheduleNotifId) {
            markSessionAction(pendingScheduleNotifId, 'schedule');
            setPendingScheduleNotifId(undefined);
        }
    };

    const handleEventColorChange = async (eventData: (Appointment & { kind?: 'appointment' }) | (CalendarReminder & { kind?: 'reminder' }), colorId: string) => {
        const colorHex = colorMap.get(colorId);
        if (eventData.kind === 'reminder') {
            const color = colorHex || eventData.color || '#8b5cf6';
            setReminders((prev) => prev.map((item) => (
                item.id === eventData.id ? { ...item, color, updated_at: toLocalISOString(new Date()) } : item
            )));
            setSelectedReminder((prev) => (prev && prev.id === eventData.id ? { ...prev, color } : prev));
            try {
                const response = await api.post(API_ROUTES.REMINDERS_UPSERT, {
                    ...eventData,
                    color,
                    raise_alert: eventData.raise_alert ?? true,
                });
                const result = Array.isArray(response) ? response[0] : response;
                if (result?.error || (result?.code && result.code >= 400)) {
                    throw new Error(result?.message || tReminders('errorDesc'));
                }
                const savedReminder = normalizeReminder(result?.reminder || result);
                if (savedReminder) {
                    setReminders((prev) => prev.map((item) => (item.id === eventData.id ? savedReminder : item)));
                    setSelectedReminder((prev) => (prev && prev.id === eventData.id ? savedReminder : prev));
                }
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: tReminders('error'),
                    description: error instanceof Error ? error.message : tReminders('errorDesc'),
                });
                forceRefresh();
            }
            return;
        }

        const appointment = eventData as Appointment;

        // Optimistically update UI
        setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, color: colorHex, colorId: colorId } : a));

        // Persist change to backend using snake_case for consistency
        const payload = {
            appointment_id: appointment.id,
            google_event_id: appointment.googleEventId,
            calendar_source_id: appointment.calendar_source_id,
            color_id: colorId
        };

        try {
            const responseData = await api.post(API_ROUTES.APPOINTMENTS_UPDATE_COLOR, payload);
            if (responseData.error || (responseData.code && responseData.code >= 400)) {
                throw new Error(responseData.message || 'Failed to update color');
            }

            toast({
                title: tToasts('colorUpdated'),
                description: tToasts('colorUpdatedDesc'),
            });
            forceRefresh(); // Re-fetch to confirm state
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tToasts('errorUpdatingColor'),
                description: error instanceof Error ? error.message : tToasts('errorUpdatingColorDesc'),
            });
            // Revert optimistic update on failure
            forceRefresh();
        }
    };

    const confirmDeleteAppointment = async () => {
        if (!deletingAppointment) return;
        try {
            const responseData = await api.delete(API_ROUTES.APPOINTMENTS_DELETE, {
                appointment_id: deletingAppointment.id,
                google_event_id: deletingAppointment.googleEventId,
                calendar_source_id: deletingAppointment.calendar_source_id,
            });
            const result = Array.isArray(responseData) ? responseData[0] : responseData;

            const isSuccess = !result.error && (result.code === 200 || result.success || result.message);

            if (isSuccess) {
                toast({
                    title: tToasts('appointmentCancelled'),
                    description: result.message || tToasts('appointmentCancelledDesc'),
                });
                setIsDeleteAlertOpen(false);
                setDeletingAppointment(null);
                forceRefresh();
            } else {
                const errorMessage = result.message || tToasts('failedDelete');
                throw new Error(errorMessage);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tToasts('error'),
                description: error instanceof Error ? error.message : tToasts('failedCancel'),
            });
        }
    };

    const onDateChange = React.useCallback((newRange: { start: Date; end: Date }) => {
        setFetchRange(newRange);
    }, []);

    const calendarEvents = React.useMemo(() => {
        const selectedDoctorIdSet = new Set(selectedDoctorIds.map(String));
        const selectedCalendarIdSet = new Set(selectedCalendarIds.map(String));
        const events = appointments
            .filter((appt) => {
                if (isBulkMode) return true;
                const id = String(appt.doctorId || '');
                if (!id) return true;
                return selectedDoctorIdSet.has(id);
            })
            .filter((appt) => {
                if (isBulkMode) return true;
                const id = String(appt.calendar_source_id || appt.calendar_id || '');
                if (!id) return true;
                return selectedCalendarIdSet.has(id);
            })
            .map(appt => {
            if (!appt.start?.dateTime || !appt.end?.dateTime) {
                console.warn("Appointment missing start or end dateTime:", appt);
                return null;
            }
            try {
                const start = parseISO(appt.start.dateTime.replace(/Z$/, ''));
                const end = parseISO(appt.end.dateTime.replace(/Z$/, ''));

                if (!isValid(start) || !isValid(end)) {
                    console.error("Invalid start/end date for appointment", appt);
                    return null;
                }

                const matchedCalendar = calendars.find((calendar) => String(calendar.id) === String(appt.calendar_source_id));
                return {
                    id: String(appt.id),
                    title: appt.summary || appt.service_name || 'Cita',
                    label: buildEventLabel(appt, start, eventLabelFormat),
                    start,
                    end,
                    doctorGroupId: appt.doctorId || undefined,
                    calendarGroupId: matchedCalendar?.id || appt.calendar_source_id || undefined,
                    data: { ...appt, kind: 'appointment' as const },
                    color: appt.color,
                    colorId: appt.colorId,
                };
            } catch (e) {
                console.error("Error parsing date/time for appointment", appt, e);
                return null;
            }
        }).filter((event): event is NonNullable<typeof event> => event !== null);

        const reminderEvents = reminders
            .filter((reminder) => reminder.status !== 'cancelled')
            .map((reminder) => {
                const start = parseISO(reminder.start_datetime.replace(/Z$/, ''));
                const end = reminder.end_datetime ? parseISO(reminder.end_datetime.replace(/Z$/, '')) : start;
                if (!isValid(start) || !isValid(end)) return null;

                return {
                    id: `reminder-${reminder.id}`,
                    title: reminder.title,
                    start,
                    end,
                    data: { ...reminder, kind: 'reminder' as const },
                    color: reminder.color || '#8b5cf6',
                };
            })
            .filter((event): event is NonNullable<typeof event> => event !== null);

        return [...events, ...reminderEvents];
    }, [appointments, calendars, reminders, selectedCalendarIds, selectedDoctorIds, eventLabelFormat, isBulkMode]);


    const handleSelectDoctor = React.useCallback((doctorId: string, checked: boolean) => {
        setSelectedDoctorIds(prev => {
            if (checked) {
                return [...prev, doctorId];
            } else {
                return prev.filter(id => id !== doctorId);
            }
        });
    }, []);

    const showGroupControls = ['day', '2-day', '3-day', 'week'].includes(currentView);
    // The doctors filter also applies to the agenda (schedule) view, even though
    // that view does not support column grouping.
    const showDoctorFilter = showGroupControls || currentView === 'schedule';

    const handleSelectCalendar = React.useCallback((calendarId: string, checked: boolean) => {
        setSelectedCalendarIds(prev => {
            if (checked) {
                return [...prev, calendarId];
            } else {
                return prev.filter(id => id !== calendarId);
            }
        });
    }, []);

    const doctorGroupingColumns = React.useMemo<CalendarGroupingColumn[]>(() => {
        return doctors
            .filter((doctor) => selectedDoctorIds.includes(doctor.id))
            .map((doctor) => ({
                id: doctor.id,
                label: doctor.name,
                value: doctor.id,
                color: (doctor as any).color ?? undefined,
            }));
    }, [doctors, selectedDoctorIds]);

    const calendarGroupingColumns = React.useMemo<CalendarGroupingColumn[]>(() => {
        return calendars
            .filter((calendar) => selectedCalendarIds.includes(calendar.id))
            .map((calendar) => ({
                id: calendar.id,
                label: calendar.name,
                value: calendar.id,
                color: (calendar as any).color ?? undefined,
            }));
    }, [calendars, selectedCalendarIds]);

    // Calendars grouped by sede, used by the calendar selector to offer a
    // per-sede "select all" toggle. Calendars without a sede fall into a
    // dedicated bucket rendered separately.
    const calendarSedeGroups = React.useMemo(() => {
        const groups = new Map<string, { id: string; name: string; calendars: CalendarType[] }>();
        const noSede: CalendarType[] = [];
        calendars.forEach((cal) => {
            if (cal.sede_id) {
                if (!groups.has(cal.sede_id)) {
                    const sedeName = sedes.find(s => s.id === cal.sede_id)?.name || cal.sede_name || cal.sede_id;
                    groups.set(cal.sede_id, { id: cal.sede_id, name: sedeName, calendars: [] });
                }
                groups.get(cal.sede_id)!.calendars.push(cal);
            } else {
                noSede.push(cal);
            }
        });
        return { sedeGroups: Array.from(groups.values()), noSede };
    }, [calendars, sedes]);

    const handleSelectSede = React.useCallback((calendarIds: string[], checked: boolean) => {
        setSelectedCalendarIds(prev => {
            if (checked) {
                return Array.from(new Set([...prev, ...calendarIds]));
            }
            return prev.filter(id => !calendarIds.includes(id));
        });
    }, []);

    const groupingColumns = React.useMemo<CalendarGroupingColumn[]>(() => {
        if (groupBy === 'doctor') return doctorGroupingColumns;
        if (groupBy === 'calendar') return calendarGroupingColumns;
        return [];
    }, [calendarGroupingColumns, doctorGroupingColumns, groupBy]);

    const groupByLabel = React.useMemo(() => {
        if (groupBy === 'doctor') return t('grouping.options.doctor');
        if (groupBy === 'calendar') return t('grouping.options.calendar');
        return t('grouping.options.none');
    }, [groupBy, t]);

    // Render additional context menu items for the calendar event:
    // status submenu + clinic session shortcut.
    const renderEventContextMenu = (eventData: (Appointment & { kind?: 'appointment' }) | (CalendarReminder & { kind?: 'reminder' })) => {
        if (eventData.kind === 'reminder') {
            const reminder = eventData as CalendarReminder;
            return (
                <>
                    <ContextMenuSeparator />
                    {reminder.status !== 'done' && (
                        <ContextMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMarkReminderDone(reminder);
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <Check className="h-4 w-4" />
                            {tReminders('markDone')}
                        </ContextMenuItem>
                    )}
                    <ContextMenuItem
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditReminder(reminder);
                        }}
                        className="flex items-center gap-2 cursor-pointer"
                    >
                        <Edit className="h-4 w-4" />
                        {tReminders('edit')}
                    </ContextMenuItem>
                    <ContextMenuItem
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteReminder(reminder);
                        }}
                        className="flex items-center gap-2 cursor-pointer text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                        {tReminders('delete')}
                    </ContextMenuItem>
                </>
            );
        }

        const appointment = eventData as Appointment;
        return (
            <>
            <ContextMenuSeparator />
            <ContextMenuSub>
                <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                    <ClipboardCheck className="h-4 w-4" />
                    {tStatusMenu('changeStatus')}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                    <AppointmentStatusContextItems
                        appointment={appointment}
                        onChange={(s, extra) => handleStatusChange(appointment, s, extra)}
                        onRequestCustomCancellation={() => handleRequestCustomCancellation(appointment)}
                        ItemComponent={ContextMenuItem}
                        SubComponent={ContextMenuSub}
                        SubTriggerComponent={ContextMenuSubTrigger}
                        SubContentComponent={ContextMenuSubContent}
                        SeparatorComponent={ContextMenuSeparator}
                    />
                </ContextMenuSubContent>
            </ContextMenuSub>
            {canReschedule(appointment.status) && (
                <ContextMenuItem
                    key="reschedule"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleReschedule(appointment);
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <CalendarSync className="h-4 w-4" />
                    {tReschedule('action')}
                </ContextMenuItem>
            )}
            <ContextMenuItem
                key="clinic-session"
                onClick={(e) => {
                    e.stopPropagation();
                    handleOpenClinicSession(appointment);
                }}
                className="flex items-center gap-2 cursor-pointer"
            >
                <Stethoscope className="h-4 w-4" />
                {t('contextMenu.createSession')}
            </ContextMenuItem>
            </>
        );
    };

    // Unused form logic removed


    React.useEffect(() => {
        setAppointments([]);
    }, [selectedCalendarIds]);

    // Stabilize prefillTreatments with useMemo to prevent unnecessary recalculations
    // Include all quote items as treatments: items with tooth_number get it prefilled, others get null
    const prefillTreatments = React.useMemo(() => {
        return quoteItems.map(item => {
            const toothNum = item.tooth_number != null ? Number(item.tooth_number) : null;
            return {
                numero_diente: toothNum != null && !isNaN(toothNum) && toothNum > 0 ? toothNum : null,
                descripcion: item.service_name,
            };
        });
    }, [quoteItems]);

    // Bulk selection header computed values
    const visibleSelectableIds = React.useMemo(
        () => appointments.filter(a => !['completed', 'cancelled', 'in_progress'].includes(a.status)).map(a => a.id),
        [appointments],
    );
    const bulkAllSelected = visibleSelectableIds.length > 0 && visibleSelectableIds.every(id => bulkSelectedIds.has(id));
    const bulkSomeSelected = !bulkAllSelected && visibleSelectableIds.some(id => bulkSelectedIds.has(id));

    // Desktop-only contextual header rendered when bulk mode is active
    const bulkModeHeaderContent = (isBulkMode && breakpoint === 'desktop') ? (
        <TooltipProvider delayDuration={300}>
        <div ref={bulkToolbarRef} className="flex items-center gap-2 w-full min-w-0">
            {/* Left: selection counter — always visible */}
            <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                    checked={bulkSomeSelected ? 'indeterminate' : bulkAllSelected}
                    onCheckedChange={(c) => handleSelectAllVisible(!!c)}
                />
                <span className="text-sm font-medium whitespace-nowrap">
                    {bulkSelectedIds.size > 0
                        ? tBulk('selectedCount', { count: bulkSelectedIds.size })
                        : tBulk('selectHint')}
                </span>
                {bulkSelectedIds.size > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                        skipNextBulkFilterRef.current = true;
                        setBulkSelectedIds(new Set());
                        setBulkDoctorIds([]);
                        setBulkCalendarIds([]);
                    }}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        {!isBulkToolbarCompact && tBulk('clearSelection')}
                    </Button>
                )}
            </div>

            {/* Middle: filters */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Date preset selector */}
                <Select value={bulkDatePreset} onValueChange={(v) => setBulkDatePreset(v as AppointmentDatePreset)}>
                    <SelectTrigger className={cn('h-8 text-xs shrink-0', isBulkToolbarCompact ? 'w-28' : 'w-36')}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(['today', 'this_week', 'this_month'] as AppointmentDatePreset[]).map((preset) => (
                            <SelectItem key={preset} value={preset} className="text-xs">
                                {tBulk(preset)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Doctor filter */}
                <Popover>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                                    <Users className="h-3.5 w-3.5 shrink-0" />
                                    {!isBulkToolbarCompact && tBulk('doctorFilter')}
                                    {bulkDoctorIds.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{bulkDoctorIds.length}</Badge>}
                                    {isBulkLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        {isBulkToolbarCompact && <TooltipContent>{tBulk('doctorFilter')}</TooltipContent>}
                    </Tooltip>
                    <PopoverContent className="w-52 p-2" align="start">
                        <div className="space-y-0.5">
                            {(() => {
                                const activeDoctors = doctors.filter(d => d.is_active);
                                const allSelected = activeDoctors.length > 0 && activeDoctors.every(d => bulkDoctorIds.includes(d.id));
                                const someSelected = !allSelected && activeDoctors.some(d => bulkDoctorIds.includes(d.id));
                                return (
                                    <>
                                        <label className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer border-b pb-2 mb-1">
                                            <Checkbox
                                                checked={someSelected ? 'indeterminate' : allSelected}
                                                onCheckedChange={(c) => setBulkDoctorIds(c ? activeDoctors.map(d => d.id) : [])}
                                            />
                                            <span className="text-sm font-medium">{t('selectAll')}</span>
                                        </label>
                                        {activeDoctors.map((doctor) => (
                                            <label key={doctor.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                                                <Checkbox checked={bulkDoctorIds.includes(doctor.id)} onCheckedChange={(c) => handleSelectBulkDoctor(doctor.id, !!c)} />
                                                <span className="text-sm">{doctor.name}</span>
                                            </label>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Calendar filter */}
                <Popover>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                                    {!isBulkToolbarCompact && tBulk('calendarFilter')}
                                    {bulkCalendarIds.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{bulkCalendarIds.length}</Badge>}
                                    {isBulkLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        {isBulkToolbarCompact && <TooltipContent>{tBulk('calendarFilter')}</TooltipContent>}
                    </Tooltip>
                    <PopoverContent className="w-52 p-2" align="start">
                        <div className="space-y-0.5">
                            {(() => {
                                const allSelected = calendars.length > 0 && calendars.every(c => bulkCalendarIds.includes(c.id));
                                const someSelected = !allSelected && calendars.some(c => bulkCalendarIds.includes(c.id));
                                return (
                                    <>
                                        <label className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer border-b pb-2 mb-1">
                                            <Checkbox
                                                checked={someSelected ? 'indeterminate' : allSelected}
                                                onCheckedChange={(c) => setBulkCalendarIds(c ? calendars.map(c => c.id) : [])}
                                            />
                                            <span className="text-sm font-medium">{t('selectAll')}</span>
                                        </label>
                                        {calendars.map((cal) => (
                                            <label key={cal.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                                                <Checkbox checked={bulkCalendarIds.includes(cal.id)} onCheckedChange={(c) => handleSelectBulkCalendar(cal.id, !!c)} />
                                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cal.color }} />
                                                <span className="text-sm truncate">{cal.name}</span>
                                            </label>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Right: action buttons — always visible */}
            <div className="flex items-center gap-2 shrink-0">
                <Separator orientation="vertical" className="h-5" />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            disabled={bulkSelectedIds.size === 0}
                            onClick={() => setIsReassignDialogOpen(true)}
                        >
                            <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                            {!isBulkToolbarCompact && tBulk('reassignDoctor')}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{tBulk('reassignDoctor')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleToggleBulkMode}>
                            <X className="h-3.5 w-3.5 shrink-0" />
                            {!isBulkToolbarCompact && tBulk('exitBulkMode')}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{tBulk('exitBulkMode')}</TooltipContent>
                </Tooltip>
            </div>
        </div>
        </TooltipProvider>
    ) : undefined;

    return (
        <Card className="border-none shadow-none h-full">
            <CardContent className="p-0 h-[calc(100vh-6rem)] min-h-[600px]">
                <Calendar
                    view={currentView}
                    hourSlotHeight={hourSlotHeight}
                    events={calendarEvents}
                    onDateChange={onDateChange}
                    isLoading={isRefreshing}
                    onEventClick={handleEventClick}
                    onEventColorChange={handleEventColorChange}
                    onEventContextMenu={isBulkMode ? undefined : renderEventContextMenu}
                    groupBy={groupBy}
                    groupingColumns={groupingColumns}
                    onViewChange={setCurrentView}
                    selectedAppointmentIds={isBulkMode ? bulkSelectedIds : undefined}
                    onToggleAppointmentSelect={isBulkMode ? handleToggleAppointmentSelect : undefined}
                    bulkModeContent={bulkModeHeaderContent}
                    onSlotClick={handleSlotClick}
                    filterSheet={
                        <div className="space-y-6">
                            {/* Bulk selection filters (mobile) */}
                            {isBulkMode && (
                                <>
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3">{tBulk('panelTitle')}</h4>
                                        <Select value={bulkDatePreset} onValueChange={(v) => setBulkDatePreset(v as AppointmentDatePreset)}>
                                            <SelectTrigger className="h-8 w-full text-xs mb-3">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(['today', 'this_week', 'this_month'] as AppointmentDatePreset[]).map((preset) => (
                                                    <SelectItem key={preset} value={preset} className="text-xs">
                                                        {tBulk(preset)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="space-y-1 mb-3">
                                            <p className="text-xs text-muted-foreground font-medium mb-1">{tBulk('doctorFilter')}</p>
                                            {(() => {
                                                const activeDoctors = doctors.filter(d => d.is_active);
                                                const allSelected = activeDoctors.length > 0 && activeDoctors.every(d => bulkDoctorIds.includes(d.id));
                                                const someSelected = !allSelected && activeDoctors.some(d => bulkDoctorIds.includes(d.id));
                                                return (
                                                    <>
                                                        <label className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer border-b pb-2 mb-1">
                                                            <Checkbox
                                                                checked={someSelected ? 'indeterminate' : allSelected}
                                                                onCheckedChange={(c) => setBulkDoctorIds(c ? activeDoctors.map(d => d.id) : [])}
                                                            />
                                                            <span className="text-sm font-medium">{t('selectAll')}</span>
                                                        </label>
                                                        {activeDoctors.map((doctor) => (
                                                            <label key={doctor.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                                                                <Checkbox checked={bulkDoctorIds.includes(doctor.id)} onCheckedChange={(c) => handleSelectBulkDoctor(doctor.id, !!c)} />
                                                                <span className="text-sm">{doctor.name}</span>
                                                            </label>
                                                        ))}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <div className="space-y-1 mb-3">
                                            <p className="text-xs text-muted-foreground font-medium mb-1">{tBulk('calendarFilter')}</p>
                                            {(() => {
                                                const allSelected = calendars.length > 0 && calendars.every(c => bulkCalendarIds.includes(c.id));
                                                const someSelected = !allSelected && calendars.some(c => bulkCalendarIds.includes(c.id));
                                                return (
                                                    <>
                                                        <label className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer border-b pb-2 mb-1">
                                                            <Checkbox
                                                                checked={someSelected ? 'indeterminate' : allSelected}
                                                                onCheckedChange={(c) => setBulkCalendarIds(c ? calendars.map(cal => cal.id) : [])}
                                                            />
                                                            <span className="text-sm font-medium">{t('selectAll')}</span>
                                                        </label>
                                                        {calendars.map((cal) => (
                                                            <label key={cal.id} className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                                                                <div className="flex items-center gap-2">
                                                                    <Checkbox checked={bulkCalendarIds.includes(cal.id)} onCheckedChange={(c) => handleSelectBulkCalendar(cal.id, !!c)} />
                                                                    <span className="text-sm">{cal.name}</span>
                                                                </div>
                                                                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cal.color }} />
                                                            </label>
                                                        ))}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        {isBulkLoading && (
                                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {tBulk('applying')}
                                            </div>
                                        )}
                                    </div>
                                    <Separator />
                                </>
                            )}
                            {/* Calendars section */}
                            <div>
                                <h4 className="text-sm font-semibold mb-3">{t('calendars')}</h4>
                                <div className="flex gap-2 mb-3">
                                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedCalendarIds(calendars.map(c => c.id))}>{t('selectAll')}</Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedCalendarIds([])}>{t('deselectAll')}</Button>
                                </div>
                                <div className="space-y-1">
                                    {calendarSedeGroups.sedeGroups.map((group) => {
                                        const groupCalendarIds = group.calendars.map(c => c.id);
                                        const selectedCount = groupCalendarIds.filter(id => selectedCalendarIds.includes(id)).length;
                                        const allSelected = selectedCount === groupCalendarIds.length;
                                        const someSelected = selectedCount > 0 && !allSelected;
                                        return (
                                            <div key={group.id}>
                                                <label className="flex items-center gap-2 py-2 px-1 rounded-md hover:bg-muted/50 cursor-pointer">
                                                    <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={(checked) => handleSelectSede(groupCalendarIds, !!checked)} />
                                                    <span className="text-sm font-medium">{group.name}</span>
                                                </label>
                                                <div className="pl-6">
                                                    {group.calendars.map((calendar) => (
                                                        <label key={calendar.id} className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-muted/50 cursor-pointer">
                                                            <div className="flex items-center gap-2">
                                                                <Checkbox checked={selectedCalendarIds.includes(calendar.id)} onCheckedChange={(checked) => handleSelectCalendar(calendar.id, !!checked)} />
                                                                <span className="text-sm">{calendar.name}</span>
                                                            </div>
                                                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {calendarSedeGroups.noSede.map((calendar) => (
                                        <label key={calendar.id} className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-muted/50 cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <Checkbox checked={selectedCalendarIds.includes(calendar.id)} onCheckedChange={(checked) => handleSelectCalendar(calendar.id, !!checked)} />
                                                <span className="text-sm">{calendar.name}</span>
                                            </div>
                                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* Doctors section */}
                            {showDoctorFilter && (
                                <>
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3">{t('doctors')}</h4>
                                        <div className="flex gap-2 mb-3">
                                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedDoctorIds(doctors.map(d => d.id))}>{t('selectAll')}</Button>
                                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedDoctorIds([])}>{t('deselectAll')}</Button>
                                        </div>
                                        <div className="space-y-1">
                                            {doctors.map((doctor) => (
                                                <label key={doctor.id} className="flex items-center gap-2 py-2 px-1 rounded-md hover:bg-muted/50 cursor-pointer">
                                                    <Checkbox checked={selectedDoctorIds.includes(doctor.id)} onCheckedChange={(checked) => handleSelectDoctor(doctor.id, !!checked)} />
                                                    <span className="text-sm">{doctor.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <Separator />
                                </>
                            )}

                            {/* Grouping section (compact header only) */}
                            {breakpoint !== 'desktop' && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold">{t('grouping.label')}</h4>
                                    <div className="space-y-1">
                                        {[
                                            { value: 'none', label: t('grouping.options.none') },
                                            { value: 'doctor', label: t('grouping.options.doctor') },
                                            { value: 'calendar', label: t('grouping.options.calendar') }
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                className="flex items-center justify-between w-full py-2.5 px-1 rounded-md hover:bg-muted/50 cursor-pointer text-left"
                                                onClick={() => setGroupBy(opt.value as CalendarGroupBy)}
                                            >
                                                <span className="text-sm">{opt.label}</span>
                                                {groupBy === opt.value && <Check className="h-4 w-4 text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                    <Separator />
                                </div>
                            )}

                            {/* Settings section */}
                            <div className="pt-2">
                                <CalendarSettingsForm onSettingsChange={handleSettingsEditorChange} showTitle={true} sedes={sedes} />
                            </div>
                        </div>
                    }
                    extraActions={
                        <TooltipProvider>
                            <div className="flex items-center gap-1.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={isBulkMode ? 'default' : 'outline'}
                                        size={isMobile ? 'icon' : 'sm'}
                                        className={isMobile ? 'h-8 w-8' : 'h-9 gap-1.5'}
                                        onClick={handleToggleBulkMode}
                                    >
                                        <Layers className="h-4 w-4" />
                                        {!isMobile && tBulk('toggleButton')}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{tBulk('toggleButton')}</TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant={isMobile ? "ghost" : "default"}
                                                size={isMobile ? "icon" : "sm"}
                                                className={isMobile ? "h-8 w-8" : "h-9 gap-1.5"}
                                            >
                                                <PlusCircle className="h-4 w-4" />
                                                {!isMobile && (
                                                    <>
                                                        {tGeneral('create')}
                                                        <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                                                    </>
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {tGeneral('create')}
                                    </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align="end" className="w-64 p-1.5">
                                    <DropdownMenuItem
                                        className="cursor-pointer items-start gap-3 rounded-md p-3"
                                        onSelect={handleNewAppointmentClick}
                                    >
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                            <CalendarPlus className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block font-medium">{tReminders('createType.appointment')}</span>
                                            <span className="block text-xs leading-snug text-muted-foreground">
                                                {tReminders('createType.appointmentDescription')}
                                            </span>
                                        </span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer items-start gap-3 rounded-md p-3"
                                        onSelect={handleNewReminderClick}
                                    >
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-violet-100 text-violet-700">
                                            <BellRing className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block font-medium">{tReminders('createType.reminder')}</span>
                                            <span className="block text-xs leading-snug text-muted-foreground">
                                                {tReminders('createType.reminderDescription')}
                                            </span>
                                        </span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                        </TooltipProvider>
                    }
                    extraActionsAfterToday={
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={forceRefresh} variant="ghost" size="icon" disabled={isRefreshing} className={isMobile ? "h-8 w-8" : "h-9 w-9"}>
                                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {t('refresh')}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    }
                    trailingActions={
                        breakpoint === 'desktop' ? (
                            <CalendarSettingsPopover onSettingsChange={handleSettingsEditorChange} sedes={sedes} />
                        ) : null
                    }
                >
                    <div className="flex items-center gap-2">
                        {/* Mobile/tablet bulk mode bar — compact row shown below the normal header */}
                        {isBulkMode && breakpoint !== 'desktop' && (
                            <div className="flex items-center gap-1.5 w-full py-0.5">
                                <Checkbox
                                    checked={bulkSomeSelected ? 'indeterminate' : bulkAllSelected}
                                    onCheckedChange={(c) => handleSelectAllVisible(!!c)}
                                    className="shrink-0"
                                />
                                <span className="text-xs font-medium flex-1 min-w-0 truncate">
                                    {bulkSelectedIds.size > 0
                                        ? tBulk('selectedCount', { count: bulkSelectedIds.size })
                                        : tBulk('selectHint')}
                                </span>
                                {bulkSelectedIds.size > 0 && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setBulkSelectedIds(new Set())}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    className="h-7 shrink-0 gap-1.5"
                                    disabled={bulkSelectedIds.size === 0}
                                    onClick={() => setIsReassignDialogOpen(true)}
                                >
                                    <Stethoscope className="h-3.5 w-3.5" />
                                    {breakpoint === 'tablet' && <span className="text-xs">{tBulk('reassignDoctor')}</span>}
                                </Button>
                                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={handleToggleBulkMode}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                        {breakpoint === 'desktop' && (
                            <div className="flex items-center gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                            {t('calendars')}
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2">
                                        <Command>
                                            <CommandList>
                                                <CommandGroup>
                                                    <CommandItem onSelect={() => setSelectedCalendarIds(calendars.map(c => c.id))}>{t('selectAll')}</CommandItem>
                                                    <CommandItem onSelect={() => setSelectedCalendarIds([])}>{t('deselectAll')}</CommandItem>
                                                    <hr className="my-2" />
                                                    {calendarSedeGroups.sedeGroups.map((group) => {
                                                        const groupCalendarIds = group.calendars.map(c => c.id);
                                                        const selectedCount = groupCalendarIds.filter(id => selectedCalendarIds.includes(id)).length;
                                                        const allSelected = selectedCount === groupCalendarIds.length;
                                                        const someSelected = selectedCount > 0 && !allSelected;
                                                        return (
                                                            <React.Fragment key={group.id}>
                                                                <CommandItem onSelect={() => handleSelectSede(groupCalendarIds, !allSelected)} className="font-medium">
                                                                    <div className="flex items-center">
                                                                        <Checkbox checked={someSelected ? 'indeterminate' : allSelected} className="pointer-events-none" />
                                                                        <span className="ml-2">{group.name}</span>
                                                                    </div>
                                                                </CommandItem>
                                                                {group.calendars.map((calendar) => {
                                                                    const isSelected = selectedCalendarIds.includes(calendar.id);
                                                                    return (
                                                                        <CommandItem key={calendar.id} onSelect={() => handleSelectCalendar(calendar.id, !isSelected)} className="pl-6">
                                                                            <div className="flex items-center justify-between w-full">
                                                                                <div className='flex items-center'>
                                                                                    <Checkbox checked={isSelected} className="pointer-events-none" />
                                                                                    <span className="ml-2">{calendar.name}</span>
                                                                                </div>
                                                                                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: calendar.color }} />
                                                                            </div>
                                                                        </CommandItem>
                                                                    );
                                                                })}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    {calendarSedeGroups.noSede.length > 0 && (
                                                        <>
                                                            {calendarSedeGroups.sedeGroups.length > 0 && <hr className="my-2" />}
                                                            {calendarSedeGroups.noSede.map((calendar) => {
                                                                const isSelected = selectedCalendarIds.includes(calendar.id);
                                                                return (
                                                                    <CommandItem key={calendar.id} onSelect={() => handleSelectCalendar(calendar.id, !isSelected)}>
                                                                        <div className="flex items-center justify-between w-full">
                                                                            <div className='flex items-center'>
                                                                                <Checkbox checked={isSelected} className="pointer-events-none" />
                                                                                <span className="ml-2">{calendar.name}</span>
                                                                            </div>
                                                                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: calendar.color }} />
                                                                        </div>
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {showDoctorFilter && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    {t('doctors')}
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2">
                                                <Command>
                                                    <CommandList>
                                                        <CommandGroup>
                                                            <CommandItem onSelect={() => setSelectedDoctorIds(doctors.map(d => d.id))}>{t('selectAll')}</CommandItem>
                                                            <CommandItem onSelect={() => setSelectedDoctorIds([])}>{t('deselectAll')}</CommandItem>
                                                            <hr className="my-2" />
                                                            {doctors.map((doctor) => {
                                                                const isSelected = selectedDoctorIds.includes(doctor.id);
                                                                return (
                                                                <CommandItem key={doctor.id} onSelect={() => handleSelectDoctor(doctor.id, !isSelected)}>
                                                                    <div className="flex items-center">
                                                                        <Checkbox checked={isSelected} className="pointer-events-none" />
                                                                        <span className="ml-2">{doctor.name}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            );
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                )}
                                {showGroupControls && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="flex items-center gap-2">
                                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                                    {t('grouping.label')}: {groupByLabel}
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2">
                                                <Command>
                                                    <CommandList>
                                                        <CommandGroup>
                                                            <CommandItem onSelect={() => setGroupBy('none')}>
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span>{t('grouping.options.none')}</span>
                                                                    {groupBy === 'none' && <Check className="h-4 w-4" />}
                                                                </div>
                                                            </CommandItem>
                                                            <CommandItem
                                                                onSelect={() => {
                                                                    // Auto-select all doctors so columns are immediately visible
                                                                    if (selectedDoctorIds.length === 0 && doctors.length > 0) {
                                                                        setSelectedDoctorIds(doctors.map(d => d.id));
                                                                    }
                                                                    setGroupBy('doctor');
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span>{t('grouping.options.doctor')}</span>
                                                                    {groupBy === 'doctor' && <Check className="h-4 w-4" />}
                                                                </div>
                                                            </CommandItem>
                                                            <CommandItem
                                                                onSelect={() => {
                                                                    if (calendarGroupingColumns.length > 0) {
                                                                        setGroupBy('calendar');
                                                                    }
                                                                }}
                                                                disabled={calendarGroupingColumns.length === 0}
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span>{t('grouping.options.calendar')}</span>
                                                                    {groupBy === 'calendar' && <Check className="h-4 w-4" />}
                                                                </div>
                                                            </CommandItem>
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                )}
                            </div>
                        )}
                    </div>

                </Calendar>
            </CardContent>

            <BulkReassignDoctorDialog
                open={isReassignDialogOpen}
                onOpenChange={setIsReassignDialogOpen}
                doctors={doctors.filter(d => d.is_active)}
                selectedCount={bulkSelectedIds.size}
                onReassign={handleBulkReassign}
                isLoading={isReassignLoading}
            />

            <CalendarCreateTypeDialog
                open={isCreateTypeOpen}
                onOpenChange={setIsCreateTypeOpen}
                date={pendingSlotDate}
                onCreateAppointment={handleCreateAppointmentFromSlot}
                onCreateReminder={handleCreateReminderFromSlot}
            />
            <AppointmentFormDialog
                open={isCreateOpen}
                onOpenChange={handleOpenChange}
                editingAppointment={editingAppointment}
                mode={isReschedulingMode ? 'reschedule' : (editingAppointment ? 'edit' : 'create')}
                initialData={scheduleNextInitialData ?? slotInitialData ?? undefined}
                onSaveSuccess={handleSaveSuccess}
                calendars={calendars}
                doctors={doctors}
                doctorServiceMap={doctorServiceMap}
                checkCalendarAvailability={checkCalendarAvailability}
                checkDoctorAvailability={checkDoctorAvailability}
            />
            <ReminderFormDialog
                open={isReminderFormOpen}
                onOpenChange={(open) => {
                    setIsReminderFormOpen(open);
                    if (!open) {
                        setEditingReminder(null);
                        setReminderInitialDate(null);
                    }
                }}
                initialDate={reminderInitialDate}
                editingReminder={editingReminder}
                onSave={handleSaveReminder}
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
                    appointmentId={clinicSessionAppointment.id}
                    quoteId={clinicSessionAppointment.quote_id}
                    serviceName={clinicSessionAppointment.services && clinicSessionAppointment.services.length > 0
                        ? clinicSessionAppointment.services.map(s => s.name).join(', ')
                        : clinicSessionAppointment.service_name}
                    defaultDate={clinicSessionAppointment.start?.dateTime
                        ? parseISO(clinicSessionAppointment.start.dateTime.replace(/Z$/, ''))
                        : new Date(clinicSessionAppointment.date)}
                    showAttachments={true}
                    prefillData={{
                        doctor_id: clinicSessionAppointment.doctorId,
                        doctor_name: clinicSessionAppointment.doctorName,
                    }}
                    prefillTreatments={prefillTreatments}
                    existingSession={linkedSession ?? undefined}
                />
            )}

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('createDialog.cancelAppointmentTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('createDialog.cancelAppointmentDescription', { serviceName: deletingAppointment?.service_name, date: deletingAppointment?.date })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDeleteAppointment} className="bg-destructive hover:bg-destructive/90">{t('AppointmentsColumns.cancel')}</AlertDialogAction>
                        <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)}>{t('createDialog.close')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AppointmentPanel
                open={isDetailViewOpen}
                onOpenChange={setIsDetailViewOpen}
                appointment={selectedAppointment}
                linkedSession={linkedSession}
                isLoadingLinkedSession={isLoadingLinkedSession}
                quoteOrder={quoteOrder}
                quoteInvoices={quoteInvoices}
                isLoadingQuoteInfo={isLoadingQuoteInfo}
                doctorColor={selectedAppointment?.doctorId ? (doctors.find(d => d.id === selectedAppointment.doctorId)?.color ?? undefined) : undefined}
                onEdit={handleEdit}
                onCancel={handleCancel}
                onReschedule={handleReschedule}
                onOpenClinicSession={handleOpenClinicSession}
                onStatusChange={handleStatusChange}
                onRequestCustomCancellation={handleRequestCustomCancellation}
                onBillingSuccess={loadAppointments}
            />
            <ReminderPanel
                open={isReminderPanelOpen}
                onOpenChange={setIsReminderPanelOpen}
                reminder={selectedReminder}
                onEdit={handleEditReminder}
                onMarkDone={handleMarkReminderDone}
                onDelete={handleDeleteReminder}
            />
            <CancellationNoteDialog
                open={!!pendingCancellation}
                onOpenChange={(open) => { if (!open) setPendingCancellation(null); }}
                onConfirm={handleConfirmCustomCancellation}
            />
            <QuoteFormDialog
                open={isQuickQuoteOpen}
                onOpenChange={(open) => {
                    setIsQuickQuoteOpen(open);
                    if (!open) { setQuickQuotePatient(null); setQuickQuoteInitialItems(undefined); setPendingQuoteNotifId(undefined); }
                }}
                initialData={{ user: quickQuotePatient }}
                initialItems={quickQuoteInitialItems}
                onSaveSuccess={() => setIsQuickQuoteOpen(false)}
                onQuoteCreated={() => {
                    if (pendingQuoteNotifId) {
                        markSessionAction(pendingQuoteNotifId, 'quote');
                        setPendingQuoteNotifId(undefined);
                    }
                }}
            />
            <InvoiceFormDialog
                isOpen={isInvoiceFormOpen}
                onOpenChange={(open) => {
                    setIsInvoiceFormOpen(open);
                    if (!open) { setInvoicePatient(null); setInvoiceInitialItems(undefined); setPendingInvoiceNotifId(undefined); }
                }}
                onInvoiceCreated={() => {
                    if (pendingInvoiceNotifId) {
                        markSessionAction(pendingInvoiceNotifId, 'invoice');
                        setPendingInvoiceNotifId(undefined);
                    }
                    setIsInvoiceFormOpen(false);
                }}
                isSales={true}
                initialUser={invoicePatient ?? undefined}
                initialItems={invoiceInitialItems}
            />

            {/* Notification panel action deep-link */}
            <React.Suspense fallback={null}>
                <NotificationActDeepLink
                    onQuote={handleNotifQuote}
                    onSchedule={handleNotifSchedule}
                    onInvoice={handleNotifInvoice}
                />
            </React.Suspense>
        </Card>
    );
}
