
'use client';

import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import Calendar from '@/components/calendar/Calendar';
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
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Appointment, Calendar as CalendarType, Service, User as UserType } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { getSalesServices, getUserServices } from '@/services/services';
import { ColumnDef } from '@tanstack/react-table';
import { format, isValid, parseISO } from 'date-fns';
import { ChevronDown, Edit, PlusCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
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
    calendarGoogleIds: string[],
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

    const params = new URLSearchParams({
        startingDateAndTime: formatDateForAPI(startDate),
        endingDateAndTime: formatDateForAPI(endDate),
    });

    if (calendarGoogleIds.length > 0) {
        params.append('calendar_ids', calendarGoogleIds.join(','));
    }

    try {
        const query: any = {
            startingDateAndTime: formatDateForAPI(startDate),
            endingDateAndTime: formatDateForAPI(endDate),
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

        return appointmentsData.map((apiAppt: any) => {
            // Handle both structure where start is an object or a direct string
            const startNode = apiAppt.start_time || apiAppt.start;
            const appointmentDateTimeStr = typeof startNode === 'string' ? startNode : (startNode?.dateTime);

            if (!appointmentDateTimeStr) {
                console.warn("Appointment missing start time:", apiAppt);
                return null;
            }

            const appointmentDateTime = parseISO(appointmentDateTimeStr);
            if (isNaN(appointmentDateTime.getTime())) {
                console.error("Invalid appointment date:", appointmentDateTimeStr, apiAppt);
                return null;
            }

            // Normalize fields prioritizing snake_case from backend
            const calendarId = apiAppt.google_calendar_id || apiAppt.calendar_id || apiAppt.calendarId || apiAppt.organizer?.email;
            const calendar = calendars.find(c => c.google_calendar_id === calendarId || c.id === calendarId);

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
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'HH:mm'),
                status: apiAppt.status || 'confirmed',
                created_at: apiAppt.created_at || apiAppt.createdat,
                google_calendar_id: calendarId || '',
                googleEventId: apiAppt.google_event_id || apiAppt.googleEventId || apiAppt.googleeventid || apiAppt.id,
                calendar_id: calendarId || '',
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
                } as Service)) : []
            };

            console.log("Mapped appointment:", appointment);
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

