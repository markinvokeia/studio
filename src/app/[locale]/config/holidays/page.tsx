'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableAdvancedToolbar } from '@/components/ui/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { ClinicException } from '@/lib/types';
import { formatHolidayDate } from '@/lib/utils';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, CalendarOff, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const holidayFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    date: z.string().min(1, t('dateRequired')),
    is_open: z.boolean().default(false),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    notes: z.string().optional(),
});

type HolidayFormValues = z.infer<ReturnType<typeof holidayFormSchema>>;

async function getHolidays(): Promise<ClinicException[]> {
    try {
        const data = await api.get(API_ROUTES.EXCEPTIONS);
        const holidaysData = Array.isArray(data) ? data : (data.exceptions || data.data || data.result || []);
        return holidaysData.map((apiHoliday: any) => ({
            id: apiHoliday.id ? String(apiHoliday.id) : `ex_${Math.random().toString(36).substr(2, 9)}`,
            date: formatHolidayDate(apiHoliday.date),
            is_open: apiHoliday.is_open,
            start_time: apiHoliday.start_time ?? '',
            end_time: apiHoliday.end_time ?? '',
            notes: apiHoliday.notes || '',
        }));
    } catch (error) {
        console.error("Failed to fetch holidays:", error);
        return [];
    }
}

function mapHolidayToFormValues(holiday: ClinicException): HolidayFormValues {
    return {
        id: holiday.id,
        date: formatHolidayDate(holiday.date),
        is_open: holiday.is_open,
        start_time: holiday.start_time ?? '',
        end_time: holiday.end_time ?? '',
        notes: holiday.notes ?? '',
    };
}

async function upsertHoliday(holidayData: HolidayFormValues) {
    const responseData = await api.post(API_ROUTES.HOLIDAYS_UPSERT, holidayData);
    if (responseData && typeof responseData === 'object' && responseData.error === true) {
        throw new Error(responseData.message || 'Failed to save holiday');
    }
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save holiday');
    }
    return responseData;
}

async function deleteHoliday(id: string) {
    const responseData = await api.delete(API_ROUTES.HOLIDAYS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete holiday');
    }
    return responseData;
}

export default function HolidaysPage() {
    const t = useTranslations('HolidaysPage');
    const tNav = useTranslations('Navigation');
    const tValidation = useTranslations('HolidaysPage.validation');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_DELETE);

    const [holidays, setHolidays] = React.useState<ClinicException[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedHoliday, setSelectedHoliday] = React.useState<ClinicException | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingHoliday, setDeletingHoliday] = React.useState<ClinicException | null>(null);

    const form = useForm<HolidayFormValues>({
        resolver: zodResolver(holidayFormSchema(tValidation)),
        defaultValues: { date: '', is_open: false, start_time: '', end_time: '', notes: '' },
    });

    const loadHolidays = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getHolidays();
        setHolidays(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => { loadHolidays(); }, [loadHolidays]);

    const filteredHolidays = React.useMemo(() => {
        if (!searchQuery) return holidays;
        return holidays.filter(h =>
            Object.values(h).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [holidays, searchQuery]);

    const handleRowSelection = (rows: ClinicException[]) => {
        const holiday = rows[0] ?? null;
        setSelectedHoliday(holiday);
        setSubmissionError(null);
        if (holiday) {
            setIsEditing(false);
            form.reset(mapHolidayToFormValues(holiday));
        }
    };

    const handleCreate = () => {
        setSelectedHoliday(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ date: '', is_open: false, start_time: '', end_time: '', notes: '' });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedHoliday(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedHoliday) {
            setIsEditing(false);
            form.reset(mapHolidayToFormValues(selectedHoliday));
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: HolidayFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertHoliday(values);
            toast({ title: selectedHoliday ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadHolidays();
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
        if (!deletingHoliday) return;
        try {
            await deleteHoliday(deletingHoliday.id);
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingHoliday(null);
            handleClose();
            loadHolidays();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: t('toast.deleteErrorDescription') });
        }
    };

    const columnTranslations = {
        id: t('columns.id'),
        date: t('columns.date'),
        is_open: t('columns.status'),
        start_time: t('columns.startTime'),
        end_time: t('columns.endTime'),
        notes: t('columns.notes'),
    };

    const columns: ColumnDef<ClinicException>[] = [
        { accessorKey: 'date', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} /> },
        {
            accessorKey: 'is_open',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
            cell: ({ row }) => <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.original.is_open ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{row.original.is_open ? 'Abierto' : 'Cerrado'}</span>,
        },
        { accessorKey: 'notes', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.notes')} /> },
    ];

    const isRightOpen = !!selectedHoliday;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><CalendarOff className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{tNav('Holidays')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={filteredHolidays}
                    columnTranslations={columnTranslations}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedHoliday}
                    customToolbar={(table) => (
                        <DataTableAdvancedToolbar
                            table={table}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            filterPlaceholder={t('filterPlaceholder')}
                            onCreate={canCreate ? handleCreate : undefined}
                            onRefresh={loadHolidays}
                            isRefreshing={isRefreshing}
                            columnTranslations={columnTranslations}
                        />
                    )}
                    renderCard={(row: ClinicException, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.date}
                            subtitle={row.notes || (row.is_open ? `${row.start_time} – ${row.end_time}` : '')}
                            badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.is_open ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{row.is_open ? 'Abierto' : 'Cerrado'}</span>}
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
                        <div className="header-icon-circle flex-none"><CalendarOff className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedHoliday ? t('createDialog.title') : (selectedHoliday?.date ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedHoliday && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('createDialog.editSave')}</span>
                            </Button>
                        )}
                        {selectedHoliday && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingHoliday(selectedHoliday); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedHoliday && !isEditing && (
                    <div className="ml-10 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${selectedHoliday.is_open ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {selectedHoliday.is_open ? 'Abierto' : 'Cerrado'}
                        </span>
                    </div>
                )}
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
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.date')}</FormLabel>
                                <FormControl>
                                    {isEditing ? <DatePickerInput value={field.value ?? ''} onChange={field.onChange} /> : <Input {...field} value={field.value ?? ''} disabled />}
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="is_open" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isEditing} /></FormControl>
                                <FormLabel className="font-normal">{t('createDialog.isOpen')}</FormLabel>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="start_time" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.startTime')}</FormLabel>
                                <FormControl><Input type="time" {...field} value={field.value ?? ''} disabled={!isEditing} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="end_time" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.endTime')}</FormLabel>
                                <FormControl><Input type="time" {...field} value={field.value ?? ''} disabled={!isEditing} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.notes')}</FormLabel>
                                <FormControl><Textarea {...field} value={field.value ?? ''} disabled={!isEditing} placeholder={isEditing ? t('createDialog.notesPlaceholder') : ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedHoliday) form.reset(mapHolidayToFormValues(selectedHoliday)); else handleClose(); }} disabled={isSaving}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedHoliday ? t('createDialog.editSave') : t('createDialog.save')}
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
                        form.reset({ date: '', is_open: false, start_time: '', end_time: '', notes: '' });
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
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.date')}</FormLabel>
                                        <FormControl><DatePickerInput value={field.value} onChange={field.onChange} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="is_open" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="font-normal">{t('createDialog.isOpen')}</FormLabel>
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
                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.notes')}</FormLabel>
                                        <FormControl><Textarea {...field} placeholder={t('createDialog.notesPlaceholder')} /></FormControl>
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
