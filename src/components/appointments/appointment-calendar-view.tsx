'use client';

import * as React from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Appointment } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';

const localizer = momentLocalizer(moment);

interface AppointmentCalendarViewProps {
  appointments: Appointment[];
}

export function AppointmentCalendarView({ appointments }: AppointmentCalendarViewProps) {
  const events = appointments.map(apt => ({
    title: `${apt.service_name} - ${apt.user_name}`,
    start: new Date(`${apt.date}T${apt.time}`),
    end: new Date(new Date(`${apt.date}T${apt.time}`).getTime() + 60 * 60 * 1000), // Assuming 1-hour duration
    allDay: false,
    resource: apt,
  }));

  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        <div className="h-[70vh]">
           <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView={Views.MONTH}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            style={{ height: '100%' }}
           />
        </div>
      </CardContent>
    </Card>
  );
}
