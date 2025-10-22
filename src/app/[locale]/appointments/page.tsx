
'use client';

import * as React from 'react';
import { addDays, addMinutes, addMonths, format, parse, parseISO, isSameDay, isToday, isThisMonth, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Appointment, Calendar as CalendarType, User as UserType, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Calendar as CalendarIcon, User, Phone, Stethoscope, RefreshCw, CalendarDays, List, Search, ChevronsUpDown, Check, X, Edit, Trash2 } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { getAppointmentColumns } from './columns';
import { cn } from '@/lib/utils';
import { SortingState, ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


async function getAppointments(calendarGoogleIds: string[], startDate: Date, endDate: Date): Promise<Appointment[]> {
    const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');
    
    const params = new URLSearchParams({
        startingDateAndTime: formatDateForAPI(startDate),
        endingDateAndTime: formatDateForAPI(endDate),
    });
    
    if (calendarGoogleIds.length > 0) {
        params.append('calendar_ids', calendarGoogleIds.join(','));
    }

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users_appointments?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }

        const data = await response.json();
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
            
            return {
                id: apiAppt.id,
                patientName: apiAppt.patientName || (apiAppt.attendees && apiAppt.attendees.length > 0 ? apiAppt.attendees.map((a:any) => a.email).join(', ') : 'N/A'),
                patientEmail: apiAppt.patientEmail,
                doctorEmail: apiAppt.doctorEmail,
                service_name: apiAppt.summary || 'No Service Name',
                description: apiAppt.description || '',
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'HH:mm'),
                status: apiAppt.status || 'confirmed',
                patientPhone: apiAppt.patientPhone,
                doctorName: apiAppt.doctorName,
                calendar_id: apiAppt.organizer?.email,
                calendar_name: apiAppt.organizer?.displayName,
            };
        }).filter((apt): apt is Appointment => apt !== null);
    } catch (error) {
        console.error("Failed to fetch appointments:", error);
        return [];
    }
}

async function getCalendars(): Promise<CalendarType[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/calendars', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const calendarsData = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);
        return calendarsData.map((apiCalendar: any) => ({
            id: apiCalendar.id || apiCalendar.google_calendar_id,
            name: apiCalendar.name,
            google_calendar_id: apiCalendar.google_calendar_id,
            is_active: apiCalendar.is_active,
        }));
    } catch (error) {
        console.error("Failed to fetch calendars:", error);
        return [];
    }
}


