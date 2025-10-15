
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClinicSchedule } from '@/lib/types';
import { SchedulesColumnsWrapper } from './columns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const scheduleFormSchema = z.object({
    id: z.string().optional(),
    day_of_week: z.string().min(1, "Day of week is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

async function getSchedules(): Promise<ClinicSchedule[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/schedules', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        const schedulesData = Array.isArray(data) ? data : (data.schedules || data.data || data.result || []);

        return schedulesData.map((apiSchedule: any) => ({
            id: String(apiSchedule.id),
            day_of_week: apiSchedule.day_of_week,
            start_time: apiSchedule.start_time,
            end_time: apiSchedule.end_time,
        }));
    } catch (error) {
        console.error("Failed to fetch schedules:", error);
        return [];
    }
}

async function upsertSchedule(scheduleData: ScheduleFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/clinicschedules/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scheduleData, day_of_week: Number(scheduleData.day_of_week) }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save schedule';
        throw new Error(message);
    }
    return responseData;
}

async function deleteSchedule(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/clinicschedules/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete schedule';
        throw new Error(message);
    }
    return responseData;
}

export default function SchedulesPage() {
    const { toast } = useToast();
    const [schedules, setSchedules] = React.useState<ClinicSchedule[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingSchedule, setEditingSchedule] = React.useState<ClinicSchedule | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingSchedule, setDeletingSchedule] = React.useState<ClinicSchedule | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<ScheduleFormValues>({
        resolver: zodResolver(scheduleFormSchema),
        defaultValues: { day_of_week: '', start_time: '', end_time: '' },
    });

    const loadSchedules = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedSchedules = await getSchedules();
        setSchedules(fetchedSchedules);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadSchedules();
    }, [loadSchedules]);

    const handleCreate = () => {
        setEditingSchedule(null);
        form.reset({ day_of_week: '', start_time: '', end_time: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (schedule: ClinicSchedule) => {
        setEditingSchedule(schedule);
        form.reset({
            id: schedule.id,
            day_of_week: String(schedule.day_of_week),
            start_time: schedule.start_time,
            end_time: schedule.end_time,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (schedule: ClinicSchedule) => {
        setDeletingSchedule(schedule);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingSchedule) return;
        try {
            await deleteSchedule(deletingSchedule.id);
            toast({
                title: "Schedule Deleted",
                description: "The schedule has been successfully deleted.",
            });
            setIsDeleteDialogOpen(false);
            setDeletingSchedule(null);
            loadSchedules();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: "Could not delete the schedule.",
            });
        }
    };

    const onSubmit = async (values: ScheduleFormValues) => {
        setSubmissionError(null);
        try {
            await upsertSchedule(values);
            toast({
                title: editingSchedule ? "Schedule Updated" : "Schedule Created",
                description: `The schedule has been saved successfully.`,
            });
            setIsDialogOpen(false);
            loadSchedules();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
        }
    };
    
    const schedulesColumns = SchedulesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


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
                    onCreate={handleCreate}
                    onRefresh={loadSchedules}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}</DialogTitle>
                    <DialogDescription>
                        {editingSchedule ? 'Update the details for this schedule.' : 'Fill in the details below to add a new schedule.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField
                            control={form.control}
                            name="day_of_week"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Day of Week</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a day" />
                                        </SelectTrigger>
                                    </FormControl>
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
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="start_time"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Start Time</FormLabel>
                                <FormControl>
                                    <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="end_time"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>End Time</FormLabel>
                                <FormControl>
                                    <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingSchedule ? 'Save Changes' : 'Create Schedule'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
         <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the schedule. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

    
