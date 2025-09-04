'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentListView } from '@/components/appointments/appointment-list-view';
import { AppointmentCalendarView } from '@/components/appointments/appointment-calendar-view';
import { appointments } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function AppointmentsPage() {
  const [isCreateOpen, setCreateOpen] = React.useState(false);

  return (
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
            <Tabs defaultValue="list">
            <TabsList>
                <TabsTrigger value="list">List View</TabsTrigger>
                <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            </TabsList>
            <TabsContent value="list">
                <AppointmentListView appointments={appointments} />
            </TabsContent>
            <TabsContent value="calendar">
                <AppointmentCalendarView appointments={appointments} />
            </TabsContent>
            </Tabs>
        </CardContent>
    </Card>
  );
}
