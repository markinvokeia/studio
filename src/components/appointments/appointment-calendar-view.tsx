'use client';

import * as React from 'react';
import { Appointment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isSameDay } from 'date-fns';

interface AppointmentCalendarViewProps {
  appointments: Appointment[];
}

export function AppointmentCalendarView({ appointments }: AppointmentCalendarViewProps) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  const appointmentsByDate = React.useMemo(() => {
    const grouped: { [key: string]: Appointment[] } = {};
    appointments.forEach(apt => {
      const day = format(parseISO(`${apt.date}T${apt.time}`), 'yyyy-MM-dd');
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(apt);
    });
    return grouped;
  }, [appointments]);
  
  const selectedDayAppointments = date ? appointmentsByDate[format(date, 'yyyy-MM-dd')] || [] : [];

  const appointmentDayStyles = {
    backgroundColor: 'hsl(var(--primary) / 0.1)',
    borderRadius: '50%',
  };
  
  const modifiers = {
    hasAppointment: Object.keys(appointmentsByDate).map(dateStr => new Date(dateStr + 'T00:00:00'))
  };

  const modifiersStyles = {
    hasAppointment: {
      fontWeight: 'bold',
    },
  };
  
  const renderDayContent = (day: Date) => {
    const dayString = format(day, 'yyyy-MM-dd');
    if (appointmentsByDate[dayString]) {
      return (
        <div className="relative">
          {day.getDate()}
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
        </div>
      );
    }
    return day.getDate();
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Card>
            <CardContent className="p-4">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border"
                    modifiers={modifiers}
                    components={{ DayContent: ({ date }) => renderDayContent(date) }}
                />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>
                    Appointments for {date ? format(date, 'PPP') : '...'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {selectedDayAppointments.length > 0 ? (
                        selectedDayAppointments.map(apt => (
                             <div key={apt.id} className="p-4 rounded-md border bg-muted/50">
                                <p className="font-semibold">{apt.service_name}</p>
                                <p className="text-sm text-muted-foreground">{apt.user_name}</p>
                                <div className="flex items-center justify-between mt-2">
                                     <Badge variant="outline">{apt.time}</Badge>
                                     <Badge className="capitalize">{apt.status}</Badge>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">No appointments for this day.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
