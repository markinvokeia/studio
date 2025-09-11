'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClinicSchedule } from '@/lib/types';
import { schedulesColumns } from './columns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

async function getSchedules(): Promise<ClinicSchedule[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/schedules', {
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
        const schedulesData = Array.isArray(data) ? data : (data.schedules || data.data || data.result || []);

        return schedulesData.map((apiSchedule: any) => ({
            id: apiSchedule.id ? String(apiSchedule.id) : `sch_${Math.random().toString(36).substr(2, 9)}`,
            day_of_week: apiSchedule.day_of_week,
            start_time: apiSchedule.start_time,
            end_time: apiSchedule.end_time,
        }));
    } catch (error) {
        console.error("Failed to fetch schedules:", error);
        return [];
    }
}

export default function SchedulesPage() {
    const [schedules, setSchedules] = React.useState<ClinicSchedule[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadSchedules = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedSchedules = await getSchedules();
        setSchedules(fetchedSchedules);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadSchedules();
    }, [loadSchedules]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Clinic Schedules</CardTitle>
                <CardDescription>Manage regular weekly schedules for the clinic.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={schedulesColumns} 
                    data={schedules} 
                    filterColumnId="day_of_week" 
                    filterPlaceholder="Filter schedules by day..." 
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadSchedules}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Schedule</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new schedule.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day_of_week" className="text-right">
                    Day of Week
                    </Label>
                     <Select>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select a day" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                            <SelectItem value="0">Sunday</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="start_time" className="text-right">
                    Start Time
                    </Label>
                    <Input id="start_time" type="time" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="end_time" className="text-right">
                    End Time
                    </Label>
                    <Input id="end_time" type="time" className="col-span-3" />
                </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Schedule</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
