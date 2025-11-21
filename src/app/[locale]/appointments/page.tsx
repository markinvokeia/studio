
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
    doctors: UserType[]
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
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users_appointments?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
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
            
            const calendarId = apiAppt.organizer?.email;
            const calendar = calendars.find(c => c.google_calendar_id === calendarId);

            const appointmentColorId = apiAppt.colorId;
            const service = services.find(s => s.name === apiAppt.summary);
            const doctor = doctors.find(d => d.email === apiAppt.doctorEmail);

            let finalColor = colorMap.get(appointmentColorId) || service?.color || doctor?.color || calendar?.color;

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
                calendar_id: calendarId,
                calendar_name: apiAppt.organizer?.displayName,
                color: finalColor,
                colorId: appointmentColorId,
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
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
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
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services?is_sales=true', {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);
    return servicesData.map((s: any) => ({ ...s, id: String(s.id) }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

async function getDoctors(): Promise<UserType[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?filter_type=DOCTOR', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    const responseData = (Array.isArray(data) && data.length > 0) ? data[0] : { data: [], total: 0 };
    const doctorsData = Array.isArray(responseData.data) ? responseData.data : [];
    return doctorsData.map((d: any) => ({ ...d, id: String(d.id) }));
  } catch (error) {
    console.error("Failed to fetch doctors:", error);
    return [];
  }
}

async function getDoctorServices(doctorId: string): Promise<Service[]> {
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services/user_services?user_id=${doctorId}`);
    if (!response.ok) return [];
    const data = await response.json();
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
  
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = React.useState(false);

  const [assignees, setAssignees] = React.useState<UserType[]>([]);
  const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>([]);
  const [group, setGroup] = React.useState(false);


  // New Appointment Dialog State
  const [newAppointment, setNewAppointment] = React.useState({
    user: null as UserType | null,
    services: [] as Service[],
    doctor: null as UserType | null,
    calendar: null as CalendarType | null,
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    description: '',
  });
  const [originalCalendarId, setOriginalCalendarId] = React.useState<string | undefined>(undefined);
  const [isCalendarSearchOpen, setCalendarSearchOpen] = React.useState(false);
  const [availabilityStatus, setAvailabilityStatus] = React.useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [suggestedTimes, setSuggestedTimes] = React.useState<any[]>([]);
  const [currentView, setCurrentView] = React.useState('month');

  React.useEffect(() => {
    if (isCreateOpen && !editingAppointment) {
      setNewAppointment({
        user: null,
        services: [],
        doctor: null,
        calendar: null,
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        description: '',
      });
    }
  }, [isCreateOpen, editingAppointment]);

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
    setOriginalCalendarId(appointment.calendar_id);
  };

  React.useEffect(() => {
    if (editingAppointment && calendars.length > 0) {
        let foundCalendar = calendars.find(c => c.google_calendar_id === editingAppointment.calendar_id);
        
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

  const loadAppointments = React.useCallback(async () => {
    if (!fetchRange || !fetchRange.start || !fetchRange.end || !isValid(fetchRange.start) || !isValid(fetchRange.end) || calendars.length === 0) {
      return;
    }
    
    setIsRefreshing(true);
    const googleCalendarIds = selectedCalendarIds.map(id => {
      const cal = calendars.find(c => c.id === id);
      return cal?.google_calendar_id;
    }).filter((id): id is string => !!id);
    
    const fetchedAppointments = await getAppointments(googleCalendarIds, fetchRange.start, fetchRange.end, calendars, services, doctors);
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
        if(doctor.id) {
            const doctorServices = await getDoctorServices(doctor.id);
            serviceMap.set(doctor.id, doctorServices);
        }
    }
    setDoctorServiceMap(serviceMap);
    
    setSelectedAssignees(fetchedDoctors.map(d => d.id));
    setSelectedCalendarIds(fetchedCalendars.map(c => c.id).filter(id => id));
    setIsDataLoading(false);
  }, []);

  const filteredDoctors = React.useMemo(() => {
    if (newAppointment.services.length === 0) {
      return doctors;
    }
    const selectedServiceIds = new Set(newAppointment.services.map(s => s.id));
    
    return doctors.filter(doctor => {
        const doctorServices = doctorServiceMap.get(doctor.id);
        if (!doctorServices) return false;
        
        // Check if the doctor provides ANY of the selected services
        return Array.from(selectedServiceIds).some(selectedId => 
            doctorServices.some(ds => String(ds.id) === String(selectedId))
        );
    });
  }, [doctors, newAppointment.services, doctorServiceMap]);


  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);
  
  React.useEffect(() => {
    if (!isDataLoading && fetchRange) {
      loadAppointments();
    }
  }, [loadAppointments, selectedCalendarIds, fetchRange, isDataLoading]);
  
  
  // Debounced search effect for users
  React.useEffect(() => {
    const handler = setTimeout(async () => {
        if (userSearchQuery.length < 2) {
            setUserSearchResults([]);
            return;
        };
        setIsSearchingUsers(true);
        try {
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?search=${userSearchQuery}&filter_type=PACIENTE`, {
            method: 'GET',
            mode: 'cors',
          });
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          const data = await response.json();
          const responseData = (Array.isArray(data) && data.length > 0) ? data[0] : { data: [], total: 0 };
          const usersData = Array.isArray(responseData.data) ? responseData.data : [];
          
          const mappedUsers = usersData.map((apiUser: any): UserType => ({
            id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
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
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services?search=${serviceSearchQuery}&is_sales=true`, {
            method: 'GET',
            mode: 'cors',
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

  const checkAvailability = React.useCallback(async (appointmentData: typeof newAppointment) => {
    const { date, time, services, user, doctor, calendar } = appointmentData;
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
    
    const endDateTime = addMinutes(startDateTime, totalDuration);

    const attendeeEmails = [];
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

    if(doctor?.email) {
      params.doctorEmail = doctor.email;
    }
    
    if (editingAppointment) {
        params.eventId = editingAppointment.id;
    }

    if (attendeeEmails.length > 0) {
        params.attendeesEmails = attendeeEmails.join(',');
    }
    
    if (calendar?.google_calendar_id) {
        params.calendarIds = calendar.google_calendar_id;
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
        let suggestions = [];
    
        if (Array.isArray(data) && data.length > 0) {
            const result = data[0];
            isAvailable = result.isAvailable === true;
            
            if (result.suggestedTimes) {
                
                const processedSuggestions = result.suggestedTimes.flatMap((suggestion:any, suggestionIndex:number) => {
                    const doctorsInSuggestion = suggestion.json.user_name.split(',').map((name:string) => name.trim());
                    const doctorIds = suggestion.json.user_id.split(',');
                    const doctorEmails = suggestion.json.user_email.split(',');

                    return doctorsInSuggestion.map((docName:string, docIndex:number) => ({
                        id: `sugg-${doctorIds[docIndex]}-${suggestion.json.fecha_cita}-${suggestion.json.hora_cita}-${suggestionIndex}-${docIndex}`,
                        calendar: suggestion.json.calendario,
                        date: suggestion.json.fecha_cita,
                        time: suggestion.json.hora_cita,
                        doctor: {
                            id: doctorIds[docIndex],
                            name: docName,
                            email: doctorEmails[docIndex],
                        },
                    }));
                });
                suggestions = processedSuggestions;
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
    const { date, time } = newAppointment;
    if (date && time) {
        checkAvailability(newAppointment);
    }
  }, [newAppointment, checkAvailability]);


  const handleSaveAppointment = async (appointmentDetails: Partial<Appointment> & {colorId?: string}) => {
    const isEditing = !!(appointmentDetails.id || editingAppointment);
    const currentAppointment = isEditing ? { ...editingAppointment, ...appointmentDetails } : null;

    let payload: any;
    
    const { user, doctor, services, calendar, date, time, description } = newAppointment;

    if (!date || !time) {
        toast({ variant: "destructive", title: "Missing Information", description: "Date and time are required." });
        return;
    }

    const startDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());

    let totalDuration = 0;
    if (doctor && services.length > 0) {
        const doctorServices = doctorServiceMap.get(doctor.id);
        if(doctorServices){
            totalDuration = services.reduce((acc, service) => {
                const docService = doctorServices.find(ds => ds.id === service.id);
                // Use doctor-specific duration if available, otherwise fall back to general service duration
                return acc + (docService?.duration_minutes || service.duration_minutes || 0);
            }, 0);
        }
    } else {
        totalDuration = services.reduce((acc, service) => acc + (service.duration_minutes || 0), 0);
    }
    
    if (isEditing && totalDuration === 0) {
      // For edits, if no service info is available, use a default to avoid 0 duration
      totalDuration = 30;
    }
    
    const endDateTime = addMinutes(startDateTime, totalDuration);
    
    payload = {
        startingDateAndTime: startDateTime.toISOString(),
        endingDateAndTime: endDateTime.toISOString(),
        mode: isEditing ? 'update' : 'create',
        ...(appointmentDetails.colorId && { colorId: appointmentDetails.colorId }),
    };

    if (isEditing && currentAppointment) {
        payload.eventId = currentAppointment.id;
        if (originalCalendarId) {
            payload.oldCalendarId = originalCalendarId;
        }
        payload.doctorId = doctor?.id || '';
        payload.doctorEmail = doctor?.email || currentAppointment.doctorEmail;
        payload.userId = user?.id || '';
        payload.userEmail = user?.email || currentAppointment.patientEmail;
        payload.userName = user?.name || currentAppointment.patientName;
        payload.serviceName = services.length > 0 ? services.map(s => s.name).join(', ') : currentAppointment.service_name;
        payload.description = description || currentAppointment.description || services.map(s => s.name).join(', ');
        if (calendar?.google_calendar_id) {
            payload.calendarId = calendar.google_calendar_id;
        } else if (originalCalendarId) {
            payload.calendarId = originalCalendarId;
        }
    } else { // Creating new
        if (!user || services.length === 0) {
            toast({ variant: "destructive", title: "Missing Information", description: "Please fill out all required fields."});
            return;
        }
        payload.doctorId = doctor?.id || '';
        payload.doctorEmail = doctor?.email || '';
        payload.userId = user.id;
        payload.userEmail = user.email;
        payload.userName = user.name;
        payload.serviceName = services.map(s => s.name).join(', ');
        payload.description = description || services.map(s => s.name).join(', ');
        if (calendar?.google_calendar_id) {
          payload.calendarId = calendar.google_calendar_id;
        }
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
        const successTitle = isEditing ? "Appointment Updated" : "Appointment Created";
        toast({
          title: successTitle,
          description: result.message || `The appointment has been successfully ${isEditing ? 'updated' : 'saved'}.`,
        });

        setCreateOpen(false);
        setEditingAppointment(null);
        setOriginalCalendarId(undefined);
        
        forceRefresh();
      } else {
        const errorDetails = result?.error || result;
        const errorMessage = errorDetails?.description || errorDetails?.message || 'An unknown error occurred.';
        if (errorMessage.includes("No existe disponibilidad")) {
            toast({
                variant: "destructive",
                title: "Slot Unavailable",
                description: "The selected time is no longer available. Please choose a different time.",
            });
            checkAvailability(newAppointment);
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: errorMessage,
            });
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
      const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/appointments/update_color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      if (!response.ok || (responseData.error || (responseData.code && responseData.code >= 400))) {
        throw new Error(responseData.message || 'Failed to update color');
      }

      toast({
        title: "Color Updated",
        description: `The appointment color has been updated.`,
      });
      forceRefresh(); // Re-fetch to confirm state
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error updating color',
        description: error instanceof Error ? error.message : 'Could not update appointment color.',
      });
      // Revert optimistic update on failure
      forceRefresh();
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

        if (response.ok && (result.code === 200 || result.success)) {
            toast({
                title: "Appointment Cancelled",
                description: result.message || "The appointment has been successfully cancelled.",
            });
            setIsDeleteAlertOpen(false);
            setDeletingAppointment(null);
            forceRefresh();
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

  const onDateChange = React.useCallback((newRange: { start: Date; end: Date }) => {
    setFetchRange(newRange);
  }, []);

  const calendarEvents = React.useMemo(() => {
    return appointments.map(appt => {
      if (!appt.date || !appt.time) return null;
      try {
        const start = parse(`${appt.date} ${appt.time}`, 'yyyy-MM-dd HH:mm', new Date());
        if(!isValid(start)) return null;
        
        let totalDuration = 30; // Default duration
        if(appt.doctorEmail && services.length > 0) {
            const doctor = doctors.find(d => d.email === appt.doctorEmail);
            if (doctor) {
                const doctorServices = doctorServiceMap.get(doctor.id);
                if(doctorServices){
                    const serviceNames = appt.service_name.split(',').map(s => s.trim());
                    const relatedDoctorServices = doctorServices.filter(ds => serviceNames.includes(ds.name));
                    if(relatedDoctorServices.length > 0) {
                        totalDuration = relatedDoctorServices.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
                    }
                }
            }
        }
        const end = addMinutes(start, totalDuration > 0 ? totalDuration : 30);

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
        console.error("Error parsing date/time for appointment", appt);
        return null;
      }
    }).filter(Boolean) as ({ id: string; title: string; start: Date; end: Date; assignee: string | undefined; data: Appointment; color?: string; colorId?: string })[];
  }, [appointments, doctors, services, doctorServiceMap]);

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
        >
            <div className="flex items-center gap-2">
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => setCreateOpen(true)}>
                                <PlusCircle className="h-4 w-4" />
                                <span className="sr-only">{t('newAppointment')}</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{t('newAppointment')}</p>
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
                                    <CommandItem onSelect={() => setSelectedCalendarIds([])}>Deselect All</CommandItem>
                                    <hr className="my-2" />
                                    {calendars.map((calendar) => (
                                        <CommandItem key={calendar.id} onSelect={(e) => e.preventDefault()}>
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
                                    Assignees
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2">
                                <Command>
                                    <CommandList>
                                        <CommandGroup>
                                            <CommandItem onSelect={(e) => e.preventDefault()} className="flex items-center gap-2">
                                                <Checkbox id="group-by-assignee" checked={group} onCheckedChange={(checked) => setGroup(typeof checked === 'boolean' ? checked : false)} disabled={selectedAssignees.length === 0} />
                                                <Label htmlFor="group-by-assignee" className={cn(selectedAssignees.length === 0 && 'text-muted-foreground')}>Group by Assignee</Label>
                                            </CommandItem>
                                            <hr className="my-2" />
                                            <CommandItem onSelect={() => setSelectedAssignees(assignees.map(a => a.id))}>Select All</CommandItem>
                                            <CommandItem onSelect={() => setSelectedAssignees([])}>Deselect All</CommandItem>
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
      <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>{editingAppointment ? tColumns('edit') : t('createDialog.title')}</DialogTitle>
            <DialogDescription>{t('createDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            {/* Left Column */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>{t('createDialog.userName')}</Label>
                    <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                                {newAppointment.user ? newAppointment.user.name : t('createDialog.selectUser')}
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
                                        <CommandItem
                                            key={user.id}
                                            value={user.name}
                                            onSelect={() => {
                                                setNewAppointment(prev => ({...prev, user}));
                                                setUserSearchOpen(false);
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", newAppointment.user?.id === user.id ? "opacity-100" : "opacity-0")}/>
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
                                {newAppointment.services.length > 0 ? t('createDialog.servicesSelected', { count: newAppointment.services.length }) : t('createDialog.selectServices')}
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
                                        <CommandItem
                                            key={service.id}
                                            value={service.name}
                                            onSelect={() => {
                                                setNewAppointment(prev => {
                                                    const isSelected = prev.services.some(s => s.id === service.id);
                                                    if (isSelected) {
                                                        return {...prev, services: prev.services.filter(s => s.id !== service.id)};
                                                    } else {
                                                        return {...prev, services: [...prev.services, service]};
                                                    }
                                                });
                                            }}
                                        >
                                            <Checkbox
                                                checked={newAppointment.services.some(s => s.id === service.id)}
                                                className="mr-2"
                                            />
                                            <span>{service.name}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {newAppointment.services.length > 0 && (
                      <div className="p-2 border rounded-md mt-2">
                          <Label className="text-xs text-muted-foreground">{t('createDialog.selectedServices')}</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                          {newAppointment.services.map(service => (
                              <Badge key={service.id} variant="secondary">
                                  {service.name}
                                  <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-transparent" onClick={() => setNewAppointment(prev => ({...prev, services: prev.services.filter(s => s.id !== service.id)}))}>
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
                                {newAppointment.doctor ? newAppointment.doctor.name : t('createDialog.selectDoctor')}
                                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                                <CommandInput placeholder={t('createDialog.searchDoctorPlaceholder')} onValueChange={setDoctorSearchQuery} />
                                <CommandList>
                                <CommandEmpty>{isSearchingUsers ? t('createDialog.searching') : tGeneral('noResults')}</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem onSelect={() => {setNewAppointment(prev => ({...prev, doctor: null})); setDoctorSearchOpen(false);}}>
                                        <Check className={cn("mr-2 h-4 w-4", !newAppointment.doctor ? "opacity-100" : "opacity-0")}/>
                                        {t('createDialog.none')}
                                    </CommandItem>
                                    {filteredDoctors.map(doctor => (
                                        <CommandItem
                                            key={doctor.id}
                                            value={doctor.name}
                                            onSelect={() => {
                                                setNewAppointment(prev => ({...prev, doctor}));
                                                setDoctorSearchOpen(false);
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", newAppointment.doctor?.id === doctor.id ? "opacity-100" : "opacity-0")}/>
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
                                {newAppointment.calendar ? newAppointment.calendar.name : t('createDialog.allCalendars')}
                                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                                <CommandList>
                                <CommandGroup>
                                    <CommandItem onSelect={() => {setNewAppointment(prev => ({...prev, calendar: null})); setCalendarSearchOpen(false);}}>
                                        <Check className={cn("mr-2 h-4 w-4", !newAppointment.calendar ? "opacity-100" : "opacity-0")}/>
                                        {t('createDialog.allCalendars')}
                                    </CommandItem>
                                    {calendars.map(calendar => (
                                        <CommandItem
                                            key={calendar.id}
                                            value={calendar.name}
                                            onSelect={() => {
                                                setNewAppointment(prev => ({...prev, calendar}));
                                                setCalendarSearchOpen(false);
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", newAppointment.calendar?.id === calendar.id ? "opacity-100" : "opacity-0")}/>
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
            {/* Right Column */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="date">{t('createDialog.date')}</Label>
                    <Input id="date" type="date" value={newAppointment.date} onChange={e => setNewAppointment(prev => ({...prev, date: e.target.value}))} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="time">{t('createDialog.time')}</Label>
                    <Input id="time" type="time" value={newAppointment.time} onChange={e => setNewAppointment(prev => ({...prev, time: e.target.value}))} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">{t('createDialog.descriptionLabel')}</Label>
                    <Textarea id="description" value={newAppointment.description} onChange={e => setNewAppointment(prev => ({...prev, description: e.target.value}))} />
                </div>
            </div>
          </div>
            {/* Suggestions Area */}
            {!editingAppointment && (availabilityStatus === 'unavailable' || availabilityStatus === 'checking') && (
              <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-4 text-center">{t('createDialog.suggestedTimes')}</h3>
                  <ScrollArea className="h-48">
                      {availabilityStatus === 'checking' ? <p>Checking...</p> : (
                          <RadioGroup onValueChange={(value) => {
                              const [date, time, doctorId, calendarId] = value.split('|');
                              const doctor = assignees.find(d => d.id === doctorId);
                              const calendar = calendars.find(c => c.id === calendarId);
                              setNewAppointment(prev => ({...prev, date, time, doctor: doctor || null, calendar: calendar || null}));
                          }}>
                              {suggestedTimes.map((suggestion, index) => (
                                  <div key={suggestion.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                                      <RadioGroupItem value={`${suggestion.date}|${suggestion.time}|${suggestion.doctor.id}|${suggestion.calendar}`} id={suggestion.id} />
                                      <Label htmlFor={suggestion.id} className="font-normal text-sm">
                                          {suggestion.date} at {suggestion.time} with {suggestion.doctor.name} in {suggestion.calendar}
                                      </Label>
                                  </div>
                              ))}
                          </RadioGroup>
                      )}
                      {availabilityStatus === 'unavailable' && suggestedTimes.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center pt-10">No suggestions available for the selected criteria.</p>
                      )}
                  </ScrollArea>
              </div>
            )}
          <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('createDialog.cancel')}</Button>
              <Button onClick={() => handleSaveAppointment(newAppointment)}>{editingAppointment ? tColumns('edit') : t('createDialog.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

    

    

    



    

    

