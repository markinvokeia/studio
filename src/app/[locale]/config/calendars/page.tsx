'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { Calendar as CalendarType } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Calendar, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const calendarFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    name: z.string().min(1, t('nameRequired')),
    google_calendar_id: z.string().email(t('emailInvalid')),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t('colorInvalid')).optional(),
    is_active: z.boolean().default(false),
});

type CalendarFormValues = z.infer<ReturnType<typeof calendarFormSchema>>;

async function getCalendars(): Promise<CalendarType[]> {
    try {
        const data = await api.get(API_ROUTES.CALENDARS);
        const calendarsData = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);
        return calendarsData.map((apiCalendar: any) => ({
            id: apiCalendar.id ? String(apiCalendar.id) : `cal_${Math.random().toString(36).substr(2, 9)}`,
            name: apiCalendar.name,
            google_calendar_id: apiCalendar.google_calendar_id,
            is_active: apiCalendar.is_active,
            color: apiCalendar.color,
        }));
    } catch (error) {
        console.error("Failed to fetch calendars:", error);
        return [];
    }
}

async function upsertCalendar(calendarData: CalendarFormValues) {
    const responseData = await api.post(API_ROUTES.CALENDARS_UPSERT, calendarData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save calendar');
    }
    return responseData;
}

async function deleteCalendar(id: string, googleCalendarId: string) {
    const responseData = await api.delete(API_ROUTES.CALENDARS_DELETE, { id, google_calendar_id: googleCalendarId });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete calendar');
    }
    return responseData;
}

export default function CalendarsPage() {
    const t = useTranslations('CalendarsPage');
    const tNav = useTranslations('Navigation');
    const tValidation = useTranslations('CalendarsPage.validation');
    const { toast } = useToast();
    const isNarrow = useViewportNarrow();

    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedCalendar, setSelectedCalendar] = React.useState<CalendarType | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCalendar, setDeletingCalendar] = React.useState<CalendarType | null>(null);

    const form = useForm<CalendarFormValues>({
        resolver: zodResolver(calendarFormSchema(tValidation)),
        defaultValues: { name: '', google_calendar_id: '', color: '#ffffff', is_active: false },
    });

    const loadCalendars = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getCalendars();
        setCalendars(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => { loadCalendars(); }, [loadCalendars]);

    const handleRowSelection = (rows: CalendarType[]) => {
        const calendar = rows[0] ?? null;
        setSelectedCalendar(calendar);
        setSubmissionError(null);
        if (calendar) {
            setIsEditing(false);
            form.reset({ ...calendar, color: calendar.color || '#ffffff' });
        }
    };

    const handleCreate = () => {
        setSelectedCalendar(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ name: '', google_calendar_id: '', color: '#ffffff', is_active: false });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedCalendar(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedCalendar) {
            setIsEditing(false);
            form.reset({ ...selectedCalendar, color: selectedCalendar.color || '#ffffff' });
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: CalendarFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertCalendar(values);
            toast({ title: selectedCalendar ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadCalendars();
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
        if (!deletingCalendar) return;
        try {
            await deleteCalendar(deletingCalendar.id, deletingCalendar.google_calendar_id);
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingCalendar(null);
            handleClose();
            loadCalendars();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<CalendarType>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        {
            accessorKey: 'color',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.color')} />,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded border border-border" style={{ backgroundColor: row.original.color || '#ffffff' }} />
                </div>
            ),
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.active')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'} className="text-[10px]">{row.original.is_active ? 'Activo' : 'Inactivo'}</Badge>,
        },
    ];

    const isRightOpen = !!selectedCalendar;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Calendar className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{tNav('Calendars')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={calendars}
                    filterColumnId="name"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadCalendars}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedCalendar}
                    renderCard={(row: CalendarType, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.name}
                            subtitle={row.google_calendar_id}
                            accentColor={row.color || undefined}
                            badge={<Badge variant={row.is_active ? 'success' : 'outline'} className="text-[10px]">{row.is_active ? 'Activo' : 'Inactivo'}</Badge>}
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
                        <div className="header-icon-circle flex-none">
                            {selectedCalendar?.color ? (
                                <div className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: selectedCalendar.color }} />
                            ) : (
                                <Calendar className="h-5 w-5" />
                            )}
                        </div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedCalendar ? t('dialog.createTitle') : (selectedCalendar?.name ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedCalendar && !isEditing && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('dialog.save')}</span>
                            </Button>
                        )}
                        {selectedCalendar && !isEditing && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingCalendar(selectedCalendar); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedCalendar && !isEditing && (
                    <div className="ml-10 mt-1">
                        <Badge variant={selectedCalendar.is_active ? 'success' : 'outline'} className="text-[10px]">
                            {selectedCalendar.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
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
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.name')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('dialog.namePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="google_calendar_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.googleCalendarId')}</FormLabel>
                                <FormControl><Input type="email" {...field} disabled={!isEditing} placeholder={t('dialog.googleCalendarIdPlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="color" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.color')}</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input type="color" className="p-1 h-10 w-14" {...field} disabled={!isEditing} />
                                        <Input placeholder="#FFFFFF" {...field} disabled={!isEditing} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="is_active" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isEditing} /></FormControl>
                                <FormLabel className="font-normal">{t('dialog.active')}</FormLabel>
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedCalendar) form.reset({ ...selectedCalendar, color: selectedCalendar.color || '#ffffff' }); else handleClose(); }} disabled={isSaving}>
                                    {t('dialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedCalendar ? t('dialog.save') : t('dialog.create')}
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
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingCalendar?.name })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.delete')}</AlertDialogAction>
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
                        form.reset({ name: '', google_calendar_id: '', color: '#ffffff', is_active: false });
                    }
                }}
            >
                <DialogContent maxWidth="lg">
                    <DialogHeader>
                        <DialogTitle>{t('dialog.createTitle')}</DialogTitle>
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
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.name')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('dialog.namePlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="google_calendar_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.googleCalendarId')}</FormLabel>
                                        <FormControl><Input type="email" {...field} placeholder={t('dialog.googleCalendarIdPlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="color" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.color')}</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-2">
                                                <Input type="color" className="p-1 h-10 w-14" {...field} />
                                                <Input placeholder="#FFFFFF" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="is_active" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="font-normal">{t('dialog.active')}</FormLabel>
                                    </FormItem>
                                )} />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsCreateDialogOpen(false)}>
                                    {t('dialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('dialog.create')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
