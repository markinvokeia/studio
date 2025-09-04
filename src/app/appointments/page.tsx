'use client';

import * as React from 'react';
import { Calendar, momentLocalizer, EventProps, ToolbarProps, View } from 'react-big-calendar';
import moment from 'moment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Appointment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, addMonths } from 'date-fns';

const localizer = momentLocalizer(moment);

const transformAppointmentsToEvents = (appointments: Appointment[]) => {
    return appointments.map(apt => {
        if (!apt.date || !apt.time) return null;
        const start = moment(`${apt.date} ${apt.time}`, 'YYYY-MM-DD HH:mm:ss').toDate();
        if (!moment(start).isValid()) return null;

        const end = moment(start).add(1, 'hour').toDate(); 
        return {
            title: `${apt.service_name} - ${apt.user_name}`,
            start,
            end,
            resource: apt,
        };
    }).filter(event => event !== null);
};

const CustomEvent = ({ event }: EventProps) => {
    const { resource } = event;
    if (!resource) return null;
    const status = resource.status as Appointment['status'];

    const variantMap:  Record<Appointment['status'], 'success' | 'default' | 'info' | 'destructive'> = {
      completed: 'success',
      confirmed: 'default',
      pending: 'info',
      cancelled: 'destructive',
    };
    const variant = variantMap[status] ?? 'default';
    
    return (
        <div className="flex flex-col p-1 text-xs">
            <span className="font-semibold">{event.title}</span>
            <Badge variant={variant} className="capitalize w-fit mt-1">{status}</Badge>
        </div>
    );
};

const CustomToolbar = ({ label, onNavigate, onView, view, views }: ToolbarProps) => {
    return (
        <div className="rbc-toolbar">
            <div className="rbc-btn-group">
                <Button variant="outline" size="icon" onClick={() => onNavigate('PREV')}><ChevronLeft /></Button>
                <Button variant="outline" onClick={() => onNavigate('TODAY')}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => onNavigate('NEXT')}><ChevronRight /></Button>
            </div>
            <div className="rbc-toolbar-label">{label}</div>
            <div className="rbc-btn-group">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="capitalize">{view}</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {(views as View[]).map((v) => (
                            <DropdownMenuItem key={v} onClick={() => onView(v)}>{v}</DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};

async function getAppointments(): Promise<Appointment[]> {
    const now = new Date();
    const startDate = addMonths(now, -6);
    const endDate = addMonths(now, 6);
    const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');
    
    const params = new URLSearchParams({
        startingDateAndTime: formatDateForAPI(startDate),
        endingDateAndTime: formatDateForAPI(endDate),
    });

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

            const appointmentDateTime = new Date(appointmentDateTimeStr);
            if (isNaN(appointmentDateTime.getTime())) return null;

            return {
                id: apiAppt.id ? String(apiAppt.id) : `appt_${Math.random().toString(36).substr(2, 9)}`,
                user_name: apiAppt.user_name || (apiAppt.attendees && apiAppt.attendees.length > 0 ? apiAppt.attendees[0].email : 'N/A'),
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


export default function AppointmentsPage() {
  const [events, setEvents] = React.useState<any[]>([]);
  const [isCreateOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    async function loadAppointments() {
        const appointments = await getAppointments();
        const calendarEvents = transformAppointmentsToEvents(appointments);
        setEvents(calendarEvents as any[]);
    }
    loadAppointments();
  }, []);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Appointments</CardTitle>
          <CardDescription>Manage all appointments.</CardDescription>
        </div>
         <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            <span>New Appointment</span>
        </Button>
      </CardHeader>
      <CardContent className="h-[70vh]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={['month', 'week', 'day', 'agenda']}
          components={{
            event: CustomEvent,
            toolbar: CustomToolbar
          }}
          eventPropGetter={(event) => {
            if (!event.resource) return {className: ''};
            const status = event.resource.status as Appointment['status'];
            let className = 'rbc-event-';
            switch (status) {
              case 'completed': className += 'completed'; break;
              case 'confirmed': className += 'confirmed'; break;
              case 'pending': className += 'pending'; break;
              case 'cancelled': className += 'cancelled'; break;
              default: break;
            }
            return { className };
          }}
        />
      </CardContent>
    </Card>
     <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Appointment</DialogTitle>
            <DialogDescription>
              Fill in the details below to create a new appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="user_name" className="text-right">
                User Name
              </Label>
              <Input id="user_name" className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="service_name" className="text-right">
                Service Name
              </Label>
              <Input id="service_name" className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <Input id="date" type="date" className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="time" className="text-right">
                Time
              </Label>
              <Input id="time" type="time" className="col-span-3" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button>Save Appointment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
