'use client';

import * as React from 'react';
import { addMinutes, format, parse, parseISO, isValid } from 'date-fns';
import { Appointment, Calendar as CalendarType, User as UserType, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

interface AppointmentFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingAppointment?: Appointment | null;
    initialData?: {
        user?: UserType | null;
        services?: Service[];
        doctor?: UserType | null;
        date?: string;
        time?: string;
        description?: string;
    };
    onSaveSuccess?: (savedAppointment: any, selectedDate: Date) => void;
    calendars: CalendarType[];
    doctors: UserType[];
    doctorServiceMap: Map<string, Service[]>;
}

export function AppointmentFormDialog({
    open,
    onOpenChange,
    editingAppointment,
    initialData,
    onSaveSuccess,
    calendars,
    doctors: allDoctors,
    doctorServiceMap,
}: AppointmentFormDialogProps) {
    const t = useTranslations('AppointmentsPage');
    const tColumns = useTranslations('AppointmentsColumns');
    const tGeneral = useTranslations('General');
    const tToasts = useTranslations('AppointmentsPage.toasts');
    const { toast } = useToast();

    // Form State
    const [appointment, setAppointment] = React.useState({
        user: null as UserType | null,
        services: [] as Service[],
        doctor: null as UserType | null,
        calendar: null as CalendarType | null,
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        endTime: '',
        description: '',
    });

    const [originalCalendarId, setOriginalCalendarId] = React.useState<string | undefined>(undefined);
    const [availabilityStatus, setAvailabilityStatus] = React.useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
    const [suggestedTimes, setSuggestedTimes] = React.useState<any[]>([]);

    // Search States
    const [isUserSearchOpen, setUserSearchOpen] = React.useState(false);
    const [userSearchQuery, setUserSearchQuery] = React.useState('');
    const [userSearchResults, setUserSearchResults] = React.useState<UserType[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = React.useState(false);

    const [isServiceSearchOpen, setServiceSearchOpen] = React.useState(false);
    const [serviceSearchQuery, setServiceSearchQuery] = React.useState('');
    const [serviceSearchResults, setServiceSearchResults] = React.useState<Service[]>([]);
    const [isSearchingServices, setIsSearchingServices] = React.useState(false);

    const [isDoctorSearchOpen, setDoctorSearchOpen] = React.useState(false);
    const [doctorSearchQuery, setDoctorSearchQuery] = React.useState('');

    const [isCalendarSearchOpen, setCalendarSearchOpen] = React.useState(false);

    // Initialize/Reset form
    React.useEffect(() => {
        if (open) {
            if (editingAppointment) {
                let foundCalendar = calendars.find(c => c.google_calendar_id === editingAppointment.calendar_id);
                if (!foundCalendar) {
                    foundCalendar = calendars.find(c => c.name === editingAppointment.calendar_name);
                }

                setAppointment({
                    user: { id: '', name: editingAppointment.patientName, email: editingAppointment.patientEmail || '', phone_number: editingAppointment.patientPhone || '', is_active: true, avatar: '' },
                    services: [{ id: '', name: editingAppointment.service_name, category: '', price: 0, duration_minutes: 30, is_active: true }],
                    doctor: editingAppointment.doctorEmail ? { id: '', name: editingAppointment.doctorName || '', email: editingAppointment.doctorEmail, phone_number: '', is_active: true, avatar: '' } : null,
                    calendar: foundCalendar || null,
                    date: editingAppointment.date,
                    time: editingAppointment.time,
                    endTime: editingAppointment.end ? format(parseISO(editingAppointment.end.dateTime), 'HH:mm') : '',
                    description: editingAppointment.description || '',
                });
                setOriginalCalendarId(editingAppointment.calendar_id);
            } else if (initialData) {
                setAppointment({
                    user: initialData.user || null,
                    services: initialData.services || [],
                    doctor: initialData.doctor || null,
                    calendar: null,
                    date: initialData.date || format(new Date(), 'yyyy-MM-dd'),
                    time: initialData.time || format(new Date(), 'HH:mm'),
                    endTime: '',
                    description: initialData.description || '',
                });
                setOriginalCalendarId(undefined);
            } else {
                setAppointment({
                    user: null,
                    services: [],
                    doctor: null,
                    calendar: null,
                    date: format(new Date(), 'yyyy-MM-dd'),
                    time: format(new Date(), 'HH:mm'),
                    endTime: '',
                    description: '',
                });
                setOriginalCalendarId(undefined);
            }
        }
    }, [open, editingAppointment, initialData, calendars]);

    // User Search Logic
    React.useEffect(() => {
        const handler = setTimeout(async () => {
            if (!isUserSearchOpen && userSearchQuery.length === 0) {
                setUserSearchResults([]);
                return;
            }

            setIsSearchingUsers(true);
            try {
                const data = await api.get(API_ROUTES.USERS, { search: userSearchQuery, filter_type: 'PACIENTE' });
                let usersData = [];
                if (Array.isArray(data) && data.length > 0) {
                    const firstElement = data[0];
                    if (firstElement.json && typeof firstElement.json === 'object') {
                        usersData = firstElement.json.data || [];
                    } else if (firstElement.data) {
                        usersData = firstElement.data;
                    }
                } else if (typeof data === 'object' && data !== null && data.data) {
                    usersData = data.data;
                }

                setUserSearchResults(usersData.map((apiUser: any): UserType => ({
                    id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
                    name: apiUser.name || 'No Name',
                    email: apiUser.email || 'no-email@example.com',
                    phone_number: apiUser.phone_number || '000-000-0000',
                    is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
                    avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
                })));
            } catch (error) {
                console.error("Failed to fetch users:", error);
                setUserSearchResults([]);
            } finally {
                setIsSearchingUsers(false);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [userSearchQuery, isUserSearchOpen]);

    // Service Search Logic
    React.useEffect(() => {
        const handler = setTimeout(async () => {
            if (!isServiceSearchOpen && serviceSearchQuery.length === 0) {
                setServiceSearchResults([]);
                return;
            }
            setIsSearchingServices(true);
            try {
                const data = await api.get(API_ROUTES.SERVICES, { search: serviceSearchQuery, is_sales: 'true' });
                const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);
                setServiceSearchResults(servicesData.map((apiService: any): Service => ({
                    id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
                    name: apiService.name || 'No Name',
                    category: apiService.category || 'No Category',
                    price: apiService.price || 0,
                    duration_minutes: apiService.duration_minutes || 0,
                    is_active: apiService.is_active,
                })));
            } catch (error) {
                console.error("Failed to fetch services:", error);
                setServiceSearchResults([]);
            } finally {
                setIsSearchingServices(false);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [serviceSearchQuery, isServiceSearchOpen]);

    const checkAvailability = React.useCallback(async (formData: typeof appointment) => {
        const { date, time, services, user, doctor, calendar, endTime } = formData;
        if (!date || !time || (!user && !editingAppointment) || services.length === 0) {
            return;
        }

        if (editingAppointment && editingAppointment.date === date && editingAppointment.time === time) {
            setAvailabilityStatus('available');
            return;
        }

        setAvailabilityStatus('checking');
        setSuggestedTimes([]);

        const startDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());

        let endDateTime: Date;
        if (endTime) {
            endDateTime = parse(`${date} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());
        } else {
            let totalDuration = 0;
            if (doctor && services.length > 0) {
                const doctorServices = doctorServiceMap.get(doctor.id);
                if (doctorServices) {
                    totalDuration = services.reduce((acc, service) => {
                        const docService = doctorServices.find(ds => ds.id === service.id);
                        return acc + (docService?.duration_minutes || service.duration_minutes || 0);
                    }, 0);
                }
            } else {
                totalDuration = services.reduce((acc, service) => acc + (service.duration_minutes || 0), 0);
            }
            endDateTime = addMinutes(startDateTime, totalDuration);
        }

        const attendeeEmails = [];
        if (user?.email) attendeeEmails.push(user.email);
        else if (editingAppointment?.patientEmail) attendeeEmails.push(editingAppointment.patientEmail);

        if (doctor?.email) attendeeEmails.push(doctor.email);
        else if (editingAppointment?.doctorEmail) attendeeEmails.push(editingAppointment.doctorEmail);

        const params: Record<string, string> = {
            startingDateAndTime: startDateTime.toISOString(),
            endingDateAndTime: endDateTime.toISOString(),
            mode: 'checkAvailability',
        };

        if (doctor?.email) params.doctorEmail = doctor.email;
        if (editingAppointment) params.eventId = editingAppointment.id;
        if (attendeeEmails.length > 0) params.attendeesEmails = attendeeEmails.join(',');
        if (calendar?.google_calendar_id) params.calendarIds = calendar.google_calendar_id;

        try {
            const data = await api.get(API_ROUTES.APPOINTMENTS_AVAILABILITY, params);
            let isAvailable = false;
            let suggestions = [];

            if (Array.isArray(data) && data.length > 0) {
                const result = data[0];
                isAvailable = result.isAvailable === true;
                if (result.suggestedTimes) {
                    suggestions = result.suggestedTimes.flatMap((suggestion: any, suggestionIndex: number) => {
                        const doctorsInSuggestion = suggestion.json.user_name.split(',').map((name: string) => name.trim());
                        const doctorIds = suggestion.json.user_id.split(',');
                        const doctorEmails = suggestion.json.user_email.split(',');

                        return doctorsInSuggestion.map((docName: string, docIndex: number) => ({
                            id: `sugg-${doctorIds[docIndex]}-${suggestion.json.fecha_cita}-${suggestion.json.hora_cita}-${suggestionIndex}-${docIndex}`,
                            calendar: suggestion.json.calendario,
                            date: suggestion.json.fecha_cita,
                            time: suggestion.json.hora_cita,
                            doctor: { id: doctorIds[docIndex], name: docName, email: doctorEmails[docIndex] },
                        }));
                    });
                }
            }
            setAvailabilityStatus(isAvailable ? 'available' : 'unavailable');
            setSuggestedTimes(suggestions);
        } catch (error) {
            console.error("Failed to check availability:", error);
            setAvailabilityStatus('idle');
        }
    }, [editingAppointment, doctorServiceMap]);

    React.useEffect(() => {
        if (appointment.date && appointment.time) {
            checkAvailability(appointment);
        }
    }, [appointment.date, appointment.time, appointment.endTime, appointment.services, appointment.user, appointment.doctor, appointment.calendar, checkAvailability]);

    const calculatedEndTime = React.useMemo(() => {
        const { date, time, doctor, services } = appointment;
        if (!date || !time) return null;

        try {
            const startDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
            if (!isValid(startDateTime)) return null;

            let totalDuration = 0;
            if (doctor && doctor.id && services.length > 0) {
                const doctorServices = doctorServiceMap.get(doctor.id);
                if (doctorServices) {
                    totalDuration = services.reduce((acc, service) => {
                        const docService = doctorServices.find(ds => ds.id === service.id);
                        return acc + (docService?.duration_minutes || service.duration_minutes || 0);
                    }, 0);
                }
            } else {
                totalDuration = services.reduce((acc, service) => acc + (service.duration_minutes || 0), 0);
            }

            if (editingAppointment && totalDuration === 0) {
                const start = parseISO(editingAppointment.start.dateTime);
                const end = parseISO(editingAppointment.end.dateTime);
                if (isValid(start) && isValid(end)) {
                    totalDuration = (end.getTime() - start.getTime()) / (1000 * 60);
                } else {
                    totalDuration = 30;
                }
            }

            return format(addMinutes(startDateTime, totalDuration), 'HH:mm');
        } catch {
            return null;
        }
    }, [appointment.date, appointment.time, appointment.doctor, appointment.services, doctorServiceMap, editingAppointment]);

    React.useEffect(() => {
        if (calculatedEndTime && !editingAppointment) {
            setAppointment(prev => ({ ...prev, endTime: calculatedEndTime }));
        }
    }, [calculatedEndTime, editingAppointment]);

    const handleSave = async () => {
        const isEditing = !!editingAppointment;
        if (isEditing) {
            const hasChanges = appointment.date !== editingAppointment?.date || appointment.time !== editingAppointment?.time;
            if (hasChanges && availabilityStatus !== 'available') {
                toast({ variant: "destructive", title: tToasts('slotUnavailableTitle'), description: tToasts('slotUnavailableDescription') });
                return;
            }
        }

        const { user, doctor, services, calendar, date, time, description } = appointment;
        if (!date || !time) {
            toast({ variant: "destructive", title: tToasts('missingInfoTitle'), description: tToasts('dateTimeRequired') });
            return;
        }

        const startDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
        let endDateTime: Date;

        if (appointment.endTime) {
            endDateTime = parse(`${date} ${appointment.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
        } else {
            let totalDuration = 0;
            if (doctor && doctor.id && services.length > 0) {
                const docServices = doctorServiceMap.get(doctor.id);
                if (docServices) {
                    totalDuration = services.reduce((acc, service) => {
                        const ds = docServices.find(s => s.id === service.id);
                        return acc + (ds?.duration_minutes || service.duration_minutes || 0);
                    }, 0);
                }
            } else {
                totalDuration = services.reduce((acc, service) => acc + (service.duration_minutes || 0), 0);
            }
            if (isEditing && totalDuration === 0) totalDuration = 30;
            endDateTime = addMinutes(startDateTime, totalDuration);
        }

        const payload: any = {
            startingDateAndTime: startDateTime.toISOString(),
            endingDateAndTime: endDateTime.toISOString(),
            mode: isEditing ? 'update' : 'create',
        };

        if (isEditing) {
            payload.eventId = editingAppointment!.id;
            if (originalCalendarId) payload.oldCalendarId = originalCalendarId;
            payload.doctorId = doctor?.id || '';
            payload.doctorEmail = doctor?.email || editingAppointment!.doctorEmail;
            payload.userId = user?.id || '';
            payload.userEmail = user?.email || editingAppointment!.patientEmail;
            payload.userName = user?.name || editingAppointment!.patientName;
            payload.serviceName = services.length > 0 ? services.map(s => s.name).join(', ') : editingAppointment!.service_name;
            payload.description = description || editingAppointment!.description || services.map(s => s.name).join(', ');
            payload.calendarId = calendar?.google_calendar_id || originalCalendarId;
        } else {
            if (!user || services.length === 0) {
                toast({ variant: "destructive", title: tToasts('missingInfoTitle'), description: tToasts('fillRequired') });
                return;
            }
            payload.doctorId = doctor?.id || '';
            payload.doctorEmail = doctor?.email || '';
            payload.userId = user.id;
            payload.userEmail = user.email;
            payload.userName = user.name;
            payload.serviceName = services.map(s => s.name).join(', ');
            payload.description = description || services.map(s => s.name).join(', ');
            if (calendar?.google_calendar_id) payload.calendarId = calendar.google_calendar_id;
        }

        try {
            const responseData = await api.post(API_ROUTES.APPOINTMENTS_UPSERT, payload);
            const result = Array.isArray(responseData) ? responseData[0] : responseData;

            if (result.code === 200 || result.status === 'success') {
                toast({ title: isEditing ? tToasts('appointmentUpdated') : tToasts('appointmentCreated') });
                onOpenChange(false);
                if (onSaveSuccess) onSaveSuccess(result, startDateTime);
            } else {
                const errorMessage = result?.error?.description || result?.error?.message || result?.message || tToasts('unexpectedError');
                if (errorMessage.includes("No existe disponibilidad")) {
                    toast({ variant: "destructive", title: tToasts('slotUnavailableTitle'), description: tToasts('slotNoLongerAvailable') });
                    checkAvailability(appointment);
                } else {
                    toast({ variant: "destructive", title: tToasts('error'), description: errorMessage });
                }
            }
        } catch (error) {
            toast({ variant: "destructive", title: tToasts('error'), description: error instanceof Error ? error.message : tToasts('unexpectedError') });
        }
    };

    const filteredDoctors = React.useMemo(() => {
        if (appointment.services.length === 0) return allDoctors;
        const selectedServiceIds = new Set(appointment.services.map(s => s.id));
        return allDoctors.filter(doctor => {
            const docServices = doctorServiceMap.get(doctor.id);
            return docServices && Array.from(selectedServiceIds).some(sid => docServices.some(ds => String(ds.id) === String(sid)));
        });
    }, [allDoctors, appointment.services, doctorServiceMap]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-full">
                <DialogHeader>
                    <DialogTitle>{editingAppointment ? tColumns('edit') : t('createDialog.title')}</DialogTitle>
                    <DialogDescription>{t('createDialog.description')}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t('createDialog.userName')}</Label>
                            <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        {appointment.user ? appointment.user.name : t('createDialog.selectUser')}
                                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder={t('createDialog.searchUserPlaceholder')} onValueChange={setUserSearchQuery} />
                                        <CommandList>
                                            <CommandEmpty>{isSearchingUsers ? t('createDialog.searching') : tGeneral('noResults')}</CommandEmpty>
                                            <CommandGroup>
                                                {userSearchResults.map(user => (
                                                    <CommandItem key={user.id} value={user.name} onSelect={() => { setAppointment(prev => ({ ...prev, user })); setUserSearchOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", appointment.user?.id === user.id ? "opacity-100" : "opacity-0")} />
                                                        {user.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('createDialog.serviceName')}</Label>
                            <Popover open={isServiceSearchOpen} onOpenChange={setServiceSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        {appointment.services.length > 0 ? t('createDialog.servicesSelected', { count: appointment.services.length }) : t('createDialog.selectServices')}
                                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder={t('createDialog.searchServicePlaceholder')} onValueChange={setServiceSearchQuery} />
                                        <CommandList>
                                            <CommandEmpty>{isSearchingServices ? t('createDialog.searching') : tGeneral('noResults')}</CommandEmpty>
                                            <CommandGroup>
                                                {serviceSearchResults.map(service => (
                                                    <CommandItem key={service.id} value={service.name} onSelect={() => {
                                                        setAppointment(prev => {
                                                            const isSelected = prev.services.some(s => s.id === service.id);
                                                            return { ...prev, services: isSelected ? prev.services.filter(s => s.id !== service.id) : [...prev.services, service] };
                                                        });
                                                    }}>
                                                        <Checkbox checked={appointment.services.some(s => s.id === service.id)} className="mr-2" />
                                                        <span>{service.name}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {appointment.services.length > 0 && (
                                <div className="p-2 border rounded-md mt-2">
                                    <Label className="text-xs text-muted-foreground">{t('createDialog.selectedServices')}</Label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {appointment.services.map(service => (
                                            <Badge key={service.id} variant="secondary">
                                                {service.name}
                                                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-transparent" onClick={() => setAppointment(prev => ({ ...prev, services: prev.services.filter(s => s.id !== service.id) }))}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>{tColumns('doctor')}</Label>
                            <Popover open={isDoctorSearchOpen} onOpenChange={setDoctorSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        {appointment.doctor ? appointment.doctor.name : t('createDialog.selectDoctor')}
                                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder={t('createDialog.searchDoctorPlaceholder')} onValueChange={setDoctorSearchQuery} />
                                        <CommandList>
                                            <CommandEmpty>{isSearchingUsers ? t('createDialog.searching') : tGeneral('noResults')}</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => { setAppointment(prev => ({ ...prev, doctor: null })); setDoctorSearchOpen(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", !appointment.doctor ? "opacity-100" : "opacity-0")} />
                                                    {t('createDialog.none')}
                                                </CommandItem>
                                                {filteredDoctors.map(doctor => (
                                                    <CommandItem key={doctor.id} value={doctor.name} onSelect={() => { setAppointment(prev => ({ ...prev, doctor })); setDoctorSearchOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", appointment.doctor?.id === doctor.id ? "opacity-100" : "opacity-0")} />
                                                        {doctor.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('createDialog.calendar')}</Label>
                            <Popover open={isCalendarSearchOpen} onOpenChange={setCalendarSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        {appointment.calendar ? appointment.calendar.name : t('createDialog.allCalendars')}
                                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandList>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => { setAppointment(prev => ({ ...prev, calendar: null })); setCalendarSearchOpen(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", !appointment.calendar ? "opacity-100" : "opacity-0")} />
                                                    {t('createDialog.allCalendars')}
                                                </CommandItem>
                                                {calendars.map(calendar => (
                                                    <CommandItem key={calendar.id} value={calendar.name} onSelect={() => { setAppointment(prev => ({ ...prev, calendar })); setCalendarSearchOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", appointment.calendar?.id === calendar.id ? "opacity-100" : "opacity-0")} />
                                                        {calendar.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">{t('createDialog.date')}</Label>
                            <Input id="date" type="date" value={appointment.date} onChange={e => setAppointment(prev => ({ ...prev, date: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="time">{t('createDialog.time')}</Label>
                            <Input id="time" type="time" value={appointment.time} onChange={e => setAppointment(prev => ({ ...prev, time: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">{t('createDialog.endTime')}</Label>
                            <Input id="endTime" type="time" value={appointment.endTime} onChange={e => setAppointment(prev => ({ ...prev, endTime: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">{t('createDialog.descriptionLabel')}</Label>
                            <Textarea id="description" value={appointment.description} onChange={e => setAppointment(prev => ({ ...prev, description: e.target.value }))} />
                        </div>
                    </div>
                </div>
                {!editingAppointment && (availabilityStatus === 'unavailable' || availabilityStatus === 'checking') && (
                    <div className="border-t pt-4">
                        <h3 className="text-lg font-medium mb-4 text-center">{t('createDialog.suggestedTimes')}</h3>
                        <ScrollArea className="h-48">
                            {availabilityStatus === 'checking' ? <p>{t('checking')}</p> : (
                                <RadioGroup onValueChange={(value) => {
                                    const [date, time, doctorId, calendarId] = value.split('|');
                                    const doctor = allDoctors.find(d => d.id === doctorId);
                                    const calendar = calendars.find(c => c.id === calendarId || c.name === calendarId);
                                    setAppointment(prev => ({ ...prev, date, time, doctor: doctor || null, calendar: calendar || null }));
                                }}>
                                    {suggestedTimes.map((suggestion) => (
                                        <div key={suggestion.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                                            <RadioGroupItem value={`${suggestion.date}|${suggestion.time}|${suggestion.doctor.id}|${suggestion.calendar}`} id={suggestion.id} />
                                            <Label htmlFor={suggestion.id} className="font-normal text-sm">
                                                {t('suggestionFormat', { date: suggestion.date, time: suggestion.time, doctor: suggestion.doctor.name, calendar: suggestion.calendar })}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}
                            {availabilityStatus === 'unavailable' && suggestedTimes.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center pt-10">{t('noSuggestions')}</p>
                            )}
                        </ScrollArea>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('createDialog.cancel')}</Button>
                    <Button onClick={handleSave}>{editingAppointment ? tColumns('edit') : t('createDialog.save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Checkbox helper if not already in @/components/ui/checkbox
import { Checkbox } from '@/components/ui/checkbox';
