
'use client';

import * as React from 'react';
import { addMonths, format, parseISO, isSameDay, isToday, isThisMonth, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Appointment, Calendar as CalendarType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Calendar as CalendarIcon, User, Phone, Stethoscope, RefreshCw, CalendarDays, List } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

async function getAppointments(calendarIds: string[], startDate: Date, endDate: Date): Promise<Appointment[]> {
    const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');
    
    const params = new URLSearchParams({
        startingDateAndTime: formatDateForAPI(startDate),
        endingDateAndTime: formatDateForAPI(endDate),
    });
    
    if (calendarIds.length > 0) {
        params.append('calendar_ids', calendarIds.join(','));
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
                id: apiAppt.id ? String(apiAppt.id) : `appt_${Math.random().toString(36).substr(2, 9)}`,
                patientName: apiAppt.patientName || (apiAppt.attendees && apiAppt.attendees.length > 0 ? apiAppt.attendees.map((a:any) => a.email).join(', ') : 'N/A'),
                service_name: apiAppt.summary || 'No Service Name',
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'HH:mm'),
                status: apiAppt.status || 'confirmed',
                patientPhone: apiAppt.patientPhone,
                doctorName: apiAppt.doctorName,
                calendar_id: apiAppt.organizer?.email,
                calendar_name: apiAppt.organizer?.displayName || apiAppt.organizer?.email || '',
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
            id: apiCalendar.google_calendar_id,
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
  const appointmentColumns: ColumnDef<Appointment>[] = React.useMemo(() => getAppointmentColumns(tColumns, tStatus), [tColumns, tStatus]);

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

  const generateColor = (str: string) => {
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
        colors[cal.id] = generateColor(cal.id);
    });
    setCalendarColors(colors);
  }, [calendars]);

  const loadAppointments = React.useCallback(async () => {
    if (selectedCalendarIds.length === 0) {
        setAppointments([]);
        return;
    };
    setIsRefreshing(true);
    const fetchedAppointments = await getAppointments(selectedCalendarIds, fetchRange.from, fetchRange.to);
    setAppointments(fetchedAppointments);
    setIsRefreshing(false);
  }, [selectedCalendarIds, fetchRange]);
  
  const loadCalendars = React.useCallback(async () => {
    setIsCalendarsLoading(true);
    const fetchedCalendars = await getCalendars();
    setCalendars(fetchedCalendars);
    setSelectedCalendarIds(fetchedCalendars.map(c => c.id));
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
        setSelectedCalendarIds(calendars.map(c => c.id));
    } else {
        setSelectedCalendarIds([]);
    }
  };

  const handleCalendarSelection = (calendarId: string, checked: boolean) => {
    setSelectedCalendarIds(prev => 
        checked ? [...prev, calendarId] : prev.filter(id => id !== calendarId)
    );
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
                <TabsList>
                    <TabsTrigger value="calendar" className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {t('calendarView')}
                    </TabsTrigger>
                    <TabsTrigger value="list" className="flex items-center gap-2">
                        <List className="h-4 w-4" />
                        {t('listView')}
                    </TabsTrigger>
                </TabsList>
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
                                        checked={selectedCalendarIds.length === calendars.length}
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
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: calendarColors[calendar.id] }} />
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
                                    <div key={apt.id} className="flex items-start space-x-4 rounded-lg border bg-card text-card-foreground shadow-sm p-4 relative overflow-hidden">
                                        <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: calendarColors[apt.calendar_id] }} />
                                        <div className="pl-4 w-full">
                                            <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={getStatusVariant(apt.status) as any} className="capitalize text-xs">{tStatus(apt.status.toLowerCase())}</Badge>
                                                <p className="font-semibold">{apt.service_name}</p>
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">{apt.time}</p>
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
      <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
            <DialogDescription>{t('createDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="patientName" className="text-right">{t('createDialog.userName')}</Label>
              <Input id="patientName" className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="service_name" className="text-right">{t('createDialog.serviceName')}</Label>
              <Input id="service_name" className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">{t('createDialog.date')}</Label>
              <Input id="date" type="date" className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="time" className="text-right">{t('createDialog.time')}</Label>
              <Input id="time" type="time" className="col-span-3" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button>{t('createDialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
