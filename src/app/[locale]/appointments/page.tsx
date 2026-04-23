
'use client';

import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import Calendar, { type CalendarGroupBy, type CalendarGroupingColumn } from '@/components/calendar/Calendar';
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
    ContextMenuItem,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { usePermissions } from '@/hooks/usePermissions';
import { Appointment, Calendar as CalendarType, Invoice, Order, PatientSession, QuoteItem, Service, User as UserType } from '@/lib/types';
import api from '@/services/api';
import { getQuoteItems } from '@/services/quotes';
import { getSalesServices, getUsersServicesBatch } from '@/services/services';
import { ColumnDef } from '@tanstack/react-table';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Check, ChevronDown, Edit, FileText, Layers, Loader2, PlusCircle, RefreshCw, Stethoscope, Trash2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { AppointmentPanel } from '@/components/appointments/AppointmentPanel';
import { getAppointmentColumns } from './columns';


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

            const doctorId = apiAppt.doctor_id || apiAppt.doctorId || apiAppt.doctorid;
            const doctor = doctors.find(d => String(d.id) === String(doctorId) || (apiAppt.doctor_email && d.email === apiAppt.doctor_email) || (apiAppt.doctorEmail && d.email === apiAppt.doctorEmail) || (apiAppt.doctoremail && d.email === apiAppt.doctoremail));

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

            const patientId = apiAppt.patient_id || apiAppt.patientId || apiAppt.patientid;
            const patientName = apiAppt.patient_name || apiAppt.patientName || apiAppt.patientname || (apiAppt.attendees && apiAppt.attendees.length > 0 ? apiAppt.attendees.map((a: any) => a.email).join(', ') : 'N/A');
            const doctorName = apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || doctor?.name || 'Doctor';

            const endNode = apiAppt.end_time || apiAppt.end;
            const endDateTimeStr = typeof endNode === 'string' ? endNode : (endNode?.dateTime);

            const appointment: Appointment = {
                id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id || ''),
                patientId: String(patientId || ''),
                patientName: patientName,
                patientEmail: apiAppt.patient_email || apiAppt.patientEmail || apiAppt.patientemail,
                patientPhone: apiAppt.patient_phone || apiAppt.patientPhone || apiAppt.patientphone,
                doctorId: String(doctorId || ''),
                doctorName: doctorName,
                doctorEmail: apiAppt.doctor_email || apiAppt.doctorEmail || apiAppt.doctoremail || doctor?.email || '',
                summary: apiAppt.summary || t('createDialog.none'),
                service_name: apiAppt.summary || t('createDialog.none'),
                description: apiAppt.description || '',
                notes: apiAppt.notes || '',
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'HH:mm'),
                status: apiAppt.status || 'confirmed',
                created_at: apiAppt.created_at || apiAppt.createdat,
                google_calendar_id: apiAppt.google_calendar_id || apiAppt.googleCalendarId || undefined,
                googleEventId: apiAppt.google_event_id || apiAppt.googleEventId || apiAppt.googleeventid || apiAppt.id,
                calendar_source_id: calendarSourceId,
                calendar_name: apiAppt.organizer?.displayName || calendar?.name || apiAppt.calendar_name,
                color: finalColor,
                colorId: appointmentColorId,
                start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
                end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
                services: Array.isArray(apiAppt.services) ? apiAppt.services.map((s: any) => ({
                    id: String(s.id),
                    name: s.name || '',
                    price: Number(s.price || 0),
                    category: '',
                    duration_minutes: 30,
                    is_active: true
                } as Service)) : [],
                quote_id: apiAppt.quote_id || apiAppt.quoteId || apiAppt.quoteid || undefined,
                quote_doc_no: apiAppt.quote_doc_no || apiAppt.quoteDocNo || apiAppt.quotedocno || apiAppt.doc_no || apiAppt.docNo || apiAppt.docno || undefined
            };

            return appointment;
        }).filter((apt): apt is Appointment => apt !== null);
    } catch (error) {
        console.error("Failed to fetch appointments:", error);
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
        }));
    } catch (error) {
        console.error("Failed to fetch calendars:", error);
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
    const t = useTranslations('AppointmentsPage');
    const tColumns = useTranslations('AppointmentsColumns');
    const tStatus = useTranslations('AppointmentStatus');
    const tGeneral = useTranslations('General');
    const tUserRoles = useTranslations('UserRoles');
    const tToasts = useTranslations('AppointmentsPage.toasts');
    const tOrderStatus = useTranslations('OrderStatus');

    const { toast } = useToast();

    const [appointments, setAppointments] = React.useState<Appointment[]>([]);
    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [services, setServices] = React.useState<Service[]>([]);
    const [doctors, setDoctors] = React.useState<UserType[]>([]);
    const [doctorServiceMap, setDoctorServiceMap] = React.useState<Map<string, Service[]>>(new Map());
    const [selectedCalendarIds, setSelectedCalendarIds] = React.useState<string[]>([]);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [fetchRange, setFetchRange] = React.useState<{ start: Date; end: Date } | null>(null);
    const [checkCalendarAvailability, setCheckCalendarAvailability] = React.useState(true);
    const [checkDoctorAvailability, setCheckDoctorAvailability] = React.useState(true);

    const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
    const [deletingAppointment, setDeletingAppointment] = React.useState<Appointment | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);

    const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
    const [isDetailViewOpen, setIsDetailViewOpen] = React.useState(false);

    const [selectedDoctorIds, setSelectedDoctorIds] = React.useState<string[]>([]);
    const [groupBy, setGroupBy] = React.useState<CalendarGroupBy>('none');
    const [currentView, setCurrentView] = React.useState('month');

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
    const { hasPermission } = usePermissions();
    const eventClickAbortRef = React.useRef<AbortController | null>(null);






    const handleOpenChange = (open: boolean) => {
        setCreateOpen(open);
        if (!open) {
            setEditingAppointment(null);
        }
    };

    const handleNewAppointmentClick = () => {
        setEditingAppointment(null);
        setCreateOpen(true);
    };

    const [slotInitialData, setSlotInitialData] = React.useState<{
        date: string;
        time: string;
        summary?: string;
        doctor?: UserType | null;
        calendar?: CalendarType | null;
    } | null>(null);

    const handleSlotClick = React.useCallback((date: Date, context?: { groupBy: 'doctor' | 'calendar'; value: string }) => {
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
        setCreateOpen(true);
    }, [doctors, calendars]);


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

    const handleEventClick = (appointment: Appointment) => {
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

    const handleEdit = (appointment: Appointment) => {
        setEditingAppointment(appointment);
        setCreateOpen(true);
    };


    // Simplified handleEdit triggers the dialog


    const handleCancel = (appointment: Appointment) => {
        setDeletingAppointment(appointment);
        setIsDeleteAlertOpen(true);
    };

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

    const appointmentColumns: ColumnDef<Appointment>[] = React.useMemo(() => getAppointmentColumns({ t: tColumns, tStatus, onEdit: handleEdit, onCancel: handleCancel }), [tColumns, tStatus]);

    const loadAppointments = React.useCallback(async () => {
        if (!fetchRange || !fetchRange.start || !fetchRange.end || !isValid(fetchRange.start) || !isValid(fetchRange.end) || calendars.length === 0) {
            return;
        }

        setIsRefreshing(true);
        const fetchedAppointments = await getAppointments(selectedCalendarIds, fetchRange.start, fetchRange.end, calendars, services, doctors, t);
        setAppointments(fetchedAppointments);

        setIsRefreshing(false);
    }, [selectedCalendarIds, fetchRange, calendars, services, doctors]);

    const forceRefresh = React.useCallback(() => {
        loadAppointments();
    }, [loadAppointments]);

    const loadInitialData = React.useCallback(async () => {
        setIsDataLoading(true);
        const [fetchedCalendars, fetchedServices, fetchedDoctors, fetchedConfig] = await Promise.all([
            getCalendars(),
            getServices(),
            getDoctors(),
            api.get(API_ROUTES.SYSTEM.CONFIGS).catch(() => [])
        ]);
        setCalendars(fetchedCalendars);
        setServices(fetchedServices);
        setDoctors(fetchedDoctors);

        if (Array.isArray(fetchedConfig)) {
            const calendarConfig = fetchedConfig.find((c: any) => c.key === 'CHECK_CALENDAR_AVAILABILITY');
            const doctorConfig = fetchedConfig.find((c: any) => c.key === 'CHECK_DOCTOR_AVAILABILITY');

            if (calendarConfig) {
                const val = String(calendarConfig.value).toLowerCase() === 'true';
                console.log(`Config: CHECK_CALENDAR_AVAILABILITY = ${val} (raw value: ${calendarConfig.value})`);
                setCheckCalendarAvailability(val);
            }
            if (doctorConfig) {
                const val = String(doctorConfig.value).toLowerCase() === 'true';
                console.log(`Config: CHECK_DOCTOR_AVAILABILITY = ${val} (raw value: ${doctorConfig.value})`);
                setCheckDoctorAvailability(val);
            }
        }

        const doctorIds = fetchedDoctors.map(d => d.id).filter(Boolean);
        const serviceMap = await getUsersServicesBatch(doctorIds);
        setDoctorServiceMap(serviceMap);

        setSelectedDoctorIds(fetchedDoctors.map(d => d.id));
        setSelectedCalendarIds(fetchedCalendars.map(c => c.id).filter(id => id));
        setIsDataLoading(false);
    }, []);

    // Moved doctor filtering to AppointmentFormDialog



    React.useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    React.useEffect(() => {
        if (!isDataLoading && fetchRange) {
            loadAppointments();
        }
    }, [loadAppointments, selectedCalendarIds, fetchRange, isDataLoading]);


    // Moved searches to AppointmentFormDialog


    // Moved checkAvailability to AppointmentFormDialog



    const handleSaveSuccess = () => {
        forceRefresh();
        setCreateOpen(false);
        setEditingAppointment(null);
    };


    const handleEventColorChange = async (appointment: Appointment, colorId: string) => {
        const colorHex = colorMap.get(colorId);

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
        const events = appointments.map(appt => {
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

                return {
                    id: String(appt.id),
                    title: appt.summary || appt.service_name || 'Cita',
                    start,
                    end,
                    doctorGroupId: appt.doctorId || undefined,
                    calendarGroupId: calendars.find((calendar) => String(calendar.id) === String(appt.calendar_source_id))?.id || appt.calendar_source_id || undefined,
                    data: appt,
                    color: appt.color,
                    colorId: appt.colorId,
                };
            } catch (e) {
                console.error("Error parsing date/time for appointment", appt, e);
                return null;
            }
        }).filter((event): event is NonNullable<typeof event> => event !== null);

        return events;
    }, [appointments, calendars]);


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

    // Render additional context menu items for clinic session
    const renderClinicSessionMenuItem = (appointment: Appointment) => {
        if (!hasPermission('CLINIC_HISTORY_SESSION_CREATE') && !hasPermission('CLINIC_HISTORY_CREATE')) {
            return null;
        }

        return (
            <ContextMenuItem
                key="clinic-session"
                onClick={() => handleOpenClinicSession(appointment)}
                className="flex items-center gap-2 cursor-pointer"
            >
                <Stethoscope className="h-4 w-4" />
                {t('contextMenu.createSession')}
            </ContextMenuItem>
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

    return (
        <Card className="border-none shadow-none h-full">
            <CardContent className="p-0 h-[calc(100vh-6rem)] min-h-[600px]">
                <Calendar
                    events={calendarEvents}
                    onDateChange={onDateChange}
                    isLoading={isRefreshing}
                    onEventClick={handleEventClick}
                    onEventColorChange={handleEventColorChange}
                    onEventContextMenu={renderClinicSessionMenuItem}
                    groupBy={groupBy}
                    groupingColumns={groupingColumns}
                    onViewChange={setCurrentView}
                    onSlotClick={handleSlotClick}
                    filterSheet={
                        <div className="space-y-4">
                            {/* Calendars section */}
                            <div>
                                <h4 className="text-sm font-semibold mb-2">{t('calendars')}</h4>
                                <div className="flex gap-2 mb-2">
                                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedCalendarIds(calendars.map(c => c.id))}>{t('selectAll')}</Button>
                                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedCalendarIds([])}>{t('deselectAll')}</Button>
                                </div>
                                <div className="space-y-1">
                                    {calendars.map((calendar) => (
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
                            {/* Doctors section */}
                            {showGroupControls && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2">{t('doctors')}</h4>
                                        <div className="flex gap-2 mb-2">
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
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2">{t('grouping.label')}</h4>
                                        <div className="space-y-1">
                                            {(['none', 'doctor', 'calendar'] as const).map((option) => (
                                                <button
                                                    key={option}
                                                    className="flex items-center justify-between w-full py-2 px-1 rounded-md hover:bg-muted/50 text-sm"
                                                    disabled={option === 'calendar' && calendarGroupingColumns.length === 0}
                                                    onClick={() => {
                                                        if (option === 'doctor' && selectedDoctorIds.length === 0 && doctors.length > 0) {
                                                            setSelectedDoctorIds(doctors.map(d => d.id));
                                                        }
                                                        if (option === 'calendar' && calendarGroupingColumns.length === 0) return;
                                                        setGroupBy(option);
                                                    }}
                                                >
                                                    <span>{t(`grouping.options.${option}`)}</span>
                                                    {groupBy === option && <Check className="h-4 w-4 text-primary" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    }
                >
                    <div className="flex items-center gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="default" size="sm" className="h-9" onClick={handleNewAppointmentClick}>
                                        <PlusCircle className="h-4 w-4" />
                                        {tGeneral('create')}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{tGeneral('create')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button onClick={forceRefresh} variant="outline" size="icon" disabled={isRefreshing}>
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    {t('calendars')}
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2">
                                <Command>
                                    <CommandList>
                                        <CommandGroup>
                                            <CommandItem onSelect={() => setSelectedCalendarIds(calendars.map(c => c.id))}>{t('selectAll')}</CommandItem>
                                            <CommandItem onSelect={() => setSelectedCalendarIds([])}>{t('deselectAll')}</CommandItem>
                                            <hr className="my-2" />
                                            {calendars.map((calendar) => (
                                                <CommandItem key={calendar.id} onSelect={() => handleSelectCalendar(calendar.id, !selectedCalendarIds.includes(calendar.id))}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className='flex items-center'>
                                                            <Checkbox checked={selectedCalendarIds.includes(calendar.id)} onCheckedChange={(checked) => handleSelectCalendar(calendar.id, !!checked)} />
                                                            <span className="ml-2">{calendar.name}</span>
                                                        </div>
                                                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: calendar.color }} />
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {showGroupControls && (
                            <>
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
                                                    {doctors.map((doctor) => (
                                                        <CommandItem key={doctor.id} onSelect={() => handleSelectDoctor(doctor.id, !selectedDoctorIds.includes(doctor.id))}>
                                                            <div className="flex items-center">
                                                                <Checkbox checked={selectedDoctorIds.includes(doctor.id)} onCheckedChange={(checked) => handleSelectDoctor(doctor.id, !!checked)} />
                                                                <span className="ml-2">{doctor.name}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
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
                            </>
                        )}
                    </div>
                </Calendar>
            </CardContent>
            <AppointmentFormDialog
                open={isCreateOpen}
                onOpenChange={handleOpenChange}
                editingAppointment={editingAppointment}
                initialData={slotInitialData || undefined}
                onSaveSuccess={handleSaveSuccess}
                calendars={calendars}
                doctors={doctors}
                doctorServiceMap={doctorServiceMap}
                checkCalendarAvailability={checkCalendarAvailability}
                checkDoctorAvailability={checkDoctorAvailability}
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
                    appointmentId={clinicSessionAppointment.id}
                    quoteId={clinicSessionAppointment.quote_id}
                    serviceName={clinicSessionAppointment.services && clinicSessionAppointment.services.length > 0
                        ? clinicSessionAppointment.services.map(s => s.name).join(', ')
                        : clinicSessionAppointment.service_name}
                    defaultDate={clinicSessionAppointment.start?.dateTime
                        ? parseISO(clinicSessionAppointment.start.dateTime.replace(/Z$/, ''))
                        : new Date(clinicSessionAppointment.date)}
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
                onOpenClinicSession={handleOpenClinicSession}
            />
        </Card>
    );
}
