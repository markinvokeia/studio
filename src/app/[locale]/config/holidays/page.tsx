'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableAdvancedToolbar } from '@/components/ui/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from "@/components/ui/form";
import { Separator } from '@/components/ui/separator';
import { EMPTY_EXCEPTION_FORM, ExceptionFormFields, exceptionFormSchema, type ExceptionFormValues } from '@/components/holidays/exception-form-fields';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { multiDateLabel, useWeekdayListLabel } from '@/components/schedules/day-pickers';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { parseClinicExceptions } from '@/lib/clinic-exceptions';
import { getErrorMessage } from '@/lib/error-utils';
import { ClinicException } from '@/lib/types';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, CalendarOff, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';

async function getHolidays(signal?: AbortSignal): Promise<ClinicException[]> {
        const data = await api.get(API_ROUTES.EXCEPTIONS, undefined, undefined, { signal });
        return parseClinicExceptions(data);
}

function mapHolidayToFormValues(holiday: ClinicException): ExceptionFormValues {
    return {
        id: holiday.id,
        // Already ISO (yyyy-MM-dd) — the DatePicker/Input handle this directly.
        date: holiday.date,
        dates: holiday.dates ?? [],
        is_open: holiday.is_open,
        start_time: holiday.start_time ?? '',
        end_time: holiday.end_time ?? '',
        sede_id: holiday.sede_id ?? '',
        notes: holiday.notes ?? '',
        recurrence: holiday.recurrence ?? 'once',
        days_of_week: holiday.days_of_week ?? [],
        days_of_month: holiday.days_of_month ?? [],
        biweekly_reference_date: holiday.biweekly_reference_date ?? '',
        end_date: holiday.end_date ?? '',
    };
}

async function upsertHoliday(holidayData: ExceptionFormValues) {
    const isOnce = holidayData.recurrence === 'once';
    const isWeekly = holidayData.recurrence === 'weekly' || holidayData.recurrence === 'biweekly';
    const dates = [...holidayData.dates].sort();
    const payload = {
        ...holidayData,
        // 'once': la fila se ordena por su primera fecha.
        date: isOnce ? dates[0] : holidayData.date,
        // Sólo viaja la lista de la recurrencia elegida; las demás van en NULL.
        dates: isOnce ? dates : null,
        days_of_week: isWeekly ? holidayData.days_of_week : null,
        days_of_month: holidayData.recurrence === 'monthly' ? holidayData.days_of_month : null,
        // '' = todas las sedes -> NULL en la columna. Number('') es 0, que sería
        // una FK inválida, de ahí el branch explícito.
        sede_id: holidayData.sede_id ? Number(holidayData.sede_id) : null,
        // NULL y no '': una hora vacía tiene que limpiar la columna en vez de
        // fallar el cast a `time`. Un cierre sin horas cierra el día completo.
        start_time: holidayData.start_time || null,
        end_time: holidayData.end_time || null,
        biweekly_reference_date: holidayData.biweekly_reference_date || null,
        end_date: holidayData.end_date || null,
    };
    const responseData = await api.post(API_ROUTES.HOLIDAYS_UPSERT, payload, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (responseData && typeof responseData === 'object' && responseData.error === true) {
        throw new Error(responseData.message || 'Failed to save holiday');
    }
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save holiday');
    }
    return responseData;
}

