'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/lib/types';
import { calendarsColumns } from './columns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

async function getCalendars(): Promise<Calendar[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/calendars', {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const calendarsData = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);

        return calendarsData.map((apiCalendar: any) => ({
            id: apiCalendar.id ? String(apiCalendar.id) : `cal_${Math.random().toString(36).substr(2, 9)}`,
            name: apiCalendar.name,
            description: apiCalendar.description,
            timezone: apiCalendar.timezone,
            is_default: apiCalendar.is_default,
        }));
    } catch (error) {
        console.error("Failed to fetch calendars:", error);
        return [];
    }
}

export default function CalendarsPage() {
    const [calendars, setCalendars] = React.useState<Calendar[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadCalendars = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedCalendars = await getCalendars();
        setCalendars(fetchedCalendars);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadCalendars();
    }, [loadCalendars]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Calendars</CardTitle>
                <CardDescription>Manage your calendars.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={calendarsColumns} 
                    data={calendars} 
                    filterColumnId="name" 
                    filterPlaceholder="Filter calendars by name..."
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadCalendars}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Calendar</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new calendar.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                        Name
                        </Label>
                        <Input id="name" placeholder="e.g., Main Calendar" className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                        Description
                        </Label>
                        <Textarea id="description" placeholder="e.g., For general appointments" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="timezone" className="text-right">
                        Timezone
                        </Label>
                        <Input id="timezone" placeholder="e.g., America/New_York" className="col-span-3" />
                    </div>
                    <div className="flex items-center space-x-2 justify-end">
                        <Checkbox id="is_default" />
                        <Label htmlFor="is_default">Default Calendar</Label>
                    </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Calendar</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
