
'use client';

import * as React from 'react';
import { addMonths, format, parseISO, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Appointment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
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

export default function AppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [isCreateOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    getAppointments().then(setAppointments);
  }, []);

  const selectedDayAppointments = React.useMemo(() => {
    if (!selectedDate) return [];
    return appointments
      .filter(apt => isSameDay(parseISO(`${apt.date}T${apt.time}`), selectedDate))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDate]);
  
  const getStatusVariant = (status: Appointment['status']) => {
    return {
        completed: 'success',
        confirmed: 'default',
        pending: 'info',
        cancelled: 'destructive',
    }[status] || 'default';
  };

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
        <CardContent>
          <Tabs defaultValue="calendar">
            <TabsList>
              <TabsTrigger value="calendar">Calendar View</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar" className="pt-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-1">
                  <Card>
                    <CardContent className="p-2">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="rounded-md"
                            initialFocus
                        />
                    </CardContent>
                  </Card>
                </div>
                <div className="md:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Appointments for {selectedDate ? format(selectedDate, 'PPP') : '...'}
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
                          <p className="text-center text-muted-foreground">No appointments for this day.</p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="list" className="pt-4">
               <DataTable 
                columns={appointmentColumns} 
                data={appointments} 
                filterColumnId='service_name'
                filterPlaceholder='Filter by service...'
              />
            </TabsContent>
          </Tabs>
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