async function deleteHoliday(id: string) {
    const responseData = await api.delete(API_ROUTES.HOLIDAYS_DELETE, { id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete holiday');
    }
    return responseData;
}

/** Fecha de la regla para lista y títulos: 'once' con varias fechas muestra la primera y cuántas más. */
function holidayDateLabel(holiday: ClinicException): string {
    return multiDateLabel(holiday.dates, holiday.date);
}

export default function HolidaysPage() {
    const t = useTranslations('HolidaysPage');
    const tNav = useTranslations('Navigation');
    const tValidation = useTranslations('HolidaysPage.validation');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const { sedes } = useAuth();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_DELETE);

    const { data: holidays, isLoading, isRefreshing, error: loadError, reload: loadHolidays } = useDataLoader(getHolidays, [] as ClinicException[]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedHoliday, setSelectedHoliday] = React.useState<ClinicException | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingHoliday, setDeletingHoliday] = React.useState<ClinicException | null>(null);

    const onInvalidSubmit = useInvalidSubmitToast();
    const form = useForm<ExceptionFormValues>({
        resolver: zodResolver(exceptionFormSchema(tValidation)),
        defaultValues: EMPTY_EXCEPTION_FORM,
    });


    const filteredHolidays = React.useMemo(() => {
        if (!searchQuery) return holidays;
        return holidays.filter(h =>
            Object.values(h).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [holidays, searchQuery]);

    const handleRowSelection = (rows: ClinicException[]) => {
        const holiday = rows[0] ?? null;
        // Don't drop an in-flight save or unsaved edits by clicking another row.
        if (save.isPending || (isEditing && form.formState.isDirty && !window.confirm(tCommon('unsavedChangesConfirm')))) {
            setRowSelection(selectedHoliday ? { [selectedHoliday.id]: true } : {});
            return;
        }
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
        form.reset(EMPTY_EXCEPTION_FORM);
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedHoliday(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (save.isPending) return;
        if (isEditing && form.formState.isDirty && !window.confirm(tCommon('unsavedChangesConfirm'))) return;
        if (isEditing && selectedHoliday) {
            setIsEditing(false);
            form.reset(mapHolidayToFormValues(selectedHoliday));
        } else {
            handleClose();
        }
    };

    const save = useAsyncAction(
        async (values: ExceptionFormValues) => {
            setSubmissionError(null);
            await upsertHoliday(values);
            return values;
        },
        {
            onSuccess: async (values) => {
                toast({ title: values.id ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription') });
                const fresh = await loadHolidays();
                setIsEditing(false);
                if (!values.id) {
                    setIsCreateDialogOpen(false);
                    handleClose();
                    return;
                }
                const updated = fresh?.find((h) => h.id === values.id);
                if (updated) { setSelectedHoliday(updated); form.reset(mapHolidayToFormValues(updated)); }
            },
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The exception may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadHolidays();
                    return;
                }
                setSubmissionError(getErrorMessage(error) || t('toast.genericError'));
            },
            showErrorToast: false,
        }
    );

    const remove = useAsyncAction(
        (holiday: ClinicException) => deleteHoliday(holiday.id),
        {
            onSuccess: async () => {
                toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription') });
                setIsDeleteDialogOpen(false);
                setDeletingHoliday(null);
                handleClose();
                await loadHolidays();
            },
            onError: (error) => { if (isTimeoutError(error)) loadHolidays(); },
            errorTitle: t('toast.deleteErrorDescription'),
        }
    );

    // Nombre de la sede de una excepción; sin sede aplica a toda la clínica.
    const sedeLabel = React.useCallback((sedeId?: string, sedeName?: string) => {
        if (!sedeId) return t('createDialog.allSedes');
        return sedeName || sedes.find((s) => String(s.id) === String(sedeId))?.name || sedeId;
    }, [sedes, t]);

    const columnTranslations = {
        id: t('columns.id'),
        date: t('columns.date'),
        recurrence: t('columns.recurrence'),
        is_open: t('columns.status'),
        start_time: t('columns.startTime'),
        end_time: t('columns.endTime'),
        sede_id: t('columns.sede'),
        notes: t('columns.notes'),
    };

    // Resumen legible de la recurrencia para la tabla y las tarjetas.
    const tDayPickers = useTranslations('DayPickers');
    const weekdayListLabel = useWeekdayListLabel();
    const recurrenceLabel = React.useCallback((holiday: ClinicException) => {
        const recurrence = holiday.recurrence ?? 'once';
        if (recurrence === 'once') {
            const count = holiday.dates?.length ?? 1;
            return count > 1 ? `${t('createDialog.once')} · ${tDayPickers('datesCount', { count })}` : t('createDialog.once');
        }
        if (recurrence === 'monthly') return `${t('createDialog.monthly')} · ${holiday.days_of_month?.join(', ') || '-'}`;
        return `${t(`createDialog.${recurrence}`)} · ${weekdayListLabel(holiday.days_of_week)}`;
    }, [t, tDayPickers, weekdayListLabel]);

    const columns: ColumnDef<ClinicException>[] = [
        { accessorKey: 'date', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} />, cell: ({ row }) => holidayDateLabel(row.original) },
        {
            accessorKey: 'recurrence',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.recurrence')} />,
            cell: ({ row }) => <span>{recurrenceLabel(row.original)}</span>,
        },
        {
            accessorKey: 'is_open',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
            cell: ({ row }) => <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.original.is_open ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{row.original.is_open ? 'Abierto' : 'Cerrado'}</span>,
        },
        {
            accessorKey: 'sede_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.sede')} />,
            cell: ({ row }) => (
                <span className={row.original.sede_id ? undefined : 'text-muted-foreground'}>
                    {sedeLabel(row.original.sede_id, row.original.sede_name)}
                </span>
            ),
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
                    isLoading={isLoading}
                    loadError={loadError}
                    onRefresh={loadHolidays}
                    isRefreshing={isRefreshing}
                    columnTranslations={columnTranslations}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedHoliday}
                    customToolbar={(table, pagination) => (
                        <DataTableAdvancedToolbar
                            table={table}
                            endSlot={pagination}
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
                            title={holidayDateLabel(row)}
                            subtitle={[recurrenceLabel(row), row.notes || (row.is_open ? `${row.start_time} – ${row.end_time}` : ''), sedeLabel(row.sede_id, row.sede_name)].filter(Boolean).join(' · ')}
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
                            {isEditing && !selectedHoliday ? t('createDialog.title') : (selectedHoliday ? holidayDateLabel(selectedHoliday) : '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedHoliday && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('createDialog.edit')}</span>
                            </Button>
                        )}
                        {selectedHoliday && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" aria-label={t('deleteDialog.confirm')} onClick={() => { setDeletingHoliday(selectedHoliday); setIsDeleteDialogOpen(true); }}>
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
                    <form onSubmit={form.handleSubmit(save.run, onInvalidSubmit)} className="space-y-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
                        {/* Native fieldset disables every control while the request is in flight */}
                        <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                        <ExceptionFormFields form={form} readOnly={!isEditing} sedes={sedes} />
                        </fieldset>
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setSubmissionError(null); if (selectedHoliday) form.reset(mapHolidayToFormValues(selectedHoliday)); else handleClose(); }} disabled={save.isPending}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" loading={save.isPending}>
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
            <ConfirmActionDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('deleteDialog.title')}
                description={t('deleteDialog.description', { date: deletingHoliday ? holidayDateLabel(deletingHoliday) : '' })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingHoliday) remove.run(deletingHoliday); }}
                isPending={remove.isPending}
            />
            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={(open) => {
                    if (!open && save.isPending) return;
                    setIsCreateDialogOpen(open);
                    if (!open) {
                        setIsEditing(false);
                        setSubmissionError(null);
                        form.reset(EMPTY_EXCEPTION_FORM);
                    }
                }}
            >
                <DialogContent maxWidth="lg" confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
                    <DialogHeader>
                        <DialogTitle>{t('createDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(save.run, onInvalidSubmit)} className="flex flex-col min-h-0">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                {/* Native fieldset disables every control while the request is in flight */}
                                <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                                <ExceptionFormFields form={form} sedes={sedes} />
                                </fieldset>
                            </DialogBody>
                            <DialogFooter>
                                <DialogCancelButton disabled={save.isPending}>
                                    {t('createDialog.cancel')}
                                </DialogCancelButton>
                                <Button type="submit" loading={save.isPending}>
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
