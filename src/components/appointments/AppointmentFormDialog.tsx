
'use client';

import { QuickQuoteDialog } from '@/components/appointments/QuickQuoteDialog';
import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Appointment, Calendar as CalendarType, PatientSession, Quote, QuoteItem, Service, User as UserType } from '@/lib/types';
import { cn, toLocalISOString } from '@/lib/utils';
import api from '@/services/api';
import { getSalesServices } from '@/services/services';
import { getServicesByQuoteId, getQuoteItems } from '@/services/quotes';
import { addMinutes, format, isValid, parse, parseISO } from 'date-fns';
import { Check, ChevronsUpDown, FilePlus, Link2, Loader2, Stethoscope, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

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
        summary?: string;
        description?: string;
        notes?: string;
        quote?: Quote | null;
    };
    readOnlyFields?: {
        user?: boolean;
        services?: boolean;
        quote?: boolean;
        doctor?: boolean;
        date?: boolean;
    };
    onSaveSuccess?: (savedAppointment: any, selectedDate: Date) => void;
    calendars: CalendarType[];
    doctors: UserType[];
    doctorServiceMap: Map<string, Service[]>;
    checkCalendarAvailability: boolean;
    checkDoctorAvailability: boolean;
    userQuotes?: Quote[];
}

export function AppointmentFormDialog({
    open,
    onOpenChange,
    editingAppointment,
    initialData,
    readOnlyFields,
    onSaveSuccess,
    calendars,
    doctors: allDoctors,
    doctorServiceMap,
    checkCalendarAvailability,
    checkDoctorAvailability,
    userQuotes: externalUserQuotes,
}: AppointmentFormDialogProps) {
    const t = useTranslations('AppointmentsPage');
    const tColumns = useTranslations('AppointmentsColumns');
    const tGeneral = useTranslations('General');
    const tToasts = useTranslations('AppointmentsPage.toasts');
    const tQuotes = useTranslations('QuotesPage');
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
        notes: '',
        quote: null as Quote | null,
    });

    const [errors, setErrors] = React.useState<string[]>([]);

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

    // Quote selection states
    const [isQuoteSearchOpen, setQuoteSearchOpen] = React.useState(false);
    const [userQuotes, setUserQuotes] = React.useState<Quote[]>(externalUserQuotes || []);
    const [isLoadingQuotes, setIsLoadingQuotes] = React.useState(false);
    const [isLoadingQuoteServices, setIsLoadingQuoteServices] = React.useState(false);
    const [isQuickQuoteOpen, setIsQuickQuoteOpen] = React.useState(false);

    // Clinic session states
    const [linkedSession, setLinkedSession] = React.useState<PatientSession | null>(null);
    const [isLoadingLinkedSession, setIsLoadingLinkedSession] = React.useState(false);
    const [isSessionDialogOpen, setIsSessionDialogOpen] = React.useState(false);
    const [createSessionOnSave, setCreateSessionOnSave] = React.useState(false);
    const [pendingSaveResult, setPendingSaveResult] = React.useState<{ result: any; startDateTime: Date } | null>(null);
    const [hasPendingSession, setHasPendingSession] = React.useState(false);
    // NEW: Pending appointment data when creating with session
    const [pendingAppointmentPayload, setPendingAppointmentPayload] = React.useState<any>(null);

    // Quote items for prefilling treatments in clinic session
    const [sessionQuoteItems, setSessionQuoteItems] = React.useState<QuoteItem[]>([]);

    // Load quote items when a quote is selected (for prefilling session treatments)
    React.useEffect(() => {
        const loadQuoteItems = async () => {
            const quoteId = appointment.quote?.id || editingAppointment?.quote_id;
            if (!quoteId) {
                setSessionQuoteItems([]);
                return;
            }
            try {
                const items = await getQuoteItems(quoteId);
                setSessionQuoteItems(items);
            } catch (error) {
                console.error('Failed to load quote items for session:', error);
                setSessionQuoteItems([]);
            }
        };
        loadQuoteItems();
    }, [appointment.quote?.id, editingAppointment?.quote_id]);

    // Compute prefillTreatments from quote items
    const prefillTreatments = React.useMemo(() => {
        return sessionQuoteItems.map(item => {
            const toothNum = item.tooth_number != null ? Number(item.tooth_number) : null;
            return {
                numero_diente: toothNum != null && !isNaN(toothNum) && toothNum > 0 ? toothNum : null,
                descripcion: item.service_name,
            };
        });
    }, [sessionQuoteItems]);

    // Load user quotes when user changes
    React.useEffect(() => {
        const loadUserQuotes = async () => {
            if (!appointment.user?.id) {
                setUserQuotes([]);
                setAppointment(prev => ({ ...prev, quote: null }));
                return;
            }

            // If external quotes are provided, use them
            if (externalUserQuotes) {
                setUserQuotes(externalUserQuotes);
                return;
            }

            setIsLoadingQuotes(true);
            try {
                const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: appointment.user.id });
                const raw = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);
                const quotes: Quote[] = raw.map((q: any) => ({
                    id: q.id ? String(q.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
                    doc_no: q.doc_no || 'N/A',
                    user_id: q.user_id || appointment.user!.id,
                    total: q.total || 0,
                    status: q.status || 'draft',
                    payment_status: q.payment_status || 'unpaid',
                    billing_status: q.billing_status || 'not_invoiced',
                    currency: q.currency || 'USD',
                    exchange_rate: q.exchange_rate || 1,
                    notes: q.notes || '',
                    createdAt: q.createdAt || q.created_at || new Date().toISOString().split('T')[0],
                }));
                setUserQuotes(quotes);

                // If there's a pre-selected quote, update it with full data from the loaded quotes
                if (appointment.quote?.id) {
                    const fullQuote = quotes.find(q => q.id === appointment.quote?.id);
                    if (fullQuote) {
                        setAppointment(prev => ({ ...prev, quote: fullQuote }));
                    }
                }
            } catch (error) {
                console.error('Failed to load user quotes:', error);
                setUserQuotes([]);
            } finally {
                setIsLoadingQuotes(false);
            }
        };

        loadUserQuotes();
    }, [appointment.user?.id, externalUserQuotes]);

    // Initialize/Reset form
    React.useEffect(() => {
        if (open) {
            setErrors([]);
            setCreateSessionOnSave(false);
            setPendingSaveResult(null);
            setHasPendingSession(false);
            setPendingAppointmentPayload(null);
            if (!editingAppointment) {
                setLinkedSession(null);
            }
            if (editingAppointment) {
                let foundCalendar = calendars.find(c => c.google_calendar_id === editingAppointment.calendar_id);
                if (!foundCalendar) {
                    foundCalendar = calendars.find(c => c.name === editingAppointment.calendar_name);
                }

                setAppointment({
                    user: {
                        id: editingAppointment.patientId || '',
                        name: editingAppointment.patientName,
                        email: editingAppointment.patientEmail || '',
                        phone_number: editingAppointment.patientPhone || '',
                        is_active: true, avatar: ''
                    },
                    services: editingAppointment.services || [],
                    doctor: editingAppointment.doctorId ? {
                        id: editingAppointment.doctorId,
                        name: editingAppointment.doctorName || '',
                        email: editingAppointment.doctorEmail || '',
                        phone_number: '',
                        is_active: true, avatar: ''
                    } : null,
                    calendar: foundCalendar || null,
                    date: editingAppointment.date || '',
                    time: editingAppointment.time || '',
                    endTime: editingAppointment.end ? format(parseISO(editingAppointment.end.dateTime), 'HH:mm') : '',
                    notes: editingAppointment.notes || '',
                    quote: editingAppointment.quote_id ? {
                        id: editingAppointment.quote_id,
                        doc_no: editingAppointment.quote_doc_no || '',
                        user_id: editingAppointment.patientId,
                        total: 0,
                        status: 'draft',
                        payment_status: 'unpaid',
                        billing_status: 'not_invoiced',
                        createdAt: '',
                    } : null,
                });
                setOriginalCalendarId(editingAppointment.google_calendar_id || editingAppointment.calendar_id);
                loadLinkedSession(editingAppointment);
            } else if (initialData) {
                setAppointment({
                    user: initialData.user || null,
                    services: initialData.services || [],
                    doctor: initialData.doctor || null,
                    calendar: null,
                    date: initialData.date || format(new Date(), 'yyyy-MM-dd'),
                    time: initialData.time || format(new Date(), 'HH:mm'),
                    endTime: '',
                    notes: initialData.notes || '',
                    quote: initialData.quote || null,
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
                    notes: '',
                    quote: null,
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
                const result = await getSalesServices({ search: serviceSearchQuery, limit: 50 });
                setServiceSearchResults(result.items.map((apiService: any): Service => ({
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
        console.log(`Evaluating availability check. CHECK_CALENDAR_AVAILABILITY is: ${checkCalendarAvailability}`);
        if (!checkCalendarAvailability) {
            setAvailabilityStatus('available');
            return;
        }

        const { date, time, services, user, doctor, calendar, endTime, notes } = formData;
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
            doctorId: doctor?.id || editingAppointment?.doctorId || '',
            patientId: user?.id || editingAppointment?.patientId || '',
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
    }, [editingAppointment, doctorServiceMap, checkCalendarAvailability]);

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

    // Auto-confirm quote if it's not already confirmed
    const confirmQuoteIfNeeded = async (quote: Quote | null | undefined) => {
        if (!quote || quote.status === 'confirmed') return;
        try {
            const payload = { quote_number: quote.id, confirm_reject: 'confirm', is_sales: true, notes: '' };
            await api.post(API_ROUTES.SALES.QUOTE_CONFIRM, payload);
            // Update local quote status so we don't try to confirm again
            setAppointment(prev => prev.quote ? { ...prev, quote: { ...prev.quote, status: 'confirmed' } } : prev);
            toast({ title: tToasts('quoteAutoConfirmed'), description: tToasts('quoteAutoConfirmedDesc') });
        } catch (error) {
            console.error('Failed to auto-confirm quote:', error);
            toast({ variant: 'destructive', title: tToasts('error'), description: tToasts('quoteAutoConfirmError') });
            throw error; // Prevent appointment creation if quote confirmation fails
        }
    };

    const handleSave = async () => {
        const isEditing = !!editingAppointment;
        if (isEditing) {
            const hasChanges = appointment.date !== editingAppointment?.date || appointment.time !== editingAppointment?.time;
            if (hasChanges && availabilityStatus !== 'available') {
                toast({ variant: "destructive", title: tToasts('slotUnavailableTitle'), description: tToasts('slotUnavailableDescription') });
                return;
            }
        }

        const { user, doctor, services, calendar, date, time, notes } = appointment;
        
        let newErrors: string[] = [];
        if (!date) newErrors.push('date');
        if (!time) newErrors.push('time');
        if (!calendar) newErrors.push('calendar');
        
        if (!isEditing) {
            if (!user) newErrors.push('user');
        }

        if (newErrors.length > 0) {
            setErrors(newErrors);
            toast({ variant: "destructive", title: tToasts('missingInfoTitle'), description: tToasts('fillRequired') });
            return;
        }

        // If there's a pending session, reopen the session dialog instead of saving
        if (hasPendingSession) {
            setIsSessionDialogOpen(true);
            return;
        }
        
        setErrors([]);

        const startDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
        let endDateTime: Date;

        if (appointment.endTime) {
            endDateTime = parse(`${date} ${appointment.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
            if (endDateTime <= startDateTime) {
                toast({ variant: "destructive", title: tToasts('error'), description: tToasts('endTimeInvalid') });
                return;
            }
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
            start: toLocalISOString(startDateTime),
            end: toLocalISOString(endDateTime),
            mode: isEditing ? 'update' : 'create',
        };

        if (isEditing) {
            payload.appointment_id = editingAppointment!.id;
            payload.google_event_id = editingAppointment!.googleEventId;
            if (originalCalendarId) payload.old_calendar_id = originalCalendarId;
            payload.doctor_id = doctor?.id || editingAppointment!.doctorId;
            payload.doctor_name = doctor?.name || editingAppointment!.doctorName;
            payload.doctor_email = doctor?.email || editingAppointment!.doctorEmail;
            payload.patient_id = user?.id || editingAppointment!.patientId;
            payload.patient_name = user?.name || editingAppointment!.patientName;
            payload.patient_email = user?.email || editingAppointment!.patientEmail;
            payload.patient_phone = user?.phone_number || editingAppointment!.patientPhone;
            const patientNameBase = user?.name || editingAppointment!.patientName;
            payload.summary = services.length > 0 ? `${patientNameBase} - ${services.map(s => s.name).join(', ')}` : editingAppointment!.summary;
            payload.service_ids = services.filter(s => s.id).map(s => s.id);
            payload.service_names = services.map(s => s.name).join(', ');
            payload.notes = notes || editingAppointment!.notes || '';
            payload.google_calendar_id = calendar?.google_calendar_id || originalCalendarId;
            payload.quote_id = appointment.quote?.id || editingAppointment?.quote_id || null;
        } else {
            payload.doctor_id = doctor?.id || '';
            payload.doctor_name = doctor?.name || '';
            payload.doctor_email = doctor?.email || '';
            payload.patient_id = user?.id || '';
            payload.patient_name = user?.name || '';
            payload.patient_email = user?.email || '';
            payload.patient_phone = user?.phone_number || '';
            payload.summary = user ? `${user.name} - ${services.map(s => s.name).join(', ')}` : services.map(s => s.name).join(', ');
            payload.service_ids = services.filter(s => s.id).map(s => s.id);
            payload.service_names = services.map(s => s.name).join(', ');
            payload.notes = notes || '';
            payload.google_calendar_id = calendar?.google_calendar_id || '';
            payload.quote_id = appointment.quote?.id || null;
        }

        // Auto-confirm the quote if not yet confirmed (only when creating, not editing)
        if (!isEditing && appointment.quote && appointment.quote.status !== 'confirmed') {
            try {
                await confirmQuoteIfNeeded(appointment.quote);
            } catch {
                return; // Abort if confirmation fails
            }
        }

        // NEW FLOW: If creating with session, save payload and open session dialog WITHOUT creating appointment yet
        if (!isEditing && createSessionOnSave) {
            setPendingAppointmentPayload(payload);
            setHasPendingSession(true);
            setIsSessionDialogOpen(true);
            return; // ← IMPORTANT: Return without creating the appointment yet
        }

        // Original flow: Create appointment immediately (no session)
        try {
            const responseData = await api.post(API_ROUTES.APPOINTMENTS_UPSERT, payload);
            const result = Array.isArray(responseData) ? responseData[0] : responseData;

            // Since api.ts already throws for non-2xx codes, a successful return is a success
            // unless it explicitly contains an error field.
            const isSuccess = !result.error && (result.code === 200 || result.status === 'success' || result.message || result.id || result.appointment_id || result.appointmentId);

            if (isSuccess) {
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

    const loadLinkedSession = React.useCallback(async (appt: Appointment) => {
        const patientId = appt.patientId;
        if (!patientId || !appt.id) return;
        setIsLoadingLinkedSession(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: patientId });
            const sessions: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
            const match = sessions.find((s: any) => s?.appointment_id?.toString() === appt.id);
            if (match) {
                setLinkedSession({
                    sesion_id: Number(match.sesion_id),
                    tipo_sesion: match.tipo_sesion,
                    fecha_sesion: match.fecha_sesion || '',
                    diagnostico: match.diagnostico || null,
                    procedimiento_realizado: match.procedimiento_realizado || '',
                    plan_proxima_cita: match.plan_proxima_cita,
                    fecha_proxima_cita: match.fecha_proxima_cita,
                    doctor_id: match.doctor_id || null,
                    doctor_name: match.doctor_name || match.nombre_doctor,
                    nombre_doctor: match.nombre_doctor || match.doctor_name,
                    estado_odontograma: match.estado_odontograma,
                    tratamientos: match.tratamientos || [],
                    archivos_adjuntos: match.archivos_adjuntos || [],
                    quote_id: match.quote_id?.toString(),
                    quote_doc_no: match.quote_doc_no,
                    appointment_id: match.appointment_id?.toString(),
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

    const handleSaveSession = async (sessionData: ClinicSessionFormData) => {
        // NEW FLOW: If there's pending appointment payload, create both appointment and session together
        if (pendingAppointmentPayload) {
            const patientId = pendingAppointmentPayload.patient_id;
            if (!patientId) {
                toast({ variant: 'destructive', title: tToasts('error'), description: tToasts('patientIdRequired') });
                return;
            }

            try {
                // 1. Create the appointment first
                const appointmentResponse = await api.post(API_ROUTES.APPOINTMENTS_UPSERT, pendingAppointmentPayload);
                console.log('[handleSaveSession] Raw appointment response:', JSON.stringify(appointmentResponse));

                // Extract appointment ID from response: { code, message, data: { id } }
                const appointmentResult = Array.isArray(appointmentResponse) ? appointmentResponse[0] : appointmentResponse;
                const responseData = appointmentResult?.data;
                const appointmentId: string | undefined =
                    (responseData?.id != null ? String(responseData.id) : undefined) ||
                    (responseData?.appointment_id != null ? String(responseData.appointment_id) : undefined) ||
                    (appointmentResult?.id != null ? String(appointmentResult.id) : undefined) ||
                    (appointmentResult?.appointment_id != null ? String(appointmentResult.appointment_id) : undefined) ||
                    undefined;
                console.log('[handleSaveSession] Extracted appointmentId:', appointmentId);

                if (!appointmentId) {
                    console.error('[handleSaveSession] Could not extract appointment ID. Response keys:', Object.keys(appointmentResult || {}), 'Data keys:', Object.keys(responseData || {}));
                    toast({ variant: 'destructive', title: tToasts('error'), description: 'No se pudo obtener el ID de la cita creada. Por favor, cree la sesión manualmente desde el historial del paciente.' });
                    const startDateTime = parseISO(pendingAppointmentPayload.start);
                    if (onSaveSuccess) onSaveSuccess(appointmentResult || {}, startDateTime);
                    return;
                }

                // 2. Create the session with the appointment_id
                const sessionPayload = {
                    paciente_id: patientId,
                    doctor_id: sessionData.doctor_id,
                    doctor_name: sessionData.doctor_name,
                    fecha_sesion: sessionData.fecha_sesion,
                    procedimiento_realizado: sessionData.procedimiento_realizado,
                    plan_proxima_cita: sessionData.plan_proxima_cita || '',
                    fecha_proxima_cita: sessionData.fecha_proxima_cita || '',
                    appointment_id: appointmentId,
                    quote_id: pendingAppointmentPayload.quote_id || null,
                    tratamientos: sessionData.tratamientos || [],
                    archivos_adjuntos: sessionData.archivos_adjuntos || [],
                };
                console.log('[handleSaveSession] Session payload:', JSON.stringify(sessionPayload));

                await api.post(API_ROUTES.CLINIC_HISTORY.SESSIONS_UPSERT, sessionPayload);

                toast({
                    title: tToasts('sessionCreated'),
                    description: tToasts('sessionCreatedDesc'),
                });

                // Calculate start datetime from payload for callback
                const startDateTime = parseISO(pendingAppointmentPayload.start);
                
                setIsSessionDialogOpen(false);
                setPendingAppointmentPayload(null);
                setHasPendingSession(false);
                onOpenChange(false);
                if (onSaveSuccess) onSaveSuccess(appointmentResult, startDateTime);
            } catch (error: any) {
                console.error('[handleSaveSession] Error creating appointment/session:', error);
                const errorMessage = error?.message || error?.data?.error || tToasts('errorCreatingSessionDesc');
                toast({
                    variant: 'destructive',
                    title: tToasts('errorCreatingSession'),
                    description: errorMessage
                });
                throw error; // Re-throw so the session dialog knows it failed
            }
            return;
        }

        // ORIGINAL FLOW: Session only (editing or creating for existing appointment)
        const patientId = appointment.user?.id || editingAppointment?.patientId || pendingSaveResult?.result?.patient_id;
        if (!patientId) {
            toast({ variant: 'destructive', title: tToasts('error'), description: tToasts('patientIdRequired') });
            return;
        }

        const appointmentId = pendingSaveResult?.result?.appointment_id
            || pendingSaveResult?.result?.id
            || editingAppointment?.id;
        const quoteId = appointment.quote?.id || editingAppointment?.quote_id;

        const payload = {
            ...sessionData,
            patient_id: patientId,
            ...(appointmentId ? { appointment_id: appointmentId } : {}),
            ...(quoteId ? { quote_id: quoteId } : {}),
        };

        try {
            const isEditing = !!sessionData.sesion_id;
            await api.post(API_ROUTES.CLINIC_HISTORY.SESSIONS_UPSERT, payload);
            toast({
                title: isEditing ? tToasts('sessionUpdated') : tToasts('sessionCreated'),
                ...(isEditing ? {} : { description: tToasts('sessionCreatedDesc') }),
            });
            setIsSessionDialogOpen(false);
            setHasPendingSession(false);
            if (pendingSaveResult) {
                onOpenChange(false);
                if (onSaveSuccess) onSaveSuccess(pendingSaveResult.result, pendingSaveResult.startDateTime);
                setPendingSaveResult(null);
            } else {
                // Refresh linked session display
                if (editingAppointment) loadLinkedSession(editingAppointment);
            }
        } catch (error: any) {
                console.error('[handleSaveSession] Error:', error);
                const errorMessage = error?.message || error?.data?.error || tToasts('errorCreatingSessionDesc');
                toast({ 
                    variant: 'destructive', 
                    title: tToasts('errorCreatingSession'), 
                    description: errorMessage 
                });
            }
    };

    const filteredDoctors = React.useMemo(() => {
        console.log(`Evaluating doctor filtering. CHECK_DOCTOR_AVAILABILITY is: ${checkDoctorAvailability}`);
        if (!checkDoctorAvailability) {
            return allDoctors;
        }
        if (appointment.services.length === 0) return allDoctors;
        const selectedServiceIds = new Set(appointment.services.map(s => s.id));
        return allDoctors.filter(doctor => {
            const docServices = doctorServiceMap.get(doctor.id);
            return docServices && Array.from(selectedServiceIds).some(sid => docServices.some(ds => String(ds.id) === String(sid)));
        });
    }, [allDoctors, appointment.services, doctorServiceMap, checkDoctorAvailability]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="4xl">
                <DialogHeader>
                    <DialogTitle>{editingAppointment ? tColumns('edit') : t('createDialog.title')}</DialogTitle>
                    <DialogDescription>{t('createDialog.description')}</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className={errors.includes('user') ? "text-destructive" : ""}>{t('createDialog.userName')}</Label>
                                <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start", errors.includes('user') && "border-destructive text-destructive")} disabled={readOnlyFields?.user || isLoadingQuotes}>
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
                                                        <CommandItem key={user.id} value={user.name} onSelect={() => { setAppointment(prev => ({ ...prev, user })); setUserSearchOpen(false); setErrors(prev => prev.filter(err => err !== 'user')); }}>
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

                            {/* Quote Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-1">
                                        <Link2 className="h-3.5 w-3.5" />
                                        {t('createDialog.quote')}
                                    </Label>
                                    {appointment.user && !readOnlyFields?.quote && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={() => setIsQuickQuoteOpen(true)}
                                        >
                                            <FilePlus className="h-3 w-3 mr-1" />
                                            {t('createDialog.newQuote')}
                                        </Button>
                                    )}
                                </div>
                                <Popover open={isQuoteSearchOpen} onOpenChange={setQuoteSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                            disabled={readOnlyFields?.quote || !appointment.user || isLoadingQuotes}
                                        >
                                            {isLoadingQuotes ? (
                                                t('createDialog.loadingQuotes')
                                            ) : appointment.quote ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="font-medium">{appointment.quote.doc_no}</span>
                                                    <span className="text-muted-foreground">
                                                        {appointment.quote.createdAt && isValid(parseISO(appointment.quote.createdAt)) ? format(parseISO(appointment.quote.createdAt), 'dd/MM/yyyy') : ''}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        ({new Intl.NumberFormat('en-US', { style: 'currency', currency: appointment.quote.currency || 'USD' }).format(appointment.quote.total)})
                                                    </span>
                                                </span>
                                            ) : (
                                                t('createDialog.selectQuote')
                                            )}
                                            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder={t('createDialog.searchQuotePlaceholder')} />
                                            <CommandList>
                                                <CommandEmpty>{t('createDialog.noQuotes')}</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => {
                                                            setAppointment(prev => ({ ...prev, quote: null, services: [] }));
                                                            setQuoteSearchOpen(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", !appointment.quote ? "opacity-100" : "opacity-0")} />
                                                        {t('createDialog.noQuote')}
                                                    </CommandItem>
                                                    {userQuotes.map(quote => (
                                                        <CommandItem
                                                            key={quote.id}
                                                            value={`${quote.doc_no} ${quote.createdAt ? format(parseISO(quote.createdAt), 'dd/MM/yyyy') : ''}`}
                                                            onSelect={async () => {
                                                                setQuoteSearchOpen(false);
                                                                setAppointment(prev => ({ ...prev, quote }));
                                                                
                                                                // Load services from the quote items
                                                                setIsLoadingQuoteServices(true);
                                                                try {
                                                                    const quoteServices = await getServicesByQuoteId(quote.id);
                                                                    setAppointment(prev => ({
                                                                        ...prev,
                                                                        services: quoteServices
                                                                    }));
                                                                } catch (error) {
                                                                    console.error('Failed to load services from quote:', error);
                                                                    toast({ variant: "destructive", title: tToasts('error'), description: tToasts('loadQuoteServicesError') });
                                                                } finally {
                                                                    setIsLoadingQuoteServices(false);
                                                                }
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", appointment.quote?.id === quote.id ? "opacity-100" : "opacity-0")} />
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{quote.doc_no}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {quote.createdAt ? format(parseISO(quote.createdAt), 'dd/MM/yyyy') : ''} • {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'USD' }).format(quote.total)} • {tQuotes(`quoteDialog.${quote.status?.toLowerCase()}`)}
                                                                </span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {!appointment.user && (
                                    <p className="text-xs text-muted-foreground">{t('createDialog.selectUserFirst')}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>{t('createDialog.serviceName')}</Label>
                                <Popover open={isServiceSearchOpen} onOpenChange={setServiceSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start" disabled={readOnlyFields?.services || isLoadingQuoteServices}>
                                            {isLoadingQuoteServices ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    {t('createDialog.loadingServices')}
                                                </>
                                            ) : appointment.services.length > 0 ? (
                                                t('createDialog.servicesSelected', { count: appointment.services.length })
                                            ) : (
                                                t('createDialog.selectServices')
                                            )}
                                            {!isLoadingQuoteServices && <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />}
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
                                                    {!readOnlyFields?.services && (
                                                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-transparent" onClick={() => setAppointment(prev => ({ ...prev, services: prev.services.filter(s => s.id !== service.id) }))}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    )}
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
                                <Label className={errors.includes('calendar') ? "text-destructive" : ""}>{t('createDialog.calendar')}</Label>
                                <Popover open={isCalendarSearchOpen} onOpenChange={setCalendarSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start", errors.includes('calendar') && "border-destructive text-destructive")}>
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
                                                        <CommandItem key={calendar.id} value={calendar.name} onSelect={() => { setAppointment(prev => ({ ...prev, calendar })); setCalendarSearchOpen(false); setErrors(prev => prev.filter(err => err !== 'calendar')); }}>
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
                                <Label htmlFor="date" className={errors.includes('date') ? "text-destructive" : ""}>{t('createDialog.date')}</Label>
                                <Input id="date" type="date" value={appointment.date} onChange={e => { setAppointment(prev => ({ ...prev, date: e.target.value })); setErrors(prev => prev.filter(err => err !== 'date')); }} className={errors.includes('date') ? "border-destructive" : ""} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="time" className={errors.includes('time') ? "text-destructive" : ""}>{t('createDialog.time')}</Label>
                                <Input id="time" type="time" value={appointment.time} onChange={e => { setAppointment(prev => ({ ...prev, time: e.target.value })); setErrors(prev => prev.filter(err => err !== 'time')); }} className={errors.includes('time') ? "border-destructive" : ""} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endTime">{t('createDialog.endTime')}</Label>
                                <Input id="endTime" type="time" value={appointment.endTime} onChange={e => setAppointment(prev => ({ ...prev, endTime: e.target.value }))} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="notes">{t('createDialog.notes')}</Label>
                                <Textarea id="notes" value={appointment.notes} onChange={e => setAppointment(prev => ({ ...prev, notes: e.target.value }))} />
                            </div>
                        </div>
                    </div>

                    {/* Clinic Session Section */}
                    <div className="border-t px-6 pt-4 pb-2">
                        <div className="flex items-center gap-2 mb-3">
                            <Stethoscope className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{t('clinicSession')}</span>
                        </div>
                        {editingAppointment ? (
                            <div className="space-y-2">
                                {isLoadingLinkedSession ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>{t('checking')}</span>
                                    </div>
                                ) : linkedSession ? (
                                    <div className="flex items-center justify-between rounded-md border p-3">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-medium">{linkedSession.procedimiento_realizado || '—'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {linkedSession.fecha_sesion} · {linkedSession.doctor_name}
                                            </p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSessionDialogOpen(true)}>
                                            {t('editSession')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground">{t('noLinkedSession')}</p>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSessionDialogOpen(true)}>
                                            {t('createSession')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="createSessionOnSave"
                                    checked={createSessionOnSave}
                                    onCheckedChange={(checked) => setCreateSessionOnSave(checked === true)}
                                />
                                <Label htmlFor="createSessionOnSave" className="text-sm font-normal cursor-pointer">
                                    {t('createSessionOnSave')}
                                </Label>
                            </div>
                        )}
                    </div>

                    {!editingAppointment && (availabilityStatus === 'unavailable' || availabilityStatus === 'checking') && (
                        <div className="border-t pt-4 px-6 mb-4">
                            <h3 className="text-lg font-medium mb-4 text-center">{t('createDialog.suggestedTimes')}</h3>
                            <ScrollArea className="h-48">
                                {availabilityStatus === 'checking' ? <p>{t('checking')}</p> : (
                                    <RadioGroup onValueChange={(value) => {
                                        const [date, time, doctorId, calendarId] = value.split('|');
                                        const doctor = allDoctors.find(d => d.id === doctorId);
                                        const calendar = calendars.find(c => c.id === calendarId || c.name === calendarId);
                                        setAppointment(prev => ({ ...prev, date, time, doctor: doctor || null, calendar: calendar || null }));
                                        setErrors(prev => prev.filter(err => !['date', 'time', 'calendar'].includes(err)));
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
                </DialogBody>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSessionDialogOpen}>{editingAppointment ? tColumns('edit') : t('createDialog.save')}</Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('createDialog.cancel')}</Button>
                </DialogFooter>
            </DialogContent>

            {/* Clinic Session Dialog */}
            <ClinicSessionDialog
                open={isSessionDialogOpen}
                onOpenChange={(open) => {
                    if (!open && pendingAppointmentPayload) {
                        // If user closes the dialog when there's a pending appointment,
                        // cancel the whole flow - don't create anything
                        setPendingAppointmentPayload(null);
                        setHasPendingSession(false);
                        setIsSessionDialogOpen(open);
                        return;
                    }
                    if (!open && hasPendingSession) {
                        // Prevent closing without saving session - show confirmation
                        toast({
                            title: tToasts('pendingSessionTitle') || 'Session pending',
                            description: tToasts('pendingSessionDesc') || 'Please complete the clinical session before closing.',
                            variant: 'destructive',
                        });
                        return;
                    }
                    setIsSessionDialogOpen(open);
                }}
                existingSession={linkedSession ?? undefined}
                showTreatments={true}
                showAttachments={true}
                quoteId={appointment.quote?.id || editingAppointment?.quote_id}
                appointmentId={editingAppointment?.id || pendingSaveResult?.result?.appointment_id || pendingSaveResult?.result?.id}
                userId={appointment.user?.id || editingAppointment?.patientId || ''}
                onSave={handleSaveSession}
                prefillData={{
                    doctor_id: appointment.doctor?.id || '',
                    doctor_name: appointment.doctor?.name || '',
                    procedimiento_realizado: appointment.services.map(s => s.name).join(', '),
                }}
                prefillTreatments={prefillTreatments}
                // NEW: Pass pending appointment data when creating together with session
                pendingAppointmentData={pendingAppointmentPayload ? {
                    start: pendingAppointmentPayload.start,
                    end: pendingAppointmentPayload.end,
                    doctor_id: pendingAppointmentPayload.doctor_id,
                    doctor_name: pendingAppointmentPayload.doctor_name,
                    patient_id: pendingAppointmentPayload.patient_id,
                    patient_name: pendingAppointmentPayload.patient_name,
                    service_ids: pendingAppointmentPayload.service_ids,
                    service_names: pendingAppointmentPayload.service_names,
                    notes: pendingAppointmentPayload.notes,
                    google_calendar_id: pendingAppointmentPayload.google_calendar_id,
                    quote_id: pendingAppointmentPayload.quote_id,
                } : undefined}
            />

            {/* Quick Quote Dialog */}
            <QuickQuoteDialog
                open={isQuickQuoteOpen}
                onOpenChange={setIsQuickQuoteOpen}
                user={appointment.user}
                onQuoteCreated={async (quote) => {
                    setUserQuotes(prev => [quote, ...prev]);
                    setAppointment(prev => ({ ...prev, quote }));

                    // Pre-load services from the newly created quote
                    setIsLoadingQuoteServices(true);
                    try {
                        const quoteServices = await getServicesByQuoteId(quote.id);
                        setAppointment(prev => ({ ...prev, services: quoteServices }));
                    } catch (error) {
                        console.error('Failed to load services from new quote:', error);
                    } finally {
                        setIsLoadingQuoteServices(false);
                    }
                }}
            />
        </Dialog>
    );
}

