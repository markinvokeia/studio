
'use client';

import * as React from 'react';
import { addMonths, format, parseISO, isSameDay, isToday, isThisMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Appointment, Calendar as CalendarType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Calendar as CalendarIcon } from 'lucide-react';
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
import { appointmentColumns } from './columns';
import { cn } from '@/lib/utils';
import { SortingState } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';

async function getAppointments(calendarIds: string[]): Promise<Appointment[]> {
    const now = new Date();
    const startDate = addMonths(now, -6);
    const endDate = addMonths(now, 6);
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
        const appointmentsData = (Array.isArray(data) && data.length > 0 && data[0].filteredEvents) ? data[0].filteredEvents : [];
        
        if (!Array.isArray(appointmentsData)) {
            console.error("Fetched data is not an array:", appointmentsData);
            return [];
        }

        return appointmentsData.map((apiAppt: any) => {
            const appointmentDateTimeStr = apiAppt.start_time || (apiAppt.start && apiAppt.start.dateTime);
            if (!appointmentDateTimeStr) return null;

            const appointmentDateTime = parseISO(appointmentDateTimeStr);
            if (isNaN(appointmentDateTime.getTime())) return null;

            return {
                id: apiAppt.id ? String(apiAppt.id) : `appt_${Math.random().toString(36).substr(2, 9)}`,
                user_name: apiAppt.user_name || (apiAppt.attendees && apiAppt.attendees.length > 0 ? apiAppt.attendees.map((a:any) => a.email).join(', ') : 'N/A'),
                service_name: apiAppt.summary || 'No Service Name',
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'HH:mm:ss'),
                status: apiAppt.status || 'confirmed',
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

  const loadAppointments = React.useCallback(async () => {
    if (selectedCalendarIds.length === 0) {
        setAppointments([]);
        return;
    };
    setIsRefreshing(true);
    const fetchedAppointments = await getAppointments(selectedCalendarIds);
    setAppointments(fetchedAppointments);
    setIsRefreshing(false);
  }, [selectedCalendarIds]);
  
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            <span>{t('newAppointment')}</span>
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="calendar">
            <TabsList>
              <TabsTrigger value="calendar">{t('calendarView')}</TabsTrigger>
              <TabsTrigger value="list">{t('listView')}</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar" className="pt-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-1 space-y-4">
                  <Card>
                    <CardContent className="p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="rounded-md"
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
                                    <Label htmlFor={calendar.id}>{calendar.name}</Label>
                                </div>
                                ))}
                            </ScrollArea>
                           </div>
                        )}
                      </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {t('appointmentsFor', {date: selectedDate ? format(selectedDate, 'PPP') : '...'})}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[calc(100vh-400px)]">
                        {selectedDayAppointments.length > 0 ? (
                          <div className="space-y-4">
                            {selectedDayAppointments.map((apt, index) => (
                              <React.Fragment key={apt.id}>
                                <div className="flex items-start justify-between space-x-4">
                                    <div className="flex items-center space-x-4">
                                        <Badge variant={getStatusVariant(apt.status) as any} className="h-fit capitalize">{apt.status}</Badge>
                                        <div>
                                            <p className="font-semibold">{apt.service_name}</p>
                                            <p className="text-sm text-muted-foreground">{apt.user_name}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground">{format(parseISO(`${apt.date}T${apt.time}`), 'p')}</p>
                                </div>
                                {index < selectedDayAppointments.length - 1 && <Separator />}
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground">{t('noAppointments')}</p>
                        )}
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
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
            <DialogDescription>{t('createDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="user_name" className="text-right">{t('createDialog.userName')}</Label>
              <Input id="user_name" className="col-span-3" />
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
