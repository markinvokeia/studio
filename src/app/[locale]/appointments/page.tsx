
'use client';

import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { CalendarCreateTypeDialog } from '@/components/appointments/CalendarCreateTypeDialog';
import Calendar, { type CalendarGroupBy, type CalendarGroupingColumn, type CalendarView, type CalendarEvent } from '@/components/calendar/Calendar';
import { CalendarSettingsPopover } from '@/components/calendar/calendar-settings-popover';
import { CalendarSettingsForm } from '@/components/calendar/calendar-settings-form';
import { getCalendarSettings } from '@/components/calendar/calendar-settings-utils';
import { CalendarGapsPanel } from '@/components/calendar/calendar-gaps-panel';
import { CalendarAgendasPanel } from '@/components/calendar/calendar-agendas-panel';
import { CalendarViewMenu } from '@/components/calendar/calendar-view-menu';
import { CalendarZoomMenu } from '@/components/calendar/calendar-zoom-menu';
import { computeRangeGaps, computeDayGaps, computeDayGapsForIntervals, getBusinessWindow, getAvailableIntervals, computeBlockedRanges, gapKey, DEFAULT_MIN_GAP_MINUTES, type Gap, type BlockedRange } from '@/components/calendar/calendar-gaps';
import { filterEventsByDayAndGroup } from '@/components/calendar/calendar-utils';
import { DEFAULT_CALENDAR_MODE, DEFAULT_EVENT_LABEL_FORMAT, DEFAULT_SLOT_DURATION, HOUR_SLOT_HEIGHT } from '@/components/calendar/calendar-constants';
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
import { Appointment, AppointmentBulkFilterParams, AppointmentDatePreset, AppointmentStatus, Calendar as CalendarType, CalendarReminder, CalendarSettings, ClinicSchedule, ClinicException, Invoice, Order, PatientSession, Quote, QuoteItem, Sede, Service, SessionPreloadedService, User as UserType } from '@/lib/types';
import { cn, toLocalISOString } from '@/lib/utils';
import api from '@/services/api';
import { getQuoteItems } from '@/services/quotes';
import { updateAppointmentStatusRequest } from '@/services/appointments';
import { getSalesServices, getUsersServicesBatch, fetchServicesByIds } from '@/services/services';
import { ColumnDef } from '@tanstack/react-table';
import { addMinutes, eachDayOfInterval, endOfMonth, endOfWeek, format, isValid, parseISO, set, startOfMonth, startOfWeek } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { BellRing, Building2, Calendar as CalendarIcon, CalendarPlus, CalendarSearch, CalendarSync, Check, ChevronDown, ChevronLeft, ClipboardCheck, Edit, FileText, Layers, Link2, Loader2, PlusCircle, Receipt, RefreshCw, Stethoscope, Trash2, UserCog, Users, X, Zap } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { AppointmentPanel } from '@/components/appointments/AppointmentPanel';
import { BulkReassignDoctorDialog } from '@/components/appointments/BulkReassignDoctorDialog';
import { reassignAppointmentField, type AppointmentReassignChange } from '@/lib/appointment-reassign';
import { ContextEntityPicker } from '@/components/appointments/ContextEntityPicker';
import { InlineAppointmentDraft } from '@/components/calendar/inline-appointment-draft';
import { linkInvoiceToAppointment } from '@/services/billing-links';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { useAccountStatement } from '@/stores/account-statement-store';
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


// Builds a map of doctorId -> calendars the doctor has access to, from the full
// calendar_users association list. Used to limit the calendar picker per doctor.
async function getDoctorCalendarMap(calendars: CalendarType[]): Promise<Map<string, CalendarType[]>> {
    const map = new Map<string, CalendarType[]>();
    try {
        const data = await api.get(API_ROUTES.CALENDAR_USERS_SEARCH);
        const raw = Array.isArray(data) ? data : (data?.calendar_users || data?.data || []);
        const calendarById = new Map(calendars.map(c => [String(c.id), c]));
        for (const item of raw) {
            const userId = String(item.user_id ?? item.id ?? '');
            const calendarId = String(item.calendar_source_id ?? '');
            if (!userId || !calendarId) continue;
            const calendar = calendarById.get(calendarId);
            if (!calendar) continue;
            const existing = map.get(userId) ?? [];
            existing.push(calendar);
            map.set(userId, existing);
        }
    } catch (error) {
        console.error('Failed to fetch calendar users map:', error);
    }
    return map;
}

