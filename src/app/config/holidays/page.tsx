'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClinicException } from '@/lib/types';
import { holidaysColumns } from './columns';
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

async function getHolidays(): Promise<ClinicException[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/exceptions', {
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
        const holidaysData = Array.isArray(data) ? data : (data.exceptions || data.data || data.result || []);

        return holidaysData.map((apiHoliday: any) => ({
            id: apiHoliday.id ? String(apiHoliday.id) : `ex_${Math.random().toString(36).substr(2, 9)}`,
            date: apiHoliday.date,
            is_open: apiHoliday.is_open,
            start_time: apiHoliday.start_time,
            end_time: apiHoliday.end_time,
            notes: apiHoliday.notes || '',
        }));
    } catch (error) {
        console.error("Failed to fetch holidays:", error);
        return [];
    }
}


export default function HolidaysPage() {
    const [holidays, setHolidays] = React.useState<ClinicException[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadHolidays = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedHolidays = await getHolidays();
        setHolidays(fetchedHolidays);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadHolidays();
    }, [loadHolidays]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Holidays & Exceptions</CardTitle>
                <CardDescription>Manage exceptions to the regular clinic schedule.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={holidaysColumns} 
                    data={holidays} 
                    filterColumnId="date" 
                    filterPlaceholder="Filter holidays by date..."
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadHolidays}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Exception</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new holiday or exception.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">
                        Date
                        </Label>
                        <Input id="date" type="date" className="col-span-3" />
                    </div>
                    <div className="flex items-center space-x-2 justify-end">
                        <Checkbox id="is_open" />
                        <Label htmlFor="is_open">Clinic is Open</Label>
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
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notes" className="text-right">
                        Notes
                        </Label>
                        <Textarea id="notes" placeholder="e.g., Special event" className="col-span-3" />
                    </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Exception</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
