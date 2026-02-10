
'use client';

import * as React from 'react';
import { addMinutes, format, parse, parseISO, isWithinInterval, isValid, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Appointment, Calendar as CalendarType, User as UserType, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, RefreshCw, ChevronsUpDown, Check, X, ChevronDown, Edit, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslations } from 'next-intl';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import Calendar from '@/components/calendar/Calendar';
import { cn } from '@/lib/utils';
import { getAppointmentColumns } from './columns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';


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
            const appointmentDateTimeStr = apiAppt.start_time || (apiAppt.start && apiAppt.start.dateTime);
            if (!appointmentDateTimeStr) return null;

            const appointmentDateTime = parseISO(appointmentDateTimeStr);
            if (isNaN(appointmentDateTime.getTime())) return null;

            const calendarId = apiAppt.organizer?.email;
            const calendar = calendars.find(c => c.google_calendar_id === calendarId);

            const appointmentColorId = apiAppt.colorId;
            const service = services.find(s => s.name === apiAppt.summary);
            const doctor = doctors.find(d => d.email === apiAppt.doctorEmail);

            let finalColor = colorMap.get(appointmentColorId) || service?.color || doctor?.color || calendar?.color;

            return {
                id: apiAppt.id,
                patientName: apiAppt.patientName || (apiAppt.attendees && apiAppt.attendees.length > 0 ? apiAppt.attendees.map((a: any) => a.email).join(', ') : 'N/A'),
                patientEmail: apiAppt.patientEmail,
                doctorEmail: apiAppt.doctorEmail,
                service_name: apiAppt.summary || t('createDialog.none'),
                description: apiAppt.description || '',
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'HH:mm'),
                status: apiAppt.status || 'confirmed',
                patientPhone: apiAppt.patientPhone,
                doctorName: apiAppt.doctorName,
                calendar_id: calendarId,
                calendar_name: apiAppt.organizer?.displayName,
                color: finalColor,
                colorId: appointmentColorId,
                start: apiAppt.start,
                end: apiAppt.end,
            } as Appointment;
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
        const data = await api.get(API_ROUTES.SERVICES, { is_sales: 'true' });
        const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);
        return servicesData.map((s: any) => ({ ...s, id: String(s.id) }));
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
        const data = await api.get(API_ROUTES.USER_SERVICES, { user_id: doctorId });
        return Array.isArray(data) ? data : (data.user_services || []);
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

    const [slotInitialData, setSlotInitialData] = React.useState<{ date: string; time: string } | null>(null);

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
        const [fetchedCalendars, fetchedServices, fetchedDoctors] = await Promise.all([getCalendars(), getServices(), getDoctors()]);
        setCalendars(fetchedCalendars);
        setServices(fetchedServices);
        setDoctors(fetchedDoctors);
        setAssignees(fetchedDoctors);

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

        // Persist change to backend
        const payload = {
            eventId: appointment.id,
            calendarId: appointment.calendar_id,
            colorId: colorId
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
            const responseData = await api.delete(API_ROUTES.APPOINTMENTS_DELETE, { eventId: deletingAppointment.id, calendarId: deletingAppointment.calendar_id });
            const result = Array.isArray(responseData) ? responseData[0] : responseData;

            if (result.code === 200 || result.success) {
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
        return appointments.map(appt => {
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
                    id: appt.id,
                    title: appt.service_name,
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
        <Card>
            <CardContent className="p-0 h-[calc(100vh-10rem)]">
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
            />

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('createDialog.cancelAppointmentTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('createDialog.cancelAppointmentDescription', { serviceName: deletingAppointment?.service_name, date: deletingAppointment?.date })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)}>{t('createDialog.close')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteAppointment}>{t('AppointmentsColumns.cancel')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedAppointment?.service_name}</DialogTitle>
                    </DialogHeader>
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
                    <DialogFooter className="justify-between">
                        <Button variant="outline" onClick={() => setIsDetailViewOpen(false)} className="w-24">{t('createDialog.close')}</Button>
                        <div className="flex gap-2">
                            <Button variant="destructive" onClick={() => {
                                if (selectedAppointment) {
                                    handleCancel(selectedAppointment);
                                    setIsDetailViewOpen(false);
                                }
                            }} className="w-28">
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('AppointmentsColumns.cancel')}
                            </Button>
                            <Button onClick={() => {
                                if (selectedAppointment) {
                                    handleEdit(selectedAppointment);
                                    setIsDetailViewOpen(false);
                                }
                            }} className="w-24">
                                <Edit className="mr-2 h-4 w-4" />
                                {tColumns('edit')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