export default function AppointmentsPage() {
    const breakpoint = useCalendarBreakpoint();
    const isMobile = breakpoint === 'mobile';

    const t = useTranslations('AppointmentsPage');
    const tCalendar = useTranslations('Calendar');
    const tColumns = useTranslations('AppointmentsColumns');
    const tStatus = useTranslations('AppointmentStatus');
    const tStatusMenu = useTranslations('AppointmentStatusMenu');
    const tReschedule = useTranslations('AppointmentReschedule');
    const tGeneral = useTranslations('General');
    const tUserRoles = useTranslations('UserRoles');
    const tToasts = useTranslations('AppointmentsPage.toasts');
    const tOrderStatus = useTranslations('OrderStatus');
    const tReminders = useTranslations('Reminders');
    const tPanel = useTranslations('AppointmentPanel');
    const tInline = useTranslations('AppointmentsPage.inlineCreate');
    const tGaps = useTranslations('Calendar.gaps');
    const locale = useLocale();
    const gapsDateLocale = locale === 'es' ? es : enUS;

    const { refreshNotifications: refreshReminders, markSessionAction } = useNotifications();
    const { user } = useAuth();
    const { open: openBillingWizard } = useBillingWizard();
    const { open: openAccountStatement } = useAccountStatement();

    const { toast } = useToast();

    const [appointments, setAppointments] = React.useState<Appointment[]>([]);
    const [reminders, setReminders] = React.useState<CalendarReminder[]>([]);
    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [sedes, setSedes] = React.useState<Sede[]>([]);
    const [services, setServices] = React.useState<Service[]>([]);
    const [doctors, setDoctors] = React.useState<UserType[]>([]);
    const [doctorServiceMap, setDoctorServiceMap] = React.useState<Map<string, Service[]>>(new Map());
    const [doctorCalendarMap, setDoctorCalendarMap] = React.useState<Map<string, CalendarType[]>>(new Map());
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
    // Soft-delete (status → 'deleted') target for the right-click menu confirmation.
    const [softDeleteTarget, setSoftDeleteTarget] = React.useState<Appointment | null>(null);

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

    // ── "Huecos" — free-slot finder ──────────────────────────────────────────
    const [gapsActive, setGapsActive] = React.useState(false);
    const [selectedGap, setSelectedGap] = React.useState<Gap | null>(null);
    const [clinicSchedules, setClinicSchedules] = React.useState<ClinicSchedule[]>([]);

    // ── Out-of-office blocking (schedules + exceptions), toggled in settings ──
    const [blockUnavailable, setBlockUnavailable] = React.useState(false);
    const [clinicExceptions, setClinicExceptions] = React.useState<ClinicException[]>([]);

    // Authoritative calendar settings (single source of truth). Fed to the
    // settings forms so they don't independently re-fetch and clobber live
    // toggles (e.g. block_unavailable) when they remount on view/layout changes.
    const [calendarSettings, setCalendarSettings] = React.useState<CalendarSettings | null>(null);

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
    const [slotDuration, setSlotDuration] = React.useState<number>(DEFAULT_SLOT_DURATION);
    const [eventLabelFormat, setEventLabelFormat] = React.useState<string>(DEFAULT_EVENT_LABEL_FORMAT);
    const [defaultSede, setDefaultSede] = React.useState<string>('');

    // ── Calendar display mode (invoke | custom) ──────────────────────────────
    // In 'custom' mode a single agenda is shown at a time, chosen from the
    // "Agendas" side panel.
    const [calendarMode, setCalendarMode] = React.useState<string>(DEFAULT_CALENDAR_MODE);
    const [personalizedCalendarId, setPersonalizedCalendarId] = React.useState<string | null>(null);
    const [agendasPanelOpen, setAgendasPanelOpen] = React.useState(false);
    // Zoom is controlled here in custom mode (a dropdown replaces the floating slider).
    // Persisted in the same localStorage key the Calendar uses internally.
    const [calendarZoom, setCalendarZoom] = React.useState<number>(0.9);
    React.useEffect(() => {
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem('calendar-zoom') : null;
        if (saved) {
            const v = parseFloat(saved);
            if (!Number.isNaN(v) && v >= 0.7 && v <= 2.5) setCalendarZoom(v);
        }
    }, []);
    const applyCalendarZoom = React.useCallback((v: number) => {
        const clamped = Math.min(2.5, Math.max(0.7, Math.round(v * 10) / 10));
        setCalendarZoom(clamped);
        try { window.localStorage.setItem('calendar-zoom', String(clamped)); } catch { /* ignore */ }
    }, []);
    // Ctrl/Cmd +/- zoom shortcuts (custom mode, time-grid views only). Ctrl 0 resets.
    React.useEffect(() => {
        if (calendarMode !== 'custom') return;
        const isTimeGrid = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'].includes(currentView);
        if (!isTimeGrid) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                applyCalendarZoom(calendarZoom + 0.1);
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                applyCalendarZoom(calendarZoom - 0.1);
            } else if (e.key === '0') {
                e.preventDefault();
                applyCalendarZoom(1);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [calendarMode, currentView, calendarZoom, applyCalendarZoom]);

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
                setGapsActive(false); // gaps and bulk modes are mutually exclusive
                setSelectedGap(null);
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
        setCalendarSettings(settings);
        const mappedView = SETTINGS_VIEW_MAP[settings.default_view] || 'month';
        setCurrentView(mappedView);
        setGroupBy(settings.grouped_by as CalendarGroupBy);
        setCheckCalendarAvailability(settings.check_availability);
        setCheckDoctorAvailability(settings.filter_doctors_by_service);
        setBlockUnavailable(settings.block_unavailable ?? false);
        setHourSlotHeight(settings.hour_height ?? HOUR_SLOT_HEIGHT);
        setSlotDuration(settings.slot_duration ?? DEFAULT_SLOT_DURATION);
        setEventLabelFormat(settings.event_label_format ?? DEFAULT_EVENT_LABEL_FORMAT);
        setDefaultSede(settings.default_sede ?? '');
        setCalendarMode(settings.mode ?? DEFAULT_CALENDAR_MODE);
    }, []);

    const handleSettingsEditorChange = React.useCallback((settings: CalendarSettings) => {
        setCalendarSettings(settings);
        // The settings popover is now the single source for view and grouping —
        // apply both live so the calendar updates as the user changes them.
        setCurrentView(SETTINGS_VIEW_MAP[settings.default_view] || 'month');
        setInlineDraft(null);
        const nextGroupBy = settings.grouped_by as CalendarGroupBy;
        setGroupBy(nextGroupBy);
        // When switching to doctor grouping with nothing selected, show all doctors
        // so the columns are immediately visible.
        if (nextGroupBy === 'doctor') {
            setSelectedDoctorIds((prev) => (prev.length === 0 ? doctors.map((d) => d.id) : prev));
        }
        setCheckCalendarAvailability(settings.check_availability);
        setCheckDoctorAvailability(settings.filter_doctors_by_service);
        setBlockUnavailable(settings.block_unavailable ?? false);
        setHourSlotHeight(settings.hour_height ?? HOUR_SLOT_HEIGHT);
        setSlotDuration(settings.slot_duration ?? DEFAULT_SLOT_DURATION);
        setEventLabelFormat(settings.event_label_format ?? DEFAULT_EVENT_LABEL_FORMAT);
        setDefaultSede(settings.default_sede ?? '');
        setCalendarMode(settings.mode ?? DEFAULT_CALENDAR_MODE);
    }, [doctors]);

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
    // Tracks which appointments already have a clinic session (for the context-menu label).
    const [sessionExistsMap, setSessionExistsMap] = React.useState<Record<string, boolean>>({});
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

    // Shared slot preparation: stores the slot's initial data (date/time + doctor/calendar
    // from the grouping context) and remembers the clicked date for reminder creation.
    const prepareSlot = React.useCallback((date: Date, context?: { groupBy: 'doctor' | 'calendar' | 'sede'; value: string }) => {
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
    }, [doctors, calendars]);

    // ── In-canvas (inline) appointment creation ─────────────────────────────
    const [inlineDraft, setInlineDraft] = React.useState<{
        date: Date;
        context?: { groupBy: 'doctor' | 'calendar' | 'sede'; value: string };
        durationMin: number;
        patient: UserType | null;
        services: Service[];
        doctor: UserType | null;
        calendar: CalendarType | null;
        notes: string;
        /** Set when the inline card is editing an existing appointment (vs creating). */
        editing?: Appointment | null;
    } | null>(null);
    const [isSavingInline, setIsSavingInline] = React.useState(false);
    const [inlineDebt, setInlineDebt] = React.useState<{ currency: string; amount: number }[]>([]);
    const [inlineCancelledCount, setInlineCancelledCount] = React.useState(0);

    // Load the inline-draft patient's debt + cancelled-appointment count to surface
    // them inline next to the patient.
    React.useEffect(() => {
        const patientId = inlineDraft?.patient?.id;
        if (!patientId) { setInlineDebt([]); setInlineCancelledCount(0); return; }
        let active = true;
        api.get(API_ROUTES.USER_FINANCIAL, { user_id: patientId })
            .then((raw: any) => {
                if (!active) return;
                const fin = Array.isArray(raw) ? raw[0] : raw;
                const byCurrency = fin?.financial_data ?? {};
                setInlineDebt(
                    Object.entries(byCurrency)
                        .map(([currency, d]: [string, any]) => ({ currency, amount: Number(d?.current_debt ?? 0) }))
                        .filter((d) => d.amount > 0),
                );
            })
            .catch(() => { if (active) setInlineDebt([]); });
        api.get(API_ROUTES.USER_CANCELLED_APPOINTMENTS_COUNT, { user_id: patientId })
            .then((raw: any) => {
                if (!active) return;
                const row = Array.isArray(raw) ? raw[0] : raw;
                setInlineCancelledCount(Number(row?.cancelled_count ?? row?.count ?? 0) || 0);
            })
            .catch(() => { if (active) setInlineCancelledCount(0); });
        return () => { active = false; };
    }, [inlineDraft?.patient?.id]);

    const handleSaveInlineDraft = React.useCallback(async () => {
        if (!inlineDraft?.patient) return;
        setIsSavingInline(true);
        try {
            const start = inlineDraft.date;
            const end = addMinutes(start, inlineDraft.durationMin || 30);
            const doctor = inlineDraft.doctor ?? undefined;
            const calendar = inlineDraft.calendar ?? undefined;
            const patient = inlineDraft.patient;
            const svcNames = inlineDraft.services.map((s) => s.name).join(', ');
            // Color precedence: selected service color > doctor color > calendar color.
            const draftColor = inlineDraft.services[inlineDraft.services.length - 1]?.color
                || (doctor as any)?.color || (calendar as any)?.color || undefined;
            const editing = inlineDraft.editing ?? null;
            const payload: any = {
                mode: editing ? 'update' : 'create',
                start: toLocalISOString(start),
                end: toLocalISOString(end),
                doctor_id: doctor?.id || '',
                doctor_name: doctor?.name || '',
                doctor_email: doctor?.email || '',
                patient_id: patient.id,
                patient_name: patient.name,
                patient_email: patient.email || '',
                patient_phone: patient.phone_number || '',
                summary: svcNames ? `${patient.name} - ${svcNames}` : patient.name,
                service_ids: inlineDraft.services.map((s) => s.id),
                service_names: svcNames,
                notes: inlineDraft.notes || '',
                calendar_source_id: calendar?.id ? String(calendar.id) : '',
                color: draftColor,
                quote_id: editing?.quote_id ?? null,
            };
            if (editing) {
                payload.appointment_id = editing.id;
                payload.google_event_id = editing.googleEventId;
                if (editing.calendar_source_id) payload.old_calendar_source_id = editing.calendar_source_id;
            }
            const response = await api.post(API_ROUTES.APPOINTMENTS_UPSERT, payload);
            const result = Array.isArray(response) ? response[0] : response;
            if (result?.error || (result?.code && result.code >= 400)) throw new Error(result?.message || 'Failed to save appointment');
            toast({ title: editing ? tToasts('appointmentUpdated') : tToasts('appointmentCreated') });
            setInlineDraft(null);
            refreshCalendarDataRef.current();
        } catch (error) {
            toast({ variant: 'destructive', title: tToasts('error'), description: error instanceof Error ? error.message : tToasts('unexpectedError') });
        } finally {
            setIsSavingInline(false);
        }
    }, [inlineDraft, doctors, calendars, toast, tToasts]);

    const renderInlineDraft = React.useCallback(() => {
        if (!inlineDraft) return null;
        const draftStart = inlineDraft.date.getTime();
        const draftEnd = addMinutes(inlineDraft.date, inlineDraft.durationMin || 30).getTime();
        // Overlap: a non-cancelled appointment in the same column starting within the draft span.
        const overlap = appointments.some((a) => {
            if (a.status === 'cancelled') return false;
            if (inlineDraft.doctor && String(a.doctorId) !== String(inlineDraft.doctor.id)) return false;
            if (inlineDraft.calendar && String(a.calendar_source_id) !== String(inlineDraft.calendar.id)) return false;
            const s = a.start?.dateTime ? parseISO(a.start.dateTime.replace(/Z$/, '')).getTime() : NaN;
            return !Number.isNaN(s) && s > draftStart && s < draftEnd;
        });
        const isEditing = !!inlineDraft.editing;
        // Color precedence shown on the card: service > doctor > calendar.
        const accentColor = inlineDraft.services[inlineDraft.services.length - 1]?.color
            || (inlineDraft.doctor as any)?.color || (inlineDraft.calendar as any)?.color || undefined;
        return (
            <InlineAppointmentDraft
                date={inlineDraft.date}
                endTime={format(addMinutes(inlineDraft.date, inlineDraft.durationMin || 30), 'HH:mm')}
                durationMin={inlineDraft.durationMin}
                onDurationChange={(min) => setInlineDraft((d) => (d ? { ...d, durationMin: min } : d))}
                onStartTimeChange={(h, m) => setInlineDraft((d) => (d ? { ...d, date: set(d.date, { hours: h, minutes: m, seconds: 0, milliseconds: 0 }) } : d))}
                calendar={inlineDraft.calendar}
                onCalendarChange={(c) => setInlineDraft((d) => (d ? { ...d, calendar: c } : d))}
                calendarOptions={calendars}
                doctor={inlineDraft.doctor}
                onDoctorChange={(doc) => setInlineDraft((d) => (d ? { ...d, doctor: doc } : d))}
                doctorOptions={doctors}
                patient={inlineDraft.patient}
                onPatientChange={(u) => setInlineDraft((d) => (d ? { ...d, patient: u } : d))}
                services={inlineDraft.services}
                onServicesChange={(s) => setInlineDraft((d) => {
                    if (!d) return d;
                    // Selecting a service sets the duration to the service's time
                    // (sum when several); falls back to the current value otherwise.
                    const total = s.reduce((acc, svc) => acc + ((svc as any).duration_minutes || 0), 0);
                    return { ...d, services: s, durationMin: total > 0 ? total : d.durationMin };
                })}
                notes={inlineDraft.notes}
                onNotesChange={(n) => setInlineDraft((d) => (d ? { ...d, notes: n } : d))}
                overlapWarning={overlap}
                patientDebt={inlineDebt}
                cancelledCount={inlineCancelledCount}
                onViewStatement={inlineDraft.patient ? () => openAccountStatement(inlineDraft.patient!.id, inlineDraft.patient!.name) : undefined}
                isSaving={isSavingInline}
                onSave={handleSaveInlineDraft}
                onCancel={() => setInlineDraft(null)}
                accentColor={accentColor}
                title={isEditing ? tInline('editTitle') : undefined}
                saveLabel={isEditing ? tInline('update') : undefined}
            />
        );
    }, [inlineDraft, doctors, calendars, appointments, inlineDebt, inlineCancelledCount, isSavingInline, handleSaveInlineDraft, openAccountStatement, tInline]);

    // Esc closes the inline draft only when it is still empty (untouched) — no
    // patient, no services and no notes — so accidental opens dismiss without
    // losing any data the user has entered.
    React.useEffect(() => {
        if (!inlineDraft) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || isSavingInline) return;
            const isEmpty = !inlineDraft.patient && inlineDraft.services.length === 0 && !inlineDraft.notes.trim();
            if (isEmpty) setInlineDraft(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [inlineDraft, isSavingInline]);

    // Left-click on an empty slot → inline draft (if enabled, desktop, time-grid view)
    // or the modal form. Month/year/schedule always use the modal.
    const handleSlotClick = React.useCallback((date: Date, context?: { groupBy: 'doctor' | 'calendar' | 'sede'; value: string }) => {
        const isTimeGrid = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'].includes(currentView);
        if (calendarSettings?.inline_appointment_creation && isTimeGrid) {
            const draftDoctor = context?.groupBy === 'doctor' ? (doctors.find((d) => String(d.id) === String(context.value)) ?? null) : null;
            const draftCalendar = context?.groupBy === 'calendar' ? (calendars.find((c) => String(c.id) === String(context.value)) ?? null) : null;
            setInlineDraft({ date, context, durationMin: slotDuration, patient: null, services: [], doctor: draftDoctor, calendar: draftCalendar, notes: '' });
            return;
        }
        prepareSlot(date, context);
        setIsReschedulingMode(false);
        setCreateOpen(true);
    }, [prepareSlot, calendarSettings?.inline_appointment_creation, currentView, doctors, calendars, slotDuration]);

    // Edit an existing appointment: inline edit card when the inline-creation
    // preference is on (and on a time-grid view), otherwise the modal form.
    const handleEditAppointment = React.useCallback((appointment: Appointment) => {
        const isTimeGrid = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'].includes(currentView);
        if (calendarSettings?.inline_appointment_creation && isTimeGrid) {
            const startStr = appointment.start?.dateTime;
            const start = startStr ? parseISO(startStr.replace(/Z$/, '')) : new Date();
            const endStr = appointment.end?.dateTime;
            const end = endStr ? parseISO(endStr.replace(/Z$/, '')) : addMinutes(start, 30);
            let durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
            if (!Number.isFinite(durationMin) || durationMin <= 0) durationMin = 30;
            const doctor = doctors.find((d) => String(d.id) === String(appointment.doctorId)) ?? null;
            const calendar = calendars.find((c) => String(c.id) === String(appointment.calendar_source_id)) ?? null;
            const patient = {
                id: appointment.patientId,
                name: appointment.patientName,
                email: appointment.patientEmail,
                phone_number: appointment.patientPhone,
            } as UserType;
            const services: Service[] = Array.isArray(appointment.services)
                ? appointment.services.map((s: any) => ({ id: String(s.id), name: s.name, color: s.color } as Service))
                : [];
            // In custom mode the grid is a single calendar column, so the inline
            // draft must carry the calendar context to render in that column.
            const context = calendarMode === 'custom'
                ? { groupBy: 'calendar' as const, value: String(appointment.calendar_source_id) }
                : groupBy === 'doctor'
                    ? { groupBy: 'doctor' as const, value: String(appointment.doctorId) }
                    : groupBy === 'calendar'
                        ? { groupBy: 'calendar' as const, value: String(appointment.calendar_source_id) }
                        : undefined;
            setInlineDraft({ date: start, context, durationMin, patient, services, doctor, calendar, notes: appointment.notes || '', editing: appointment });
            return;
        }
        setEditingAppointment(appointment);
        setIsReschedulingMode(false);
        setCreateOpen(true);
    }, [calendarSettings?.inline_appointment_creation, currentView, doctors, calendars, groupBy, calendarMode]);

    // Right-click on an empty slot → choose between appointment or reminder.
    const handleSlotContextMenu = React.useCallback((date: Date, context?: { groupBy: 'doctor' | 'calendar' | 'sede'; value: string }) => {
        prepareSlot(date, context);
        setIsCreateTypeOpen(true);
    }, [prepareSlot]);

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


    // Keep grouping in sync with the saved calendar settings whenever the
    // Show/Hide calendar or doctor selection changes. Previously, hiding all
    // calendars/doctors forced groupBy='none' and the grouping was lost when they
    // were shown again; now we re-apply the configured grouping so it persists.
    React.useEffect(() => {
        if (!calendarSettings) return;
        const desired = calendarSettings.grouped_by as CalendarGroupBy;
        setGroupBy((prev) => (prev === desired ? prev : desired));
    }, [selectedDoctorIds, selectedCalendarIds, calendarSettings]);

    const loadLinkedSession = React.useCallback(async (appointment: Appointment, signal?: AbortSignal) => {
        const patientId = appointment.patientId;
        if (!patientId) { setLinkedSession(null); return; }
        setIsLoadingLinkedSession(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: patientId });
            if (signal?.aborted) return;
            const sessions: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
            const match = sessions.find((s: any) => s?.appointment_id?.toString() === appointment.id);
            // Keep the context-menu session label ("Register" vs "Edit") in sync.
            setSessionExistsMap((prev) => ({ ...prev, [appointment.id]: !!match }));
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

    // Keep the panel's quote/invoice section in sync when the selected appointment's
    // quote changes (inline change/associate/create a quote, or quick bill).
    const selectedQuoteId = selectedAppointment?.quote_id;
    React.useEffect(() => {
        if (!isDetailViewOpen) return;
        if (selectedQuoteId) {
            loadQuoteInfo(selectedQuoteId);
        } else {
            setQuoteOrder(null);
            setQuoteInvoices([]);
        }
    }, [selectedQuoteId, isDetailViewOpen, loadQuoteInfo]);

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

    // Quick doctor/room reassignment (upsert) from the calendar context menu or
    // the detail panel — no confirmation step, optimistic UI, then a silent refresh.
    const handleReassign = React.useCallback(async (appointment: Appointment, change: AppointmentReassignChange) => {
        try {
            const updated = await reassignAppointmentField(appointment, change);
            setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
            setSelectedAppointment((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
            toast({
                title: change.doctor ? tToasts('doctorReassigned') : tToasts('calendarReassigned'),
            });
            refreshCalendarDataRef.current();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tToasts('error'),
                description: error instanceof Error ? error.message : tToasts('unexpectedError'),
            });
        }
    }, [toast, tToasts]);

    // ── Context-menu financial / session quick actions ───────────────────────
    // Lazily-loaded data keyed by patient/appointment, populated the first time an
    // appointment's context menu is opened (see requestAppointmentMenuData).
    const [patientQuotesMap, setPatientQuotesMap] = React.useState<Record<string, Quote[]>>({});
    const [patientInvoicesMap, setPatientInvoicesMap] = React.useState<Record<string, Invoice[]>>({});
    const menuDataRequestedRef = React.useRef<Set<string>>(new Set());

    const ensurePatientQuotes = React.useCallback(async (patientId: string) => {
        if (!patientId || patientQuotesMap[patientId]) return;
        try {
            const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: patientId });
            const raw = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);
            const quotes: Quote[] = raw.map((q: any) => ({
                id: String(q.id),
                doc_no: q.doc_no || q.quote_doc_no || '',
                total: Number(q.total || 0),
                currency: q.currency || 'USD',
                status: q.status || 'draft',
                createdAt: q.created_at || q.createdAt || '',
            } as Quote));
            setPatientQuotesMap((prev) => ({ ...prev, [patientId]: quotes }));
        } catch {
            setPatientQuotesMap((prev) => ({ ...prev, [patientId]: [] }));
        }
    }, [patientQuotesMap]);

    const ensurePatientInvoices = React.useCallback(async (patientId: string) => {
        if (!patientId || patientInvoicesMap[patientId]) return;
        try {
            const data = await api.get(API_ROUTES.USER_INVOICES, { user_id: patientId });
            const raw = Array.isArray(data) ? data : (data.invoices || data.data || data.result || []);
            const invoices: Invoice[] = raw.map((inv: any) => ({
                id: String(inv.id),
                invoice_ref: inv.invoice_ref || '',
                doc_no: inv.doc_no || inv.invoice_doc_no || '',
                invoice_doc_no: inv.invoice_doc_no || inv.doc_no || '',
                order_id: String(inv.order_id || ''),
                quote_id: String(inv.quote_id || ''),
                user_id: String(inv.user_id || ''),
                user_name: inv.user_name || '',
                total: Number(inv.total || 0),
                currency: inv.currency || 'USD',
                status: inv.status || 'draft',
                payment_status: inv.payment_state || inv.payment_status || 'unpaid',
                paid_amount: Number(inv.paid_amount || 0),
                type: inv.type || 'invoice',
                createdAt: inv.created_at || inv.createdAt || '',
                updatedAt: inv.updated_at || inv.updatedAt || '',
            } as Invoice));
            setPatientInvoicesMap((prev) => ({ ...prev, [patientId]: invoices }));
        } catch {
            setPatientInvoicesMap((prev) => ({ ...prev, [patientId]: [] }));
        }
    }, [patientInvoicesMap]);

    const ensureSessionInfo = React.useCallback(async (appointment: Appointment) => {
        if (!appointment.patientId || sessionExistsMap[appointment.id] !== undefined) return;
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: appointment.patientId });
            const sessions: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
            // One fetch covers the patient: flag every appointment that already has a session.
            const withSession = new Set(
                sessions
                    .map((s: any) => (s?.appointment_id ?? s?.appointmentId ?? s?.appointmentid)?.toString())
                    .filter(Boolean),
            );
            setSessionExistsMap((prev) => {
                const next = { ...prev };
                withSession.forEach((id) => { next[id as string] = true; });
                if (next[appointment.id] === undefined) next[appointment.id] = false;
                return next;
            });
        } catch {
            /* leave undefined so it can be retried */
        }
    }, [sessionExistsMap]);

    // Called from the context menu render path (only runs when a menu actually opens,
    // since Radix mounts the content lazily). Defers fetches to avoid setState-in-render.
    const requestAppointmentMenuData = React.useCallback((appointment: Appointment) => {
        if (menuDataRequestedRef.current.has(appointment.id)) return;
        menuDataRequestedRef.current.add(appointment.id);
        queueMicrotask(() => {
            ensureSessionInfo(appointment);
            if (appointment.patientId) {
                ensurePatientQuotes(appointment.patientId);
                ensurePatientInvoices(appointment.patientId);
            }
        });
    }, [ensureSessionInfo, ensurePatientQuotes, ensurePatientInvoices]);

    const handleLinkQuote = React.useCallback(async (appointment: Appointment, quote: Quote | null) => {
        try {
            const updated = await reassignAppointmentField(appointment, {
                quote: quote ? { id: quote.id, doc_no: quote.doc_no } : null,
            });
            setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
            setSelectedAppointment((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
            toast({ title: quote ? tToasts('quoteLinked') : tToasts('quoteUnlinked') });
            refreshCalendarDataRef.current();
        } catch (error) {
            toast({ variant: 'destructive', title: tToasts('error'), description: error instanceof Error ? error.message : tToasts('unexpectedError') });
        }
    }, [toast, tToasts]);

    const handleLinkInvoice = React.useCallback(async (appointment: Appointment, invoice: Invoice) => {
        try {
            await linkInvoiceToAppointment(invoice.id, appointment.id);
            setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, invoice_id: invoice.id } : a)));
            setSelectedAppointment((prev) => (prev && prev.id === appointment.id ? { ...prev, invoice_id: invoice.id } : prev));
            toast({ title: tToasts('invoiceLinked') });
            refreshCalendarDataRef.current();
        } catch (error) {
            toast({ variant: 'destructive', title: tToasts('error'), description: error instanceof Error ? error.message : tToasts('unexpectedError') });
        }
    }, [toast, tToasts]);

    // Opens the global Cobro Rápido wizard with whatever the appointment already
    // has (invoice → quote → services), mirroring the detail panel behavior.
    const handleQuickBillFromContext = React.useCallback((appointment: Appointment) => {
        if (!appointment.patientId) return;
        const base = { patientId: appointment.patientId, patientName: appointment.patientName, isSales: true, appointmentId: appointment.id };
        if (appointment.invoice_id) {
            openBillingWizard({ ...base, invoiceId: String(appointment.invoice_id) }, () => refreshCalendarDataRef.current());
        } else if (appointment.quote_id) {
            openBillingWizard({ ...base, quoteId: String(appointment.quote_id) }, () => refreshCalendarDataRef.current());
        } else {
            const preloadedItems = (appointment.services || []).map((svc) => ({
                tempId: svc.id,
                service_id: svc.id,
                service_name: svc.name,
                unit_price: svc.price || 0,
                quantity: 1,
                total: svc.price || 0,
            }));
            openBillingWizard({ ...base, appointmentDate: appointment.date, preloadedItems: preloadedItems.length > 0 ? preloadedItems : undefined }, () => refreshCalendarDataRef.current());
        }
    }, [openBillingWizard]);

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

    // Soft-delete: flips the appointment's status to 'deleted' on the backend
    // (excluded from future fetches) and removes it from the calendar immediately.
    const handleSoftDelete = React.useCallback(async (appointment: Appointment) => {
        try {
            const response = await api.post(API_ROUTES.APPOINTMENTS_UPDATE_STATUS, {
                appointment_id: appointment.id,
                google_event_id: appointment.googleEventId,
                calendar_source_id: appointment.calendar_source_id,
                status: 'deleted',
            });
            const result = Array.isArray(response) ? response[0] : response;
            if (result?.error || (result?.code && result.code >= 400)) {
                throw new Error(result?.message || 'Failed to delete appointment');
            }
            setAppointments((prev) => prev.filter((a) => a.id !== appointment.id));
            setIsDetailViewOpen(false);
            setSelectedAppointment(null);
            toast({ title: tToasts('appointmentDeleted'), description: tToasts('appointmentDeletedDesc') });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tToasts('error'),
                description: error instanceof Error ? error.message : tToasts('failedDelete'),
            });
        }
    }, [toast, tToasts]);

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

            // The appointment now has a session → next context-menu open says "Edit".
            setSessionExistsMap((prev) => ({ ...prev, [clinicSessionAppointment.id]: true }));
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
        // Defensive: exclude soft-deleted appointments (the backend also excludes them).
        setAppointments(fetchedAppointments.filter((a) => (a.status as string) !== 'deleted'));
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

    // Quote/invoice creation dialogs preloaded with the appointment's patient +
    // services; the freshly created document is linked back to the appointment.
    const [quoteLinkTarget, setQuoteLinkTarget] = React.useState<Appointment | null>(null);
    const [invoiceLinkTarget, setInvoiceLinkTarget] = React.useState<Appointment | null>(null);

    const appointmentServiceItems = React.useCallback((appointment: Appointment): SessionPreloadedService[] => (
        (appointment.services || []).map((svc) => ({
            service_id: svc.id,
            service_name: svc.name,
            unit_price: svc.price || 0,
            quantity: 1,
            is_for_next_session: false,
            numero_diente: null,
        }))
    ), []);

    const handleCreateQuoteForAppointment = React.useCallback((appointment: Appointment) => {
        if (!appointment.patientId) return;
        setQuoteLinkTarget(appointment);
        setQuickQuotePatient({ id: appointment.patientId, name: appointment.patientName, email: appointment.patientEmail || '', phone_number: appointment.patientPhone || '', is_active: true, avatar: '' } as UserType);
        setQuickQuoteInitialItems(appointmentServiceItems(appointment));
        setIsQuickQuoteOpen(true);
    }, [appointmentServiceItems]);

    const handleCreateInvoiceForAppointment = React.useCallback((appointment: Appointment) => {
        if (!appointment.patientId) return;
        setInvoiceLinkTarget(appointment);
        setInvoicePatient({ id: appointment.patientId, name: appointment.patientName, email: appointment.patientEmail || '', phone_number: appointment.patientPhone || '', is_active: true, avatar: '' } as UserType);
        setInvoiceInitialItems(appointmentServiceItems(appointment));
        setIsInvoiceFormOpen(true);
    }, [appointmentServiceItems]);

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

        setDoctorCalendarMap(await getDoctorCalendarMap(fetchedCalendars));

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
        setSelectedAppointment(prev => (prev && prev.id === appointment.id ? { ...prev, color: colorHex, colorId: colorId } : prev));

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

    // ── "Huecos"/blocking: clinic schedules. `/schedules` requires `sede_id`, so
    // fetch the availability of every sede and combine.
    React.useEffect(() => {
        if (sedes.length === 0) return;
        let cancelled = false;
        Promise.all(
            sedes.map((sede) =>
                api.get(API_ROUTES.CLINIC_SCHEDULES, { sede_id: String(sede.id) })
                    .then((data) => {
                        const rows = Array.isArray(data) ? data : ((data as { schedules?: unknown[]; data?: unknown[]; result?: unknown[] })?.schedules || (data as { data?: unknown[] })?.data || (data as { result?: unknown[] })?.result || []);
                        return (rows as ClinicSchedule[]).map((s) => ({
                            id: String((s as { id: unknown }).id),
                            day_of_week: (s as ClinicSchedule).day_of_week,
                            start_time: (s as ClinicSchedule).start_time,
                            end_time: (s as ClinicSchedule).end_time,
                            sede_id: (s as ClinicSchedule).sede_id ? String((s as ClinicSchedule).sede_id) : String(sede.id),
                        }));
                    })
                    .catch(() => [] as ClinicSchedule[]),
            ),
        ).then((all) => { if (!cancelled) setClinicSchedules(all.flat()); });
        return () => { cancelled = true; };
    }, [sedes]);

    // Clinic exceptions (holidays / one-off openings) for out-of-office blocking.
    React.useEffect(() => {
        api.get(API_ROUTES.EXCEPTIONS)
            .then((data) => {
                const rows = Array.isArray(data) ? data : ((data as { exceptions?: unknown[]; data?: unknown[]; result?: unknown[] })?.exceptions || (data as { data?: unknown[] })?.data || (data as { result?: unknown[] })?.result || []);
                setClinicExceptions((rows as Record<string, unknown>[]).map((e) => ({
                    id: String(e.id ?? ''),
                    date: String(e.date ?? ''),
                    is_open: e.is_open as boolean,
                    start_time: (e.start_time as string) ?? '',
                    end_time: (e.end_time as string) ?? '',
                    // Notes can come under a few key names depending on the flow.
                    notes: String(e.notes ?? e.note ?? e.nota ?? e.notas ?? e.description ?? e.descripcion ?? e.motivo ?? ''),
                })));
            })
            .catch(() => setClinicExceptions([]));
    }, []);

    // Schedules scoped to the selected sede (matching sede + rows with no sede).
    const effectiveSchedules = React.useMemo(() => {
        if (!defaultSede) return clinicSchedules;
        const scoped = clinicSchedules.filter((s) => !s.sede_id || String(s.sede_id) === String(defaultSede));
        // Don't over-filter: if the sede filter removes everything, fall back to all
        // schedules so the calendar isn't accidentally blocked end-to-end.
        return scoped.length > 0 ? scoped : clinicSchedules;
    }, [clinicSchedules, defaultSede]);

    // Visible days for the blocking overlay (independent of the Huecos toggle).
    const blockVisibleDays = React.useMemo(() => {
        if (!blockUnavailable || !fetchRange?.start || !fetchRange?.end) return [];
        try {
            return eachDayOfInterval({ start: fetchRange.start, end: fetchRange.end });
        } catch {
            return [];
        }
    }, [blockUnavailable, fetchRange]);

    // Safeguard: blocking requires configured schedules (they define the working
    // hours). Exceptions only refine them. Without schedules we can't know the
    // hours, so nothing is blocked (avoids locking the whole calendar).
    const blockingConfigured = effectiveSchedules.length > 0;

    const blockedRanges = React.useMemo<BlockedRange[]>(() => {
        if (!blockUnavailable || !blockingConfigured) return [];
        const isGroupingView = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'].includes(currentView);
        const tagDay = (day: Date, sched: ClinicSchedule[], groupValue?: string): BlockedRange[] =>
            computeBlockedRanges(day, sched, clinicExceptions)
                .map((r) => ({ dayKey: format(day, 'yyyy-MM-dd'), startMin: r.startMin, endMin: r.endMin, groupValue, reason: r.reason, note: r.note }));

        // Grouped by consultorio: each column blocks per its calendar's SEDE schedules.
        if (isGroupingView && groupBy === 'calendar') {
            return calendars.flatMap((cal) => {
                const sedeId = cal.sede_id;
                const sched = sedeId
                    ? clinicSchedules.filter((s) => !s.sede_id || String(s.sede_id) === String(sedeId))
                    : effectiveSchedules;
                return blockVisibleDays.flatMap((day) => tagDay(day, sched, String(cal.id)));
            });
        }
        // Grouped by doctor: clinic-wide hours, tagged per column so each shows them.
        if (isGroupingView && groupBy === 'doctor') {
            return doctors.flatMap((doc) =>
                blockVisibleDays.flatMap((day) => tagDay(day, effectiveSchedules, String(doc.id))),
            );
        }
        // Non-grouped: a single clinic-wide timeline.
        return blockVisibleDays.flatMap((day) => tagDay(day, effectiveSchedules, undefined));
    }, [blockUnavailable, blockingConfigured, currentView, groupBy, blockVisibleDays, effectiveSchedules, clinicSchedules, clinicExceptions, calendars, doctors]);

    const blockedFullDays = React.useMemo<Set<string>>(() => {
        if (!blockUnavailable || !blockingConfigured) return new Set();
        const set = new Set<string>();
        for (const day of blockVisibleDays) {
            if (getAvailableIntervals(day, effectiveSchedules, clinicExceptions).length === 0) {
                set.add(format(day, 'yyyy-MM-dd'));
            }
        }
        return set;
    }, [blockUnavailable, blockingConfigured, blockVisibleDays, effectiveSchedules, clinicExceptions]);

    const gapVisibleDays = React.useMemo(() => {
        if (!gapsActive || !fetchRange?.start || !fetchRange?.end) return [];
        try {
            return eachDayOfInterval({ start: fetchRange.start, end: fetchRange.end });
        } catch {
            return [];
        }
    }, [gapsActive, fetchRange]);

    const handleToggleGaps = React.useCallback(() => {
        setGapsActive((prev) => {
            const next = !prev;
            if (next) setIsBulkMode(false); // gaps and bulk modes are mutually exclusive
            if (!next) setSelectedGap(null);
            return next;
        });
    }, []);

    const handleCloseGaps = React.useCallback(() => {
        setGapsActive(false);
        setSelectedGap(null);
    }, []);

    const handleSelectGap = React.useCallback((gap: Gap) => {
        const context = (gap.groupValue && groupBy !== 'none')
            ? { groupBy: groupBy as 'doctor' | 'calendar' | 'sede', value: gap.groupValue }
            : undefined;

        // When inline creation is on (and on a time-grid view), draft the appointment
        // in-place on the calendar instead of opening the modal — same as a slot click.
        const isTimeGrid = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'].includes(currentView);
        if (calendarSettings?.inline_appointment_creation && isTimeGrid) {
            const draftDoctor = context?.groupBy === 'doctor' ? (doctors.find((d) => String(d.id) === String(context.value)) ?? null) : null;
            const draftCalendar = context?.groupBy === 'calendar' ? (calendars.find((c) => String(c.id) === String(context.value)) ?? null) : null;
            setInlineDraft({ date: gap.start, context, durationMin: slotDuration, patient: null, services: [], doctor: draftDoctor, calendar: draftCalendar, notes: '' });
            setGapsActive(false);
            setSelectedGap(null);
            return;
        }

        setEditingAppointment(null);
        setIsReschedulingMode(false);
        const base: {
            date: string;
            time: string;
            doctor?: UserType | null;
            calendar?: CalendarType | null;
        } = {
            date: format(gap.start, 'yyyy-MM-dd'),
            time: format(gap.start, 'HH:mm'),
        };
        // Prefill the doctor/consultorio when the gap belongs to a grouped column.
        if (gap.groupValue) {
            if (groupBy === 'doctor') {
                const doctor = doctors.find((d) => String(d.id) === String(gap.groupValue));
                if (doctor) base.doctor = doctor;
            } else if (groupBy === 'calendar') {
                const calendar = calendars.find((c) => String(c.id) === String(gap.groupValue));
                if (calendar) base.calendar = calendar;
            }
        }
        setSlotInitialData(base);
        setPendingSlotDate(gap.start);
        setCreateOpen(true);
        // Per the requirement: selecting a proposal closes the panel and clears the effect.
        setGapsActive(false);
        setSelectedGap(null);
    }, [groupBy, doctors, calendars, calendarSettings?.inline_appointment_creation, currentView, slotDuration]);

    const handleSelectDoctor = React.useCallback((doctorId: string, checked: boolean) => {
        setSelectedDoctorIds(prev => {
            if (checked) {
                return [...prev, doctorId];
            } else {
                return prev.filter(id => id !== doctorId);
            }
        });
    }, []);

    const showGroupControls = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'].includes(currentView);
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

    // Subtitle for the "Mostrar/Ocultar Calendarios" button: "all", "all of a sede",
    // or "X of Y".
    const calendarsSubtitle = React.useMemo(() => {
        const total = calendars.length;
        if (total === 0) return '';
        const selected = selectedCalendarIds.filter((id) => calendars.some((c) => c.id === id));
        const count = selected.length;
        if (count === total) return t('showingAllCalendars');
        const selectedSet = new Set(selected);
        for (const group of calendarSedeGroups.sedeGroups) {
            const gids = group.calendars.map((c) => c.id);
            if (gids.length === count && gids.every((id) => selectedSet.has(id))) {
                return t('showingAllOfSede', { sede: group.name });
            }
        }
        return t('showingCountCalendars', { count, total });
    }, [calendars, selectedCalendarIds, calendarSedeGroups, t]);

    // Subtitle for the "Mostrar/Ocultar Doctores" button: "all" or "X of Y".
    const doctorsSubtitle = React.useMemo(() => {
        const total = doctors.length;
        if (total === 0) return '';
        const count = selectedDoctorIds.filter((id) => doctors.some((d) => d.id === id)).length;
        if (count === total) return t('showingAllDoctors');
        return t('showingCountDoctors', { count, total });
    }, [doctors, selectedDoctorIds, t]);

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

    // ── Custom mode: show a single agenda at a time ──────────────────────────
    const isCustomMode = calendarMode === 'custom';
    const firstVisibleCalendarId = React.useMemo(
        () => calendars.find((c) => selectedCalendarIds.includes(c.id))?.id ?? null,
        [calendars, selectedCalendarIds],
    );
    // Keep the shown agenda valid: default to the first visible one, and fall
    // back to it if the current selection gets hidden.
    React.useEffect(() => {
        if (!isCustomMode) return;
        setPersonalizedCalendarId((prev) =>
            prev && selectedCalendarIds.includes(prev) ? prev : firstVisibleCalendarId,
        );
    }, [isCustomMode, selectedCalendarIds, firstVisibleCalendarId]);
    // On entering custom mode, open the Agendas panel first so the user picks an
    // agenda before seeing its appointments; closing it on leaving the mode.
    React.useEffect(() => {
        setAgendasPanelOpen(isCustomMode);
    }, [isCustomMode]);

    // In custom mode force calendar grouping with a single column, and filter
    // events to that one agenda (so month/agenda views also show only it).
    const effectiveGroupBy: CalendarGroupBy = isCustomMode ? 'calendar' : groupBy;
    const effectiveGroupingColumns = React.useMemo<CalendarGroupingColumn[]>(() => {
        if (!isCustomMode) return groupingColumns;
        const cal = calendars.find((c) => c.id === personalizedCalendarId);
        return cal ? [{ id: cal.id, label: cal.name, value: cal.id, color: (cal as any).color ?? undefined }] : [];
    }, [isCustomMode, groupingColumns, calendars, personalizedCalendarId]);
    const effectiveEvents = React.useMemo<CalendarEvent[]>(() => {
        if (!isCustomMode || !personalizedCalendarId) return calendarEvents;
        // Reminders carry no calendarGroupId, so they're excluded in custom mode.
        return calendarEvents.filter((e) => (e as { calendarGroupId?: string }).calendarGroupId === personalizedCalendarId);
    }, [isCustomMode, personalizedCalendarId, calendarEvents]);

    const calendarGaps = React.useMemo<Gap[]>(() => {
        if (!gapsActive) return [];
        // When blocking is on, restrict gaps to the available intervals (split shifts
        // + exceptions); otherwise keep the original single-window behavior.
        const useIntervals = blockUnavailable && blockingConfigured;
        const dayGapsFor = (evts: CalendarEvent[], day: Date): Gap[] =>
            useIntervals
                ? computeDayGapsForIntervals(evts, day, DEFAULT_MIN_GAP_MINUTES, getAvailableIntervals(day, effectiveSchedules, clinicExceptions))
                : computeDayGaps(evts, day, DEFAULT_MIN_GAP_MINUTES, getBusinessWindow(day, clinicSchedules));
        // Grouped (by doctor/consultorio): free slots PER column, so a consultorio's
        // continuous free time merges across hours regardless of other columns.
        // Only the grid views render grouped columns; month/schedule/year use union.
        const isGroupingView = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'].includes(currentView);
        if (isGroupingView && groupBy !== 'none' && groupingColumns.length > 0) {
            return groupingColumns.flatMap((col) =>
                gapVisibleDays.flatMap((day) =>
                    dayGapsFor(filterEventsByDayAndGroup(calendarEvents, day, groupBy, col.value), day)
                        .map((g) => ({ ...g, groupValue: col.value, groupLabel: col.label })),
                ),
            );
        }
        // Non-grouped: a single timeline (union of all visible events).
        if (useIntervals) {
            return gapVisibleDays.flatMap((day) => dayGapsFor(calendarEvents, day));
        }
        return computeRangeGaps(calendarEvents, gapVisibleDays, clinicSchedules);
    }, [gapsActive, blockUnavailable, blockingConfigured, groupBy, groupingColumns, currentView, calendarEvents, gapVisibleDays, clinicSchedules, effectiveSchedules, clinicExceptions]);

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
        // Note: per-appointment session/quote/invoice data is loaded lazily when the
        // menu actually opens (onEventContextMenuOpen), not on every render.
        const patientQuotes = appointment.patientId ? (patientQuotesMap[appointment.patientId] ?? []) : [];
        const patientInvoices = appointment.patientId ? (patientInvoicesMap[appointment.patientId] ?? []) : [];
        const linkedQuote = appointment.quote_id ? patientQuotes.find((q) => String(q.id) === String(appointment.quote_id)) : undefined;
        const linkedInvoice = appointment.invoice_id ? patientInvoices.find((i) => String(i.id) === String(appointment.invoice_id)) : undefined;
        const fmtMoney = (amount: number, currency?: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
        const hasSession = sessionExistsMap[appointment.id];
        return (
            <>
            <ContextMenuSeparator />
            <ContextMenuItem
                key="edit-appointment"
                onSelect={() => handleEditAppointment(appointment)}
                className="flex items-center gap-2 cursor-pointer"
            >
                <Edit className="h-4 w-4 shrink-0" />
                {t('contextMenu.editAppointment')}
            </ContextMenuItem>
            <ContextMenuSub>
                <ContextMenuSubTrigger className="cursor-pointer gap-2">
                    <ClipboardCheck className="h-4 w-4 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                        <span>{tStatusMenu('changeStatus')}</span>
                        <span className="truncate text-xs italic text-muted-foreground">{tStatus(appointment.status)}</span>
                    </span>
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
            <ContextMenuSub>
                <ContextMenuSubTrigger className="cursor-pointer gap-2">
                    <UserCog className="h-4 w-4 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                        <span>{appointment.doctorId ? tPanel('changeDoctor') : tPanel('assignDoctor')}</span>
                        {appointment.doctorId && appointment.doctorName && (
                            <span className="truncate text-xs italic text-muted-foreground">{appointment.doctorName}</span>
                        )}
                    </span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 w-60 overflow-y-auto">
                    {doctors.length === 0 ? (
                        <ContextMenuItem disabled>{tPanel('noDoctorFound')}</ContextMenuItem>
                    ) : (
                        doctors.map((doctor) => (
                            <ContextMenuItem
                                key={doctor.id}
                                onSelect={() => {
                                    if (String(doctor.id) !== String(appointment.doctorId)) {
                                        handleReassign(appointment, { doctor });
                                    }
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Check className={cn('h-4 w-4 shrink-0', String(doctor.id) === String(appointment.doctorId) ? 'opacity-100' : 'opacity-0')} />
                                {doctor.color && (
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: doctor.color }} />
                                )}
                                <span className="min-w-0 flex-1 truncate">{doctor.name}</span>
                            </ContextMenuItem>
                        ))
                    )}
                </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
                <ContextMenuSubTrigger className="cursor-pointer gap-2">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                        <span>{appointment.calendar_source_id ? tPanel('changeCalendar') : tPanel('assignCalendar')}</span>
                        {appointment.calendar_source_id && appointment.calendar_name && (
                            <span className="truncate text-xs italic text-muted-foreground">{appointment.calendar_name}</span>
                        )}
                    </span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 w-60 overflow-y-auto">
                    {calendars.length === 0 ? (
                        <ContextMenuItem disabled>{tPanel('noCalendarFound')}</ContextMenuItem>
                    ) : (
                        calendars.map((calendar) => (
                            <ContextMenuItem
                                key={calendar.id}
                                onSelect={() => {
                                    if (String(calendar.id) !== String(appointment.calendar_source_id)) {
                                        handleReassign(appointment, { calendar });
                                    }
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Check className={cn('h-4 w-4 shrink-0', String(calendar.id) === String(appointment.calendar_source_id) ? 'opacity-100' : 'opacity-0')} />
                                {calendar.color && (
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: calendar.color }} />
                                )}
                                <span className="min-w-0 flex-1 truncate">{calendar.name}</span>
                            </ContextMenuItem>
                        ))
                    )}
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
                {hasSession ? t('contextMenu.editSession') : t('contextMenu.createSession')}
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Quote: link/change */}
            <ContextMenuSub onOpenChange={(o) => { if (o && appointment.patientId) ensurePatientQuotes(appointment.patientId); }}>
                <ContextMenuSubTrigger className="cursor-pointer gap-2">
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                        <span>{appointment.quote_id ? t('contextMenu.changeQuote') : t('contextMenu.linkQuote')}</span>
                        {appointment.quote_id && (
                            <span className="truncate text-xs italic text-muted-foreground">
                                {(linkedQuote?.doc_no || appointment.quote_doc_no || appointment.quote_id)}
                                {linkedQuote ? ` · ${fmtMoney(linkedQuote.total, linkedQuote.currency)}` : ''}
                            </span>
                        )}
                    </span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="p-0">
                    <ContextEntityPicker
                        items={patientQuotes.map((quote) => ({
                            id: String(quote.id),
                            title: quote.doc_no || String(quote.id),
                            subtitle: fmtMoney(quote.total, quote.currency),
                        }))}
                        selectedId={appointment.quote_id}
                        onSelect={(id) => { const quote = patientQuotes.find((q) => String(q.id) === id); if (quote && String(id) !== String(appointment.quote_id)) handleLinkQuote(appointment, quote); }}
                        onCreateNew={() => handleCreateQuoteForAppointment(appointment)}
                        createLabel={t('contextMenu.newQuote')}
                        searchPlaceholder={t('contextMenu.searchQuote')}
                        emptyText={t('contextMenu.noQuotes')}
                    />
                </ContextMenuSubContent>
            </ContextMenuSub>

            {/* Invoice: bill/change */}
            <ContextMenuSub onOpenChange={(o) => { if (o && appointment.patientId) ensurePatientInvoices(appointment.patientId); }}>
                <ContextMenuSubTrigger className="cursor-pointer gap-2">
                    <Receipt className="h-4 w-4 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                        <span>{appointment.invoice_id ? t('contextMenu.changeInvoice') : t('contextMenu.createInvoice')}</span>
                        {appointment.invoice_id && (
                            <span className="truncate text-xs italic text-muted-foreground">
                                {(linkedInvoice?.doc_no || linkedInvoice?.invoice_doc_no || appointment.invoice_id)}
                                {linkedInvoice ? ` · ${fmtMoney(linkedInvoice.total, linkedInvoice.currency)}` : ''}
                            </span>
                        )}
                    </span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="p-0">
                    <ContextEntityPicker
                        items={patientInvoices.map((invoice) => ({
                            id: String(invoice.id),
                            title: invoice.doc_no || invoice.invoice_doc_no || String(invoice.id),
                            subtitle: fmtMoney(invoice.total, invoice.currency),
                        }))}
                        selectedId={appointment.invoice_id}
                        onSelect={(id) => { const invoice = patientInvoices.find((i) => String(i.id) === id); if (invoice && String(id) !== String(appointment.invoice_id)) handleLinkInvoice(appointment, invoice); }}
                        onCreateNew={() => handleCreateInvoiceForAppointment(appointment)}
                        createLabel={t('contextMenu.newInvoice')}
                        searchPlaceholder={t('contextMenu.searchInvoice')}
                        emptyText={t('contextMenu.noInvoices')}
                    />
                </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuItem
                key="quick-bill"
                onSelect={() => handleQuickBillFromContext(appointment)}
                className="flex items-center gap-2 cursor-pointer font-medium text-emerald-600 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
            >
                <Zap className="h-4 w-4" />
                {t('contextMenu.quickBill')}
            </ContextMenuItem>

            <ContextMenuSeparator />
            <ContextMenuItem
                key="delete"
                onClick={(e) => {
                    e.stopPropagation();
                    setSoftDeleteTarget(appointment);
                }}
                className="flex items-center gap-2 cursor-pointer text-destructive"
            >
                <Trash2 className="h-4 w-4" />
                {tPanel('delete')}
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
            <CardContent className="relative p-0 h-[calc(100vh-6rem)] min-h-[600px]">
                {!calendarSettings ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                  <>
                {gapsActive && (
                    <CalendarGapsPanel
                        gaps={calendarGaps}
                        selectedGapKey={selectedGap ? gapKey(selectedGap) : undefined}
                        dateLocale={gapsDateLocale}
                        onSelect={handleSelectGap}
                        onClose={handleCloseGaps}
                    />
                )}
                {isCustomMode && agendasPanelOpen && (
                    <CalendarAgendasPanel
                        sedeGroups={calendarSedeGroups.sedeGroups}
                        noSede={calendarSedeGroups.noSede}
                        visibleIds={selectedCalendarIds}
                        selectedId={personalizedCalendarId}
                        onSelect={(id) => { setPersonalizedCalendarId(id); setAgendasPanelOpen(false); }}
                        onClose={() => setAgendasPanelOpen(false)}
                    />
                )}
                <Calendar
                    view={currentView}
                    hourSlotHeight={hourSlotHeight}
                    slotMinutes={slotDuration}
                    events={effectiveEvents}
                    onDateChange={onDateChange}
                    isLoading={isRefreshing}
                    onEventClick={handleEventClick}
                    onEventColorChange={handleEventColorChange}
                    onEventDoubleClick={isBulkMode ? undefined : (data) => { if (data?.kind !== 'reminder') handleEditAppointment(data as Appointment); }}
                    onEventContextMenu={isBulkMode ? undefined : renderEventContextMenu}
                    onEventContextMenuOpen={isBulkMode ? undefined : (data) => { if (data?.kind !== 'reminder') requestAppointmentMenuData(data as Appointment); }}
                    inlineDraft={inlineDraft ? { date: inlineDraft.date, durationMin: inlineDraft.durationMin, groupValue: inlineDraft.context?.value } : null}
                    renderInlineDraft={renderInlineDraft}
                    groupBy={effectiveGroupBy}
                    groupingColumns={effectiveGroupingColumns}
                    hideTitle={isCustomMode}
                    arrowsBeforeToday={isCustomMode}
                    hideTimeGutter={isCustomMode}
                    zoom={isCustomMode ? calendarZoom : undefined}
                    onZoomChange={applyCalendarZoom}
                    showZoomSlider={!isCustomMode}
                    leadingActions={isCustomMode && !agendasPanelOpen ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-11 gap-1.5"
                            onClick={() => setAgendasPanelOpen(true)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            {tCalendar('back')}
                        </Button>
                    ) : undefined}
                    onViewChange={(v) => { setCurrentView(v); setInlineDraft(null); }}
                    selectedAppointmentIds={isBulkMode ? bulkSelectedIds : undefined}
                    onToggleAppointmentSelect={isBulkMode ? handleToggleAppointmentSelect : undefined}
                    bulkModeContent={bulkModeHeaderContent}
                    onSlotClick={handleSlotClick}
                    onCreateClick={() => { setInlineDraft(null); prepareSlot(new Date()); setIsReschedulingMode(false); setCreateOpen(true); }}
                    onSlotContextMenu={handleSlotContextMenu}
                    gaps={gapsActive ? calendarGaps : undefined}
                    selectedGapKey={selectedGap ? gapKey(selectedGap) : undefined}
                    onGapClick={handleSelectGap}
                    blockedRanges={blockedRanges}
                    blockedFullDays={blockedFullDays}
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
                            {!isCustomMode && (
                            <>
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
                            </>
                            )}

                            {/* Doctors section */}
                            {showDoctorFilter && !isCustomMode && (
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
                                <CalendarSettingsForm onSettingsChange={handleSettingsEditorChange} showTitle={true} sedes={sedes} value={calendarSettings ?? undefined} />
                            </div>
                        </div>
                    }
                    extraActions={
                        <TooltipProvider>
                            <div className="flex flex-wrap items-center gap-1.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={gapsActive ? 'default' : 'outline'}
                                        size={isMobile ? 'icon' : 'sm'}
                                        className={isMobile ? 'h-8 w-8' : 'h-11 gap-1.5'}
                                        onClick={handleToggleGaps}
                                    >
                                        <CalendarSearch className="h-4 w-4 shrink-0" />
                                        {!isMobile && (
                                            <span className="flex flex-col items-start leading-tight">
                                                <span>{tGaps('button')}</span>
                                                <span className="text-[10px] font-normal opacity-70">{tGaps('buttonSubtitle')}</span>
                                            </span>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{tGaps('button')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={isBulkMode ? 'default' : 'outline'}
                                        size={isMobile ? 'icon' : 'sm'}
                                        className={isMobile ? 'h-8 w-8' : 'h-11 gap-1.5'}
                                        onClick={handleToggleBulkMode}
                                    >
                                        <Layers className="h-4 w-4 shrink-0" />
                                        {!isMobile && (
                                            <span className="flex flex-col items-start leading-tight">
                                                <span>{tBulk('toggleButton')}</span>
                                                <span className="text-[10px] font-normal opacity-70">{tBulk('toggleSubtitle')}</span>
                                            </span>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{tBulk('toggleButton')}</TooltipContent>
                            </Tooltip>
                            </div>
                        </TooltipProvider>
                    }
                    primaryActions={
                        <>
                        <DropdownMenu>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant={isMobile ? "ghost" : "default"}
                                                size={isMobile ? "icon" : "sm"}
                                                className={isMobile ? "h-8 w-8" : "h-11 gap-1.5"}
                                            >
                                                <PlusCircle className="h-4 w-4 shrink-0" />
                                                {!isMobile && (
                                                    <>
                                                        <span className="flex flex-col items-start leading-tight">
                                                            <span>{tGeneral('create')}</span>
                                                            <span className="text-[10px] font-normal opacity-80">{t('createSubtitle')}</span>
                                                        </span>
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
                            </TooltipProvider>
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
                        {isCustomMode && !isMobile && (
                            <>
                                <CalendarViewMenu
                                    view={currentView}
                                    onViewChange={(v) => { setCurrentView(v); setInlineDraft(null); }}
                                    sedeGroups={calendarSedeGroups.sedeGroups}
                                    noSede={calendarSedeGroups.noSede}
                                    selectedCalendarIds={selectedCalendarIds}
                                    onToggleCalendar={handleSelectCalendar}
                                />
                                <CalendarZoomMenu zoom={calendarZoom} onZoomChange={applyCalendarZoom} />
                            </>
                        )}
                        </>
                    }
                    extraActionsAfterToday={
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={forceRefresh} variant="ghost" size="icon" disabled={isRefreshing} className={isMobile ? "h-8 w-8" : "h-11 w-11"}>
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
                        !isMobile ? (
                            <CalendarSettingsPopover onSettingsChange={handleSettingsEditorChange} sedes={sedes} value={calendarSettings ?? undefined} />
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
                            <div className="flex flex-wrap items-center gap-2">
                                {!isCustomMode && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="flex h-11 items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="flex flex-col items-start leading-tight">
                                                <span>{t('toggleCalendars')}</span>
                                                {calendarsSubtitle && (
                                                    <span className="text-[10px] font-normal text-muted-foreground">{calendarsSubtitle}</span>
                                                )}
                                            </span>
                                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                                )}
                                {showDoctorFilter && !isCustomMode && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="flex h-11 items-center gap-2">
                                                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="flex flex-col items-start leading-tight">
                                                        <span>{t('toggleDoctors')}</span>
                                                        {doctorsSubtitle && (
                                                            <span className="text-[10px] font-normal text-muted-foreground">{doctorsSubtitle}</span>
                                                        )}
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                            </div>
                        )}
                    </div>

                </Calendar>
                  </>
                )}
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
                doctorCalendarMap={doctorCalendarMap}
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

            {/* Soft-delete confirmation for the right-click menu (same as the detail panel button) */}
            <AlertDialog open={!!softDeleteTarget} onOpenChange={(v) => !v && setSoftDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{tPanel('deleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{tPanel('deleteDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tPanel('deleteCancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                const target = softDeleteTarget;
                                setSoftDeleteTarget(null);
                                if (target) handleSoftDelete(target);
                            }}
                        >
                            {tPanel('deleteConfirm')}
                        </AlertDialogAction>
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
                onEdit={handleEditAppointment}
                onColorChange={handleEventColorChange}
                onCreateQuote={handleCreateQuoteForAppointment}
                onDelete={handleSoftDelete}
                onCancel={handleCancel}
                onReschedule={handleReschedule}
                onOpenClinicSession={handleOpenClinicSession}
                onStatusChange={handleStatusChange}
                onRequestCustomCancellation={handleRequestCustomCancellation}
                onBillingSuccess={() => { loadAppointments(); if (selectedAppointment?.quote_id) loadQuoteInfo(selectedAppointment.quote_id); }}
                doctors={doctors}
                calendars={calendars}
                onAppointmentUpdated={(updated) => {
                    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
                    setSelectedAppointment((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
                    refreshCalendarDataRef.current();
                }}
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
                    if (!open) { setQuickQuotePatient(null); setQuickQuoteInitialItems(undefined); setPendingQuoteNotifId(undefined); setQuoteLinkTarget(null); }
                }}
                initialData={{ user: quickQuotePatient }}
                initialItems={quickQuoteInitialItems}
                onSaveSuccess={() => setIsQuickQuoteOpen(false)}
                onQuoteCreated={(quote) => {
                    if (pendingQuoteNotifId) {
                        markSessionAction(pendingQuoteNotifId, 'quote');
                        setPendingQuoteNotifId(undefined);
                    }
                    // Link the freshly created quote to the originating appointment.
                    if (quoteLinkTarget && quote?.id) {
                        handleLinkQuote(quoteLinkTarget, quote);
                        setQuoteLinkTarget(null);
                    }
                }}
            />
            <InvoiceFormDialog
                isOpen={isInvoiceFormOpen}
                onOpenChange={(open) => {
                    setIsInvoiceFormOpen(open);
                    if (!open) { setInvoicePatient(null); setInvoiceInitialItems(undefined); setPendingInvoiceNotifId(undefined); setInvoiceLinkTarget(null); }
                }}
                onInvoiceCreated={(invoiceId) => {
                    if (pendingInvoiceNotifId) {
                        markSessionAction(pendingInvoiceNotifId, 'invoice');
                        setPendingInvoiceNotifId(undefined);
                    }
                    // Link the freshly created invoice to the originating appointment.
                    if (invoiceLinkTarget && invoiceId) {
                        linkInvoiceToAppointment(invoiceId, invoiceLinkTarget.id).then(() => {
                            setAppointments((prev) => prev.map((a) => (a.id === invoiceLinkTarget.id ? { ...a, invoice_id: invoiceId } : a)));
                            refreshCalendarDataRef.current();
                        });
                        setInvoiceLinkTarget(null);
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
