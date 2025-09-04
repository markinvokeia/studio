'use client';

import * as React from 'react';
import { Calendar, momentLocalizer, EventProps, ToolbarProps } from 'react-big-calendar';
import moment from 'moment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { appointments as appointmentData } from '@/lib/data';
import { Appointment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
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

const localizer = momentLocalizer(moment);

const transformAppointmentsToEvents = (appointments: Appointment[]) => {
    return appointments.map(apt => {
        const start = moment(`${apt.date} ${apt.time}`).toDate();
        const end = moment(start).add(1, 'hour').toDate(); // Assuming 1-hour appointments
        return {
            title: `${apt.service_name} - ${apt.user_name}`,
            start,
            end,
            resource: apt,
        };
    });
};

const CustomEvent = ({ event }: EventProps) => {
    const { resource } = event;
    const status = resource.status as Appointment['status'];

    const variant = {
      completed: 'success',
      confirmed: 'default',
      pending: 'info',
      cancelled: 'destructive',
    }[status.toLowerCase()] ?? ('default' as any);
    
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
                        {Array.isArray(views) && views.map((v) => (
                            <DropdownMenuItem key={v} onClick={() => onView(v)}>{v}</DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};


export default function AppointmentsPage() {
  const [events, setEvents] = React.useState(transformAppointmentsToEvents(appointmentData));
  const [isCreateOpen, setCreateOpen] = React.useState(false);

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
          components={{
            event: CustomEvent,
            toolbar: CustomToolbar
          }}
          eventPropGetter={(event) => {
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
