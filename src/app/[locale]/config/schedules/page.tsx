'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { ClinicSchedule } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, CalendarClock, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const scheduleFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    day_of_week: z.string().min(1, t('dayRequired')),
    start_time: z.string().min(1, t('startRequired')),
    end_time: z.string().min(1, t('endRequired')),
});

type ScheduleFormValues = z.infer<ReturnType<typeof scheduleFormSchema>>;

async function getSchedules(): Promise<ClinicSchedule[]> {
    try {
        const data = await api.get(API_ROUTES.CLINIC_SCHEDULES);
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
    const responseData = await api.post(API_ROUTES.CLINIC_SCHEDULES_UPSERT, { ...scheduleData, day_of_week: Number(scheduleData.day_of_week) });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save schedule');
    }
    return responseData;
}

async function deleteSchedule(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_SCHEDULES_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete schedule');
    }
    return responseData;
}

export default function SchedulesPage() {
    const t = useTranslations('SchedulesPage');
    const tValidation = useTranslations('SchedulesPage.validation');
    const { toast } = useToast();
    const isNarrow = useViewportNarrow();
    const { hasPermission } = usePermissions();

    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SCHEDULES_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SCHEDULES_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SCHEDULES_DELETE);

    const [schedules, setSchedules] = React.useState<ClinicSchedule[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedSchedule, setSelectedSchedule] = React.useState<ClinicSchedule | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingSchedule, setDeletingSchedule] = React.useState<ClinicSchedule | null>(null);

    const form = useForm<ScheduleFormValues>({
        resolver: zodResolver(scheduleFormSchema(tValidation)),
        defaultValues: { day_of_week: '', start_time: '', end_time: '' },
    });

    const loadSchedules = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getSchedules();
        setSchedules(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => { loadSchedules(); }, [loadSchedules]);

    const getDayLabel = (day: number | string) => {
        const dayMap: Record<string, string> = {
            '1': t('days.monday'), '2': t('days.tuesday'), '3': t('days.wednesday'),
            '4': t('days.thursday'), '5': t('days.friday'), '6': t('days.saturday'), '0': t('days.sunday'),
        };
        return dayMap[String(day)] || String(day);
    };

    const handleRowSelection = (rows: ClinicSchedule[]) => {
        const schedule = rows[0] ?? null;
        setSelectedSchedule(schedule);
        setSubmissionError(null);
        if (schedule) {
            setIsEditing(false);
            form.reset({ ...schedule, day_of_week: String(schedule.day_of_week) });
        }
    };

    const handleCreate = () => {
        setSelectedSchedule(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ day_of_week: '', start_time: '', end_time: '' });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedSchedule(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedSchedule) {
            setIsEditing(false);
            form.reset({ ...selectedSchedule, day_of_week: String(selectedSchedule.day_of_week) });
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: ScheduleFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertSchedule(values);
            toast({ title: selectedSchedule ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadSchedules();
            setIsEditing(false);
            if (!values.id) {
                setIsCreateDialogOpen(false);
                handleClose();
            }
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingSchedule) return;
        try {
            await deleteSchedule(deletingSchedule.id);
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingSchedule(null);
            handleClose();
            loadSchedules();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<ClinicSchedule>[] = [
        {
            accessorKey: 'day_of_week',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.dayOfWeek')} />,
            cell: ({ row }) => getDayLabel(row.original.day_of_week),
        },
        { accessorKey: 'start_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.startTime')} /> },
        { accessorKey: 'end_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.endTime')} /> },
    ];

    const isRightOpen = !!selectedSchedule;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><CalendarClock className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={schedules}
                    filterColumnId="day_of_week"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadSchedules}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedSchedule}
                    renderCard={(row: ClinicSchedule, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={`${row.start_time} – ${row.end_time}`}
                            subtitle={getDayLabel(row.day_of_week)}
                            showArrow
                        />
                    )}
                />
            </CardContent>
        </Card>
    );

    const rightPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="header-icon-circle flex-none"><CalendarClock className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedSchedule
                                ? t('createDialog.title')
                                : selectedSchedule
                                    ? `${getDayLabel(selectedSchedule.day_of_week)} · ${selectedSchedule.start_time}–${selectedSchedule.end_time}`
                                    : ''}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedSchedule && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('columns.edit')}</span>
                            </Button>
                        )}
                        {selectedSchedule && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingSchedule(selectedSchedule); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField control={form.control} name="day_of_week" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.dayOfWeek')}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('createDialog.selectDay')} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="1">{t('days.monday')}</SelectItem>
                                        <SelectItem value="2">{t('days.tuesday')}</SelectItem>
                                        <SelectItem value="3">{t('days.wednesday')}</SelectItem>
                                        <SelectItem value="4">{t('days.thursday')}</SelectItem>
                                        <SelectItem value="5">{t('days.friday')}</SelectItem>
                                        <SelectItem value="6">{t('days.saturday')}</SelectItem>
                                        <SelectItem value="0">{t('days.sunday')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="start_time" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.startTime')}</FormLabel>
                                <FormControl><Input type="time" {...field} disabled={!isEditing} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="end_time" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.endTime')}</FormLabel>
                                <FormControl><Input type="time" {...field} disabled={!isEditing} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedSchedule) form.reset({ ...selectedSchedule, day_of_week: String(selectedSchedule.day_of_week) }); else handleClose(); }} disabled={isSaving}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedSchedule ? t('createDialog.editSave') : t('createDialog.save')}
                                </Button>
                            </div>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                isRightPanelOpen={isRightOpen}
                onBack={handleBack}
                leftPanelDefaultSize={40}
                rightPanelDefaultSize={60}
            />
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={(open) => {
                    setIsCreateDialogOpen(open);
                    if (!open) {
                        setIsEditing(false);
                        setSubmissionError(null);
                        form.reset({ day_of_week: '', start_time: '', end_time: '' });
                    }
                }}
            >
                <DialogContent maxWidth="lg">
                    <DialogHeader>
                        <DialogTitle>{t('createDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                <FormField control={form.control} name="day_of_week" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.dayOfWeek')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('createDialog.selectDay')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">{t('days.monday')}</SelectItem>
                                                <SelectItem value="2">{t('days.tuesday')}</SelectItem>
                                                <SelectItem value="3">{t('days.wednesday')}</SelectItem>
                                                <SelectItem value="4">{t('days.thursday')}</SelectItem>
                                                <SelectItem value="5">{t('days.friday')}</SelectItem>
                                                <SelectItem value="6">{t('days.saturday')}</SelectItem>
                                                <SelectItem value="0">{t('days.sunday')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="start_time" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.startTime')}</FormLabel>
                                        <FormControl><Input type="time" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="end_time" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.endTime')}</FormLabel>
                                        <FormControl><Input type="time" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsCreateDialogOpen(false)}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('createDialog.save')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