async function getDoctorServices(doctorId: string): Promise<Service[]> {
    try {
        const result = await getUserServices(doctorId);
        return Array.isArray(result) ? result : (result || []);
    } catch (error) {
        console.error(`Failed to fetch services for doctor ${doctorId}:`, error);
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

    const [assignees, setAssignees] = React.useState<UserType[]>([]);
    const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>([]);
    const [group, setGroup] = React.useState(false);
    const [currentView, setCurrentView] = React.useState('month');




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

    const [slotInitialData, setSlotInitialData] = React.useState<{ date: string; time: string; summary?: string } | null>(null);

    const handleSlotClick = React.useCallback((date: Date) => {
        setEditingAppointment(null);
        setSlotInitialData({
            date: format(date, 'yyyy-MM-dd'),
            time: format(date, 'HH:mm'),
        });
        setCreateOpen(true);
    }, []);


    React.useEffect(() => {
        if (selectedAssignees.length === 0) {
            setGroup(false);
        }
    }, [selectedAssignees]);

    const handleEventClick = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setIsDetailViewOpen(true);
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

    const appointmentColumns: ColumnDef<Appointment>[] = React.useMemo(() => getAppointmentColumns({ t: tColumns, tStatus, onEdit: handleEdit, onCancel: handleCancel }), [tColumns, tStatus]);

    const loadAppointments = React.useCallback(async () => {
        if (!fetchRange || !fetchRange.start || !fetchRange.end || !isValid(fetchRange.start) || !isValid(fetchRange.end) || calendars.length === 0) {
            return;
        }

        setIsRefreshing(true);
        const googleCalendarIds = selectedCalendarIds.map(id => {
            const cal = calendars.find(c => c.id === id);
            return cal?.google_calendar_id;
        }).filter((id): id is string => !!id);

        const fetchedAppointments = await getAppointments(googleCalendarIds, fetchRange.start, fetchRange.end, calendars, services, doctors, t);
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
        setAssignees(fetchedDoctors);

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

        const serviceMap = new Map<string, Service[]>();
        for (const doctor of fetchedDoctors) {
            if (doctor.id) {
                const doctorServices = await getDoctorServices(doctor.id);
                serviceMap.set(doctor.id, doctorServices);
            }
        }
        setDoctorServiceMap(serviceMap);

        setSelectedAssignees(fetchedDoctors.map(d => d.id));
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
            google_calendar_id: appointment.google_calendar_id || appointment.calendar_id,
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
                google_calendar_id: deletingAppointment.google_calendar_id || deletingAppointment.calendar_id,
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
                const start = parseISO(appt.start.dateTime);
                const end = parseISO(appt.end.dateTime);

                if (!isValid(start) || !isValid(end)) {
                    console.error("Invalid start/end date for appointment", appt);
                    return null;
                }

                return {
                    id: String(appt.id),
                    title: appt.summary || appt.service_name || 'Cita',
                    start,
                    end,
                    assignee: appt.doctorEmail,
                    data: appt,
                    color: appt.color,
                    colorId: appt.colorId,
                };
            } catch (e) {
                console.error("Error parsing date/time for appointment", appt, e);
                return null;
            }
        }).filter(Boolean) as ({ id: string; title: string; start: Date; end: Date; assignee: string | undefined; data: Appointment; color?: string; colorId?: string })[];

        console.log("Calendar events generated:", events);
        return events;
    }, [appointments]);


    const handleSelectAssignee = React.useCallback((assigneeId: string, checked: boolean) => {
        setSelectedAssignees(prev => {
            if (checked) {
                return [...prev, assigneeId];
            } else {
                return prev.filter(id => id !== assigneeId);
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

    // Unused form logic removed


    React.useEffect(() => {
        setAppointments([]);
    }, [selectedCalendarIds]);

    return (
        <Card className="border-none shadow-none h-full">
            <CardContent className="p-0 h-[calc(100vh-6rem)] min-h-[600px]">
                <Calendar
                    events={calendarEvents}
                    onDateChange={onDateChange}
                    isLoading={isRefreshing}
                    onEventClick={handleEventClick}
                    onEventColorChange={handleEventColorChange}
                    assignees={assignees}
                    selectedAssignees={selectedAssignees}
                    onSelectedAssigneesChange={setSelectedAssignees}
                    group={group}
                    onGroupChange={setGroup}
                    onViewChange={setCurrentView}
                    onSlotClick={handleSlotClick}
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
                                            {t('assignees')}
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2">
                                        <Command>
                                            <CommandList>
                                                <CommandGroup>
                                                    <CommandItem onSelect={() => { if (selectedAssignees.length > 0) setGroup(!group) }} className="flex items-center gap-2">
                                                        <Checkbox id="group-by-assignee" checked={group} onCheckedChange={(checked) => setGroup(typeof checked === 'boolean' ? checked : false)} disabled={selectedAssignees.length === 0} />
                                                        <Label htmlFor="group-by-assignee" className={cn(selectedAssignees.length === 0 && 'text-muted-foreground')}>{t('groupByAssignee')}</Label>
                                                    </CommandItem>
                                                    <hr className="my-2" />
                                                    <CommandItem onSelect={() => setSelectedAssignees(assignees.map(a => a.id))}>{t('selectAll')}</CommandItem>
                                                    <CommandItem onSelect={() => setSelectedAssignees([])}>{t('deselectAll')}</CommandItem>
                                                    <hr className="my-2" />
                                                    {assignees.map((assignee) => (
                                                        <CommandItem key={assignee.id} onSelect={() => handleSelectAssignee(assignee.id, !selectedAssignees.includes(assignee.id))}>
                                                            <div className="flex items-center">
                                                                <Checkbox checked={selectedAssignees.includes(assignee.id)} onCheckedChange={(checked) => handleSelectAssignee(assignee.id, !!checked)} />
                                                                <span className="ml-2">{assignee.name}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
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
            <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedAppointment?.service_name}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="px-6 py-4">
                        {selectedAppointment && (
                            <div className="grid gap-4 py-4">
                                <div className='flex gap-2'><strong>{tColumns('patient')}:</strong> {selectedAppointment.patientName}</div>
                                <div className='flex gap-2'><strong>{tColumns('doctor')}:</strong> {selectedAppointment.doctorName}</div>
                                <div className='flex gap-2'><strong>{tColumns('date')}:</strong> {selectedAppointment.date}</div>
                                <div className='flex gap-2'><strong>{tColumns('time')}:</strong> {selectedAppointment.time}</div>
                                <div className='flex gap-2'><strong>{t('createDialog.endTime')}:</strong> {selectedAppointment.end?.dateTime ? format(parseISO(selectedAppointment.end.dateTime), 'HH:mm') : '-'}</div>
                                <div className='flex gap-2'><strong>{tColumns('calendar')}:</strong> {selectedAppointment.calendar_name}</div>
                                <div className="flex items-center gap-2"><strong>{tColumns('status')}:</strong> <Badge className="capitalize">{tStatus(selectedAppointment.status.toLowerCase())}</Badge></div>
                            </div>
                        )}
                    </DialogBody>
                    <DialogFooter className="justify-between">
                        <Button variant="outline" onClick={() => setIsDetailViewOpen(false)} className="w-24">{t('createDialog.close')}</Button>
                        <div className="flex gap-2">
                            <Button onClick={() => {
                                if (selectedAppointment) {
                                    handleEdit(selectedAppointment);
                                    setIsDetailViewOpen(false);
                                }
                            }} className="w-24">
                                <Edit className="mr-2 h-4 w-4" />
                                {tColumns('edit')}
                            </Button>
                            <Button variant="destructive" onClick={() => {
                                if (selectedAppointment) {
                                    handleCancel(selectedAppointment);
                                    setIsDetailViewOpen(false);
                                }
                            }} className="w-28">
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('AppointmentsColumns.cancel')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