export default function AppointmentsPage() {
  const t = useTranslations('AppointmentsPage');
  const tColumns = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tGeneral = useTranslations('General');
  const tUsers = useTranslations('UsersPage');

  const { toast } = useToast();

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = React.useState<string[]>([]);
  const [isCalendarsLoading, setIsCalendarsLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [dateFilter, setDateFilter] = React.useState<'today' | 'this_week' | 'this_month'>('today');
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'date', desc: false },
  ]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [calendarColors, setCalendarColors] = React.useState<{[key: string]: string}>({});
  const [fetchRange, setFetchRange] = React.useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [deletingAppointment, setDeletingAppointment] = React.useState<Appointment | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  
  // User Search State
  const [isUserSearchOpen, setUserSearchOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState('');
  const [userSearchResults, setUserSearchResults] = React.useState<UserType[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = React.useState(false);

  // Service Search State
  const [isServiceSearchOpen, setServiceSearchOpen] = React.useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = React.useState('');
  const [serviceSearchResults, setServiceSearchResults] = React.useState<Service[]>([]);
  const [isSearchingServices, setIsSearchingServices] = React.useState(false);
  
  // Doctor Search State
  const [isDoctorSearchOpen, setDoctorSearchOpen] = React.useState(false);
  const [doctorSearchQuery, setDoctorSearchQuery] = React.useState('');
  const [doctorSearchResults, setDoctorSearchResults] = React.useState<UserType[]>([]);
  const [isSearchingDoctors, setIsSearchingDoctors] = React.useState(false);


  // New Appointment Dialog State
  const [newAppointment, setNewAppointment] = React.useState({
    user: null as UserType | null,
    services: [] as Service[],
    doctor: null as UserType | null,
    calendar: null as CalendarType | null,
    date: '',
    time: '',
    description: '',
  });
  const [originalCalendarId, setOriginalCalendarId] = React.useState<string | undefined>(undefined);
  const [isCalendarSearchOpen, setCalendarSearchOpen] = React.useState(false);
  const [availabilityStatus, setAvailabilityStatus] = React.useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [suggestedTimes, setSuggestedTimes] = React.useState<any[]>([]);

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setOriginalCalendarId(appointment.calendar_id);
  };

  React.useEffect(() => {
    if (editingAppointment && calendars.length > 0) {
        let foundCalendar = calendars.find(c => c.id === editingAppointment.calendar_id);
        
        if (!foundCalendar) {
            foundCalendar = calendars.find(c => c.name === editingAppointment.calendar_name);
        }
        
        setNewAppointment({
            user: { id: '', name: editingAppointment.patientName, email: editingAppointment.patientEmail || '', phone_number: editingAppointment.patientPhone || '', is_active: true, avatar: ''}, // Mock user with email
            services: [{ id: '', name: editingAppointment.service_name, category: '', price: 0, duration_minutes: 30, is_active: true}], // Mock service
            doctor: editingAppointment.doctorEmail ? { id: '', name: editingAppointment.doctorName || '', email: editingAppointment.doctorEmail, phone_number: '', is_active: true, avatar: '' } : null,
            calendar: foundCalendar || null,
            date: editingAppointment.date,
            time: editingAppointment.time,
            description: editingAppointment.description || '',
        });
        setCreateOpen(true);
    }
  }, [editingAppointment, calendars]);

  const handleCancel = (appointment: Appointment) => {
      setDeletingAppointment(appointment);
      setIsDeleteAlertOpen(true);
  };
  
  const appointmentColumns: ColumnDef<Appointment>[] = React.useMemo(() => getAppointmentColumns({ t: tColumns, tStatus, onEdit: handleEdit, onCancel: handleCancel }), [tColumns, tStatus]);

  const suggestionColumns: ColumnDef<any>[] = [
    {
      id: 'select',
      cell: ({ row }) => (
        <RadioGroupItem value={row.id} id={row.id} />
      ),
    },
    { accessorKey: 'calendar', header: t('createDialog.suggested.calendar') },
    { accessorKey: 'doctor.name', header: tColumns('doctor') },
    { accessorKey: 'date', header: t('createDialog.suggested.date') },
    { accessorKey: 'time', header: t('createDialog.suggested.time') },
  ];

  const generateColor = (str: string | undefined) => {
    if (!str) return '#ccc';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return `#${"00000".substring(0, 6 - c.length)}${c}`;
  };

  React.useEffect(() => {
    const colors: {[key: string]: string} = {};
    calendars.forEach(cal => {
        if(cal.id) {
          colors[cal.id] = generateColor(cal.id);
        }
    });
    setCalendarColors(colors);
  }, [calendars]);

  const loadAppointments = React.useCallback(async () => {
    if (selectedCalendarIds.length === 0) {
        setAppointments([]);
        return;
    };
    setIsRefreshing(true);
    const googleCalendarIds = selectedCalendarIds.map(id => {
      const cal = calendars.find(c => c.id === id);
      return cal?.google_calendar_id;
    }).filter((id): id is string => !!id);

    const fetchedAppointments = await getAppointments(googleCalendarIds, fetchRange.from, fetchRange.to);
    setAppointments(fetchedAppointments);
    setIsRefreshing(false);
  }, [selectedCalendarIds, fetchRange, calendars]);
  
  const loadCalendars = React.useCallback(async () => {
    setIsCalendarsLoading(true);
    const fetchedCalendars = await getCalendars();
    setCalendars(fetchedCalendars);
    setSelectedCalendarIds(fetchedCalendars.map(c => c.id).filter(id => id));
    setIsCalendarsLoading(false);
  }, []);

  React.useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);
  
  React.useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);
  
  React.useEffect(() => {
    if (selectedDate) {
        const newFrom = startOfMonth(selectedDate);
        const newTo = endOfMonth(selectedDate);

        if (newFrom < fetchRange.from) {
            setFetchRange(prev => ({ from: newFrom, to: prev.to }));
        }
        if (newTo > fetchRange.to) {
            setFetchRange(prev => ({ from: prev.from, to: newTo }));
        }
    }
  }, [selectedDate, fetchRange.from, fetchRange.to]);


  const selectedDayAppointments = React.useMemo(() => {
    if (!selectedDate) return [];
    return appointments
      .filter(apt => isSameDay(parseISO(`${apt.date}T${apt.time}`), selectedDate))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDate]);
  
  const filteredAppointments = React.useMemo(() => {
    return appointments.filter(apt => {
        const aptDate = parseISO(`${apt.date}T${apt.time}`);
        switch (dateFilter) {
            case 'today':
                return isToday(aptDate);
            case 'this_week': {
                const now = new Date();
                const weekStart = startOfWeek(now, { weekStartsOn: 0 });
                const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
                return isWithinInterval(aptDate, { start: weekStart, end: weekEnd });
            }
            case 'this_month':
                return isThisMonth(aptDate);
            default:
                return true;
        }
    });
  }, [appointments, dateFilter]);
  
  const getStatusVariant = (status: Appointment['status']) => {
    return {
        completed: 'success',
        confirmed: 'default',
        pending: 'info',
        cancelled: 'destructive',
    }[status] || 'default';
  };

  const handleSelectAllCalendars = (checked: boolean | 'indeterminate') => {
    if (checked) {
        setSelectedCalendarIds(calendars.map(c => c.id).filter(id => id));
    } else {
        setSelectedCalendarIds([]);
    }
  };

  const handleCalendarSelection = (calendarId: string, checked: boolean) => {
    setSelectedCalendarIds(prev => 
        checked ? [...prev, calendarId] : prev.filter(id => id !== calendarId)
    );
  };
  
  // Debounced search effect for users
  React.useEffect(() => {
    const handler = setTimeout(async () => {
        if (userSearchQuery.length < 2) {
            setUserSearchResults([]);
            return;
        };
        setIsSearchingUsers(true);
        try {
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/filter_users?search=${userSearchQuery}`, {
            method: 'GET',
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
            },
          });
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          const data = await response.json();
          const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
          
          const mappedUsers = usersData.map((apiUser: any): UserType => ({
            id: apiUser.user_id ? String(apiUser.user_id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
            name: apiUser.name || 'No Name',
            email: apiUser.email || 'no-email@example.com',
            phone_number: apiUser.phone_number || '000-000-0000',
            is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
            avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
          }));
          setUserSearchResults(mappedUsers);
        } catch (error) {
          console.error("Failed to fetch users:", error);
          setUserSearchResults([]);
        } finally {
          setIsSearchingUsers(false);
        }
    }, 300);

    return () => {
        clearTimeout(handler);
    };
  }, [userSearchQuery]);

  // Debounced search effect for services
  React.useEffect(() => {
    const handler = setTimeout(async () => {
        if (!isServiceSearchOpen && serviceSearchQuery.length === 0) {
            if (isServiceSearchOpen) { // Load all if opened with no query
                // continue to fetch
            } else {
                setServiceSearchResults([]);
                return;
            }
        }
        setIsSearchingServices(true);
        try {
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services?search=${serviceSearchQuery}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
          });
          if (!response.ok) {
            throw new Error('Network response was not ok for services');
          }
          const data = await response.json();
          const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);
          
          const mappedServices = servicesData.map((apiService: any): Service => ({
            id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
            name: apiService.name || 'No Name',
            category: apiService.category || 'No Category',
            price: apiService.price || 0,
            duration_minutes: apiService.duration_minutes || 0,
            is_active: apiService.is_active,
          }));
          setServiceSearchResults(mappedServices);
        } catch (error) {
          console.error("Failed to fetch services:", error);
          setServiceSearchResults([]);
        } finally {
          setIsSearchingServices(false);
        }
    }, 300);

    return () => {
        clearTimeout(handler);
    };
  }, [serviceSearchQuery, isServiceSearchOpen]);
  
  // Debounced search effect for doctors
  React.useEffect(() => {
    const handler = setTimeout(async () => {
        if (!isDoctorSearchOpen && doctorSearchQuery.length === 0) {
            if (isDoctorSearchOpen) { // Load all if opened with no query
                 // continue to fetch
            } else {
                setDoctorSearchResults([]);
                return;
            }
        }
        setIsSearchingDoctors(true);
        try {
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users/doctors?search=${doctorSearchQuery}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
          });
          if (!response.ok) {
            throw new Error('Network response was not ok for doctors');
          }
          const data = await response.json();
          const doctorsData = Array.isArray(data) ? data : (data.doctors || data.data || []);
          
          const mappedDoctors = doctorsData.map((apiUser: any): UserType => ({
            id: apiUser.user_id ? String(apiUser.user_id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
            name: apiUser.name || 'No Name',
            email: apiUser.email || 'no-email@example.com',
            phone_number: apiUser.phone_number || '000-000-0000',
            is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
            avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
          }));
          setDoctorSearchResults(mappedDoctors);
        } catch (error) {
          console.error("Failed to fetch doctors:", error);
          setDoctorSearchResults([]);
        } finally {
          setIsSearchingDoctors(false);
        }
    }, 300);

    return () => {
        clearTimeout(handler);
    };
  }, [doctorSearchQuery, isDoctorSearchOpen]);

  React.useEffect(() => {
    if (isCreateOpen && !editingAppointment) {
      const tomorrow = addDays(new Date(), 1);
      setNewAppointment({
        user: null,
        services: [],
        doctor: null,
        calendar: null,
        date: format(tomorrow, 'yyyy-MM-dd'),
        time: '09:00',
        description: '',
      });
    }
  }, [isCreateOpen, editingAppointment]);

  const checkAvailability = React.useCallback(async () => {
    const { date, time, services, user, doctor, calendar } = newAppointment;
    if (!date || !time || (!user && !editingAppointment)) {
      return;
    }

    if (editingAppointment && editingAppointment.date === date && editingAppointment.time === time) {
        setAvailabilityStatus('available');
        return;
    }

    setAvailabilityStatus('checking');
    setSuggestedTimes([]);

    const startDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    const totalDuration = services.reduce((acc, service) => acc + (service.duration_minutes || 0), 0);
    const endDateTime = addMinutes(startDateTime, totalDuration);

    const attendeeEmails: string[] = [];
    if (user?.email) {
      attendeeEmails.push(user.email);
    } else if (editingAppointment?.patientEmail) {
      attendeeEmails.push(editingAppointment.patientEmail);
    }
    
    if (doctor?.email) {
      attendeeEmails.push(doctor.email);
    } else if (editingAppointment?.doctorEmail) {
      attendeeEmails.push(editingAppointment.doctorEmail);
    }
    
    const params: Record<string, string> = {
        startingDateAndTime: startDateTime.toISOString(),
        endingDateAndTime: endDateTime.toISOString(),
        mode: 'checkAvailability',
    };

    if (editingAppointment) {
        params.eventId = editingAppointment.id;
    }

    if (attendeeEmails.length > 0) {
        params.attendeesEmails = attendeeEmails.join(',');
    }
    
    if (calendar?.id) {
        params.calendarIds = calendar.id;
    }

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/appointments_availability?${new URLSearchParams(params).toString()}`, {
            method: 'GET',
            mode: 'cors',
        });
        if (!response.ok) {
            throw new Error('Failed to check availability');
        }
        const data = await response.json();
        
        let isAvailable = false;
        let suggestions: any[] = [];
    
        if (Array.isArray(data) && data.length > 0) {
            const result = data[0];
            isAvailable = result.isAvailable === true;
            
            if (result.suggestedTimes) {
                const allDocs = [...doctorSearchResults, ...result.suggestedTimes.map((s:any) => ({ id: s.json.user_id, name: s.json.user_name, email: s.json.user_email, is_active: true, phone_number: '', avatar: ''}))];
                const uniqueDocs = Array.from(new Map(allDocs.map(item => [item.id, item])).values());
                setDoctorSearchResults(uniqueDocs);

                suggestions = result.suggestedTimes.map((suggestion: any, index: number) => ({
                    id: `sugg-${suggestion.json.user_id}-${index}`,
                    calendar: suggestion.json.calendario,
                    date: suggestion.json.fecha_cita,
                    time: suggestion.json.hora_cita,
                    doctor: {
                        id: suggestion.json.user_id,
                        name: suggestion.json.user_name || t('createDialog.none'),
                        email: suggestion.json.user_email,
                    },
                }));
            }
        }

        setAvailabilityStatus(isAvailable ? 'available' : 'unavailable');
        setSuggestedTimes(suggestions);
    } catch (error) {
        console.error("Failed to check availability:", error);
        setAvailabilityStatus('idle');
    }
  }, [newAppointment.date, newAppointment.time, newAppointment.services, newAppointment.user, newAppointment.doctor, newAppointment.calendar, editingAppointment, t, doctorSearchResults]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      checkAvailability();
    }, 500);
    return () => clearTimeout(handler);
  }, [
    newAppointment.date,
    newAppointment.time,
    newAppointment.services,
    newAppointment.user,
    newAppointment.doctor,
    newAppointment.calendar,
    editingAppointment
  ]);

  const handleSaveAppointment = async () => {
    const { user, doctor, services, calendar, date, time, description } = newAppointment;
    if (!user || (!editingAppointment && services.length === 0) || !date || !time) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill out all required fields.",
      });
      return;
    }

    const startDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    const totalDuration = services.reduce((acc, service) => acc + (service.duration_minutes || 0), 0);
    const endDateTime = addMinutes(startDateTime, totalDuration);

    const payload: any = {
      startingDateAndTime: startDateTime.toISOString(),
      endingDateAndTime: endDateTime.toISOString(),
      doctorId: doctor?.id || '',
      doctorEmail: doctor?.email || '',
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      serviceName: services.map(s => s.name).join(', '),
      description: description || services.map(s => s.name).join(', '),
      mode: editingAppointment ? 'update' : 'create',
    };

    if (calendar) {
        payload.calendarId = calendar.id;
    } else {
        payload.calendarId = calendars.map(c => c.id).join(',');
    }

    if (editingAppointment) {
      payload.eventId = editingAppointment.id;
      payload.oldCalendarId = originalCalendarId;
    }

    try {
      const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/appointments/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      const result = Array.isArray(responseData) ? responseData[0] : responseData;


      if (response.ok && (result.code === 200 || result.status === 'success')) {
        toast({
          title: editingAppointment ? "Appointment Updated" : "Appointment Created",
          description: result.message || `The appointment has been successfully ${editingAppointment ? 'updated' : 'saved'}.`,
        });

        setCreateOpen(false);
        setEditingAppointment(null);
        setOriginalCalendarId(undefined);
        loadAppointments();
      } else {
        const errorDetails = result?.error || result;
        const errorMessage = errorDetails?.description || errorDetails?.message || 'An unknown error occurred.';
        if (errorMessage.includes("No existe disponibilidad")) {
            toast({
                variant: "destructive",
                title: "Slot Unavailable",
                description: "The selected time is no longer available. Please choose a different time.",
            });
            checkAvailability(); // Re-check for new suggestions
        } else {
            throw new Error(errorMessage);
        }
      }

    } catch (error) {
      console.error("Error saving appointment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };
  
  const confirmDeleteAppointment = async () => {
    if (!deletingAppointment) return;
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/appointments/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: deletingAppointment.id, calendarId: deletingAppointment.calendar_id }),
        });

        const responseData = await response.json();
        const result = Array.isArray(responseData) ? responseData[0] : responseData;

        if (response.ok && result.code === 200) {
            toast({
                title: "Appointment Cancelled",
                description: result.message || "The appointment has been successfully cancelled.",
            });
            setIsDeleteAlertOpen(false);
            setDeletingAppointment(null);
            loadAppointments();
        } else {
            const errorMessage = result.message || 'Failed to delete appointment';
            throw new Error(errorMessage);
        }
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : "Could not cancel the appointment.",
        });
    }
};


  return (
    <>
      <Card>
        <Tabs defaultValue="calendar">
            <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <TooltipProvider>
                    <TabsList>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <TabsTrigger value="calendar">
                                    <CalendarDays className="h-4 w-4" />
                                    <span className="sr-only">{t('calendarView')}</span>
                                </TabsTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('calendarView')}</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <TabsTrigger value="list">
                                    <List className="h-4 w-4" />
                                    <span className="sr-only">{t('listView')}</span>
                                </TabsTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('listView')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TabsList>
                </TooltipProvider>
            </div>
            </CardHeader>
            <CardContent>
                <TabsContent value="calendar" className="pt-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
                    <div className="space-y-4">
                    
                    <Card>
                        <CardContent className="p-0 flex justify-center">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                className="rounded-md w-auto"
                                initialFocus
                            />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5"/>
                            {t('calendars')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isCalendarsLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-5 w-full" />
                            </div>
                            ) : (
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id="select-all"
                                        checked={selectedCalendarIds.length === calendars.filter(c => c.id).length}
                                        onCheckedChange={handleSelectAllCalendars}
                                    />
                                    <Label htmlFor="select-all" className="font-semibold">{t('selectAll')}</Label>
                                </div>
                                <Separator />
                                <ScrollArea className="h-32">
                                    {calendars.map(calendar => (
                                      <div key={calendar.id} className="flex items-center space-x-2 py-1">
                                          <Checkbox 
                                              id={calendar.id}
                                              checked={selectedCalendarIds.includes(calendar.id)}
                                              onCheckedChange={(checked) => handleCalendarSelection(calendar.id, !!checked)}
                                          />
                                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: calendar.id ? calendarColors[calendar.id] : '#ccc' }} />
                                          <Label htmlFor={calendar.id}>{calendar.name}</Label>
                                      </div>
                                    ))}
                                </ScrollArea>
                            </div>
                            )}
                        </CardContent>
                        </Card>
                    </div>
                    <div className="flex flex-col">
                    <Card className="flex-1 flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>
                                {t('appointmentsFor', {date: selectedDate ? format(selectedDate, 'PPP') : '...'})}
                            </CardTitle>
                             <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCreateOpen(true)}
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    <span className="sr-only">{t('newAppointment')}</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={loadAppointments}
                                    disabled={isRefreshing}
                                >
                                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    <span className="sr-only">Refresh</span>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0">
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-4">
                                {selectedDayAppointments.length > 0 ? (
                                selectedDayAppointments.map((apt) => (
                                    <div key={apt.id} className="group flex items-start space-x-4 rounded-lg border bg-card text-card-foreground shadow-sm p-4 relative overflow-hidden">
                                        <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: apt.calendar_id ? calendarColors[apt.calendar_id] : '#ccc' }} />
                                        <div className="pl-4 w-full">
                                            <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={getStatusVariant(apt.status) as any} className="capitalize text-xs">{tStatus(apt.status.toLowerCase())}</Badge>
                                                <p className="font-semibold">{apt.service_name}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">{apt.time}</p>
                                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(apt)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleCancel(apt)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            </div>
                                            <Separator className="my-2" />
                                            <div className="text-sm text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                <span>{apt.patientName}</span>
                                            </div>
                                            {apt.patientPhone && (
                                                <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4" />
                                                <span>{apt.patientPhone}</span>
                                                </div>
                                            )}
                                            <div className="col-span-2 flex items-center gap-2">
                                                <Stethoscope className="w-4 h-4" />
                                                <span>Dr. {apt.doctorName || 'N/A'}</span>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2">
                                                <CalendarIcon className="w-4 h-4" />
                                                <span>{apt.calendar_name || 'N/A'}</span>
                                            </div>
                                            </div>
                                        </div>
                                    </div>
                                    ))
                                ) : (
                                <p className="text-center text-muted-foreground h-full flex items-center justify-center">{t('noAppointments')}</p>
                                )}
                            </div>
                        </ScrollArea>
                        </CardContent>
                    </Card>
                    </div>
                </div>
                </TabsContent>
                <TabsContent value="list" className="pt-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant={dateFilter === 'today' ? 'default' : 'outline'}
                            onClick={() => setDateFilter('today')}
                        >
                            {t('today')}
                        </Button>
                        <Button
                            variant={dateFilter === 'this_week' ? 'default' : 'outline'}
                            onClick={() => setDateFilter('this_week')}
                        >
                            {t('thisWeek')}
                        </Button>
                        <Button
                            variant={dateFilter === 'this_month' ? 'default' : 'outline'}
                            onClick={() => setDateFilter('this_month')}
                        >
                            {t('thisMonth')}
                        </Button>
                    </div>
                <DataTable 
                    columns={appointmentColumns} 
                    data={filteredAppointments} 
                    filterColumnId='service_name'
                    filterPlaceholder={t('filterByService')}
                    sorting={sorting}
                    onSortingChange={setSorting}
                    onRefresh={loadAppointments}
                    isRefreshing={isRefreshing}
                    onCreate={() => setCreateOpen(true)}
                />
                </TabsContent>
            </CardContent>
        </Tabs>
      </Card>
      <Dialog open={isCreateOpen} onOpenChange={(isOpen) => { setCreateOpen(isOpen); if (!isOpen) {setEditingAppointment(null); setOriginalCalendarId(undefined); }}}>
        <DialogContent className={cn("sm:max-w-md", !editingAppointment && availabilityStatus === 'unavailable' && suggestedTimes.length > 0 && "sm:max-w-4xl")}>
          <DialogHeader>
            <DialogTitle>{editingAppointment ? tColumns('edit') : t('createDialog.title')}</DialogTitle>
            <DialogDescription>{t('createDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className={cn("grid gap-8 py-4", !editingAppointment && availabilityStatus === 'unavailable' && suggestedTimes.length > 0 && "grid-cols-2")}>
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="patientName" className="text-right">{t('createDialog.userName')}</Label>
                <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isUserSearchOpen}
                          className="w-[300px] justify-between col-span-3"
                          disabled={!!editingAppointment}
                      >
                          {newAppointment.user
                          ? newAppointment.user.name
                          : t('createDialog.selectUser')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                      <Command>
                          <CommandInput 
                              placeholder={t('createDialog.searchUserPlaceholder')}
                              value={userSearchQuery}
                              onValueChange={setUserSearchQuery}
                          />
                          <CommandList>
                              <CommandEmpty>
                                  {isSearchingUsers ? t('createDialog.searching') : tGeneral('noResults')}
                              </CommandEmpty>
                              <CommandGroup>
                                  {userSearchResults.map((user) => (
                                  <CommandItem
                                      key={user.id}
                                      value={user.name}
                                      onSelect={() => {
                                          setNewAppointment(prev => ({...prev, user}));
                                          setUserSearchQuery(user.name);
                                          setUserSearchOpen(false);
                                      }}
                                  >
                                      <Check
                                          className={cn(
                                          "mr-2 h-4 w-4",
                                          newAppointment.user?.id === user.id ? "opacity-100" : "opacity-0"
                                          )}
                                      />
                                      {user.name}
                                  </CommandItem>
                                  ))}
                              </CommandGroup>
                          </CommandList>
                      </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {!editingAppointment && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="service_name" className="text-right pt-2">{t('createDialog.serviceName')}</Label>
                  <div className="col-span-3">
                    <Popover open={isServiceSearchOpen} onOpenChange={setServiceSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isServiceSearchOpen}
                          className="w-full justify-between"
                        >
                          {newAppointment.services.length > 0 ? t('createDialog.servicesSelected', { count: newAppointment.services.length }) : t('createDialog.selectServices')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput
                            placeholder={t('createDialog.searchServicePlaceholder')}
                            value={serviceSearchQuery}
                            onValueChange={setServiceSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {isSearchingServices ? t('createDialog.searching') : tGeneral('noResults')}
                            </CommandEmpty>
                            <CommandGroup>
                              {serviceSearchResults.map((service) => (
                                <CommandItem
                                  key={service.id}
                                  value={service.name}
                                  onSelect={() => {
                                    setNewAppointment(prev => {
                                      const isSelected = prev.services.some(s => s.id === service.id);
                                      if (isSelected) {
                                        return { ...prev, services: prev.services.filter(s => s.id !== service.id) };
                                      } else {
                                        return { ...prev, services: [...prev.services, service] };
                                      }
                                    });
                                    setServiceSearchQuery('');
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newAppointment.services.some(s => s.id === service.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {service.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newAppointment.services.map((service) => (
                        <Badge key={service.id} variant="secondary" className="flex items-center gap-1">
                          {service.name}
                          <button
                            onClick={() => setNewAppointment(prev => ({
                              ...prev,
                              services: prev.services.filter(s => s.id !== service.id)
                            }))}
                            className="rounded-full hover:bg-background"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="doctorName" className="text-right">{tColumns('doctor')}</Label>
                <Popover open={isDoctorSearchOpen} onOpenChange={setDoctorSearchOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isDoctorSearchOpen}
                          className="w-[300px] justify-between col-span-3"
                      >
                          {newAppointment.doctor ? newAppointment.doctor.name : t('createDialog.selectDoctor')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                      <Command>
                          <CommandInput 
                              placeholder={t('createDialog.searchDoctorPlaceholder')}
                              value={doctorSearchQuery}
                              onValueChange={setDoctorSearchQuery}
                          />
                          <CommandList>
                              <CommandEmpty>
                                  {isSearchingDoctors ? t('createDialog.searching') : tGeneral('noResults')}
                              </CommandEmpty>
                              <CommandGroup>
                                    <CommandItem onSelect={() => { setNewAppointment(prev => ({...prev, doctor: null})); setDoctorSearchOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", !newAppointment.doctor ? "opacity-100" : "opacity-0" )}/>
                                        {t('createDialog.none')}
                                    </CommandItem>
                                  {doctorSearchResults.map((doctor) => (
                                  <CommandItem
                                      key={doctor.id}
                                      value={doctor.name}
                                      onSelect={() => {
                                          setNewAppointment(prev => ({...prev, doctor}));
                                          setDoctorSearchQuery(doctor.name);
                                          setDoctorSearchOpen(false);
                                      }}
                                  >
                                      <Check
                                          className={cn(
                                          "mr-2 h-4 w-4",
                                          newAppointment.doctor?.id === doctor.id ? "opacity-100" : "opacity-0"
                                          )}
                                      />
                                      {doctor.name}
                                  </CommandItem>
                                  ))}
                              </CommandGroup>
                          </CommandList>
                      </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="calendar" className="text-right">{t('createDialog.calendar')}</Label>
                <Popover open={isCalendarSearchOpen} onOpenChange={setCalendarSearchOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isCalendarSearchOpen}
                          className="w-[300px] justify-between col-span-3"
                      >
                          {newAppointment.calendar ? newAppointment.calendar.name : t('createDialog.allCalendars')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                      <Command>
                          <CommandList>
                              <CommandEmpty>{tGeneral('noResults')}</CommandEmpty>
                              <CommandGroup>
                                    <CommandItem onSelect={() => { setNewAppointment(prev => ({...prev, calendar: null})); setCalendarSearchOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", !newAppointment.calendar ? "opacity-100" : "opacity-0" )}/>
                                        {t('createDialog.allCalendars')}
                                    </CommandItem>
                                  {calendars.map((calendar) => (
                                  <CommandItem
                                      key={calendar.id}
                                      value={calendar.name}
                                      onSelect={() => {
                                          setNewAppointment(prev => ({...prev, calendar}));
                                          setCalendarSearchOpen(false);
                                      }}
                                  >
                                      <Check
                                          className={cn(
                                          "mr-2 h-4 w-4",
                                          newAppointment.calendar?.id === calendar.id ? "opacity-100" : "opacity-0"
                                          )}
                                      />
                                      {calendar.name}
                                  </CommandItem>
                                  ))}
                              </CommandGroup>
                          </CommandList>
                      </Command>
                  </PopoverContent>
                </Popover>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">{t('createDialog.date')}</Label>
                <Input id="date" type="date" className="col-span-3" value={newAppointment.date} onChange={e => setNewAppointment(prev => ({...prev, date: e.target.value}))} />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="time" className="text-right">{t('createDialog.time')}</Label>
                <Input 
                    id="time" 
                    type="time" 
                    className={cn(
                        "col-span-3",
                        availabilityStatus === 'unavailable' && 'border-destructive focus-visible:ring-destructive',
                        availabilityStatus === 'checking' && 'animate-pulse'
                    )}
                    value={newAppointment.time} 
                    onChange={e => setNewAppointment(prev => ({...prev, time: e.target.value}))}
                />
              </div>
              {editingAppointment && (
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="description" className="text-right pt-2">{t('createDialog.descriptionLabel')}</Label>
                    <Textarea 
                        id="description" 
                        className="col-span-3 h-24" 
                        value={newAppointment.description} 
                        onChange={(e) => setNewAppointment(prev => ({...prev, description: e.target.value}))} 
                    />
                </div>
              )}
            </div>
            {!editingAppointment && availabilityStatus === 'unavailable' && suggestedTimes.length > 0 && (
                <div className="border-l pl-8">
                    <h4 className="font-semibold mb-4">{t('createDialog.suggestedTimes')}</h4>
                    <RadioGroup onValueChange={(value) => {
                        const suggestion = suggestedTimes.find(s => s.id === value);
                        if (suggestion) {
                            const fullDoctorObject = doctorSearchResults.find(d => d.id === suggestion.doctor.id) || null;
                            setNewAppointment(prev => ({
                                ...prev,
                                date: suggestion.date,
                                time: suggestion.time,
                                calendar: calendars.find(c => c.name === suggestion.calendar) || prev.calendar,
                                doctor: fullDoctorObject,
                            }))
                        }
                    }}>
                        <ScrollArea className="h-64">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead></TableHead>
                                        <TableHead>{t('createDialog.suggested.calendar')}</TableHead>
                                        <TableHead>{tColumns('doctor')}</TableHead>
                                        <TableHead>{t('createDialog.suggested.date')}</TableHead>
                                        <TableHead>{t('createDialog.suggested.time')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suggestedTimes.length > 0 ? (
                                        suggestedTimes.map((suggestion) => (
                                            <TableRow key={suggestion.id}>
                                                <TableCell><RadioGroupItem value={suggestion.id} id={suggestion.id} /></TableCell>
                                                <TableCell>{suggestion.calendar}</TableCell>
                                                <TableCell>{suggestion.doctor.name}</TableCell>
                                                <TableCell>{suggestion.date}</TableCell>
                                                <TableCell>{suggestion.time}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                {availabilityStatus === 'checking' ? t('createDialog.searching') : tGeneral('noResults')}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </RadioGroup>
                </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setCreateOpen(false); setEditingAppointment(null);}}>{t('createDialog.cancel')}</Button>
            <Button onClick={handleSaveAppointment}>{editingAppointment ? tColumns('edit') : t('createDialog.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
              <AlertDialogTitle>{t('createDialog.cancelAppointmentTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                  {t('createDialog.cancelAppointmentDescription', { serviceName: deletingAppointment?.service_name, date: deletingAppointment?.date })}
              </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingAppointment(null)}>{t('createDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteAppointment} className="bg-destructive hover:bg-destructive/90">{tColumns('cancel')}</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    