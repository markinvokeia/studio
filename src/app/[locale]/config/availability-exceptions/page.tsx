
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Dialog,
    DialogBody,
    DialogCancelButton,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
    AvailabilityExceptionFields,
    availabilityExceptionFormSchema,
    availabilityExceptionToFormValues,
    deleteAvailabilityException,
    emptyAvailabilityExceptionForm,
    parseAvailabilityException,
    upsertAvailabilityException,
    type AvailabilityExceptionFormValues,
} from '@/components/doctor-availability/availability-exception-form';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { multiDateLabel, MultiDatePicker } from '@/components/schedules/day-pickers';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { getErrorMessage } from '@/lib/error-utils';
import { AvailabilityException, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api, isTimeoutError } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Check, ChevronsUpDown, Pencil, Trash2, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { createDefaultPagination } from '@/lib/pagination';

type GetExceptionsResponse = {
    exceptions: AvailabilityException[];
    total: number;
};

async function getAvailabilityExceptions(pagination: PaginationState, searchQuery: string, signal?: AbortSignal): Promise<GetExceptionsResponse> {
    const responseData = await api.get(API_ROUTES.AVAILABILITY_EXCEPTIONS_SEARCH, {
        page: (pagination.pageIndex + 1).toString(),
        limit: pagination.pageSize.toString(),
        search: searchQuery,
    }, undefined, { signal });
    const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
    const exceptionsData = data?.data || [];
    const total = Number(data?.total) || 0;
    return {
        exceptions: exceptionsData.map(parseAvailabilityException),
        total
    };
}

async function getDoctors(signal?: AbortSignal): Promise<User[]> {
    const data = await api.get(API_ROUTES.USERS_DOCTORS, undefined, undefined, { signal });
    const doctorsData = Array.isArray(data) ? data : (data?.doctors || data?.data || []);
    return doctorsData.map((doc: any) => ({ ...doc, id: String(doc.id) }));
}

export default function AvailabilityExceptionsPage() {
    const t = useTranslations('DoctorAvailabilityExceptionsPage');
    const tValidation = useTranslations('DoctorAvailabilityExceptionsPage.validation');
    const tColumns = useTranslations('DoctorAvailabilityExceptionsPage.columns');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const isNarrow = useViewportNarrow();

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingException, setEditingException] = React.useState<AvailabilityException | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingException, setDeletingException] = React.useState<AvailabilityException | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [pagination, setPagination] = React.useState<PaginationState>(createDefaultPagination);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedException, setSelectedException] = React.useState<AvailabilityException | null>(null);

    const onInvalidSubmit = useInvalidSubmitToast();
    const form = useForm<AvailabilityExceptionFormValues>({
        resolver: zodResolver(availabilityExceptionFormSchema(tValidation)),
        defaultValues: emptyAvailabilityExceptionForm(),
    });
    const [isDoctorComboboxOpen, setIsDoctorComboboxOpen] = React.useState(false);

    const searchQuery = (columnFilters.find(f => f.id === 'user_name')?.value as string) || '';
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Only the latest page/search request may write the table: a slow "ju" can't overwrite "juan".
    const {
        data: { exceptions, total: exceptionCount },
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadExceptions,
    } = useDataLoader(
        (signal) => getAvailabilityExceptions(pagination, debouncedSearch, signal),
        { exceptions: [] as AvailabilityException[], total: 0 },
        [pagination.pageIndex, pagination.pageSize, debouncedSearch]
    );

    React.useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    const { data: doctors, error: doctorsError, reload: loadDoctors } = useDataLoader(getDoctors, [] as User[], [], { enabled: isDialogOpen });

    // Keep the detail panel in sync with the refreshed list (e.g. after editing it).
    React.useEffect(() => {
        setSelectedException((current) => (current ? exceptions.find((ex) => ex.id === current.id) ?? current : current));
    }, [exceptions]);

    const handleCreate = () => {
        setEditingException(null);
        form.reset(emptyAvailabilityExceptionForm());
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (exception: AvailabilityException) => {
        setEditingException(exception);
        form.reset(availabilityExceptionToFormValues(exception));
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (exception: AvailabilityException) => {
        setDeletingException(exception);
        setIsDeleteDialogOpen(true);
    };

    const remove = useAsyncAction(
        async (exception: AvailabilityException) => {
            await deleteAvailabilityException(exception.id);
            return exception;
        },
        {
            onSuccess: async (exception) => {
                toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription') });
                setIsDeleteDialogOpen(false);
                setDeletingException(null);
                if (selectedException?.id === exception.id) {
                    setSelectedException(null);
                    setRowSelection({});
                }
                await loadExceptions();
            },
            onError: (error) => { if (isTimeoutError(error)) loadExceptions(); },
            errorTitle: t('toast.deleteError'),
        }
    );

    const save = useAsyncAction(
        async (values: AvailabilityExceptionFormValues) => {
            setSubmissionError(null);
            await upsertAvailabilityException(values);
            return values;
        },
        {
            onSuccess: async (values) => {
                toast({ title: values.id ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription') });
                await loadExceptions();
                setIsDialogOpen(false);
            },
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The exception may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadExceptions();
                    return;
                }
                setSubmissionError(getErrorMessage(error) || t('toast.saveError'));
            },
            showErrorToast: false,
        }
    );

    const handleRowSelection = (rows: AvailabilityException[]) => {
        setSelectedException(rows[0] ?? null);
    };

    const handleBack = () => {
        setSelectedException(null);
        setRowSelection({});
    };

    const columns: ColumnDef<AvailabilityException>[] = React.useMemo(() => [
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />, enableHiding: true },
        { accessorKey: 'user_name', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('doctor')} /> },
        {
            accessorKey: 'exception_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('date')} />,
            cell: ({ row }) => <span>{multiDateLabel(row.original.dates, row.original.exception_date)}</span>,
        },
        {
            accessorKey: 'is_available',
            header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('available')} />,
            cell: ({ row }) => (
                <Badge variant={row.original.is_available ? 'success' : 'destructive'}>
                    {row.original.is_available ? 'Disponible' : 'No disponible'}
                </Badge>
            ),
        },
        { accessorKey: 'start_time', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('startTime')} /> },
        { accessorKey: 'end_time', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('endTime')} /> },
    ], [tColumns]);

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><UserX className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={exceptions}
                    pageCount={Math.ceil(exceptionCount / pagination.pageSize)}
                    rowCount={exceptionCount}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    manualPagination={true}
                    filterColumnId="user_name"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadExceptions}
                    isRefreshing={isRefreshing}
                    isLoading={isLoading}
                    loadError={loadError}
                    isNarrow={isNarrow || !!selectedException}
                    renderCard={(row: AvailabilityException, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.user_name || row.user_id}
                            subtitle={multiDateLabel(row.dates, row.exception_date)}
                            badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.is_available ? 'Disponible' : 'No disponible'}</span>}
                            showArrow
                        />
                    )}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    columnVisibility={{ id: false }}
                />
            </CardContent>
        </Card>
    );

    const rightPanel = selectedException ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><UserX className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedException.user_name || selectedException.user_id}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{multiDateLabel(selectedException.dates, selectedException.exception_date)}</p>
                    </div>
                    <div className="flex gap-1 flex-none">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(selectedException)}>
                            <Pencil className="h-4 w-4 mr-1" />Editar
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" aria-label={t('deleteDialog.confirm')} onClick={() => handleDelete(selectedException)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('doctor')}</dt>
                        <dd className="text-foreground">{selectedException.user_name || selectedException.user_id || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{tColumns('date')}</dt>
                        <dd><MultiDatePicker value={selectedException.dates} onChange={() => undefined} readOnly /></dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('available')}</dt>
                        <dd><Badge variant={selectedException.is_available ? 'success' : 'destructive'}>{selectedException.is_available ? 'Disponible' : 'No disponible'}</Badge></dd>
                    </div>
                    {(selectedException.start_time || selectedException.end_time) && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('startTime')}</dt>
                                <dd className="text-foreground">{selectedException.start_time || '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{tColumns('endTime')}</dt>
                                <dd className="text-foreground">{selectedException.end_time || '-'}</dd>
                            </div>
                        </div>
                    )}
                </dl>
            </CardContent>
        </Card>
    ) : <div />;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                isRightPanelOpen={!!selectedException}
                onBack={handleBack}
                leftPanelDefaultSize={50}
                rightPanelDefaultSize={50}
            />
            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open && save.isPending) return;
                    setIsDialogOpen(open);
                }}
            >
                <DialogContent confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
                    <DialogHeader>
                        <DialogTitle>{editingException ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(save.run, onInvalidSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 py-4 px-6">
                                {/* Native fieldset disables every control while the request is in flight */}
                                <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                <FormField
                                    control={form.control}
                                    name="user_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.doctor')}</FormLabel>
                                            <Popover open={isDoctorComboboxOpen} onOpenChange={setIsDoctorComboboxOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                            {field.value ? doctors.find(doc => doc.id === field.value)?.name : t('dialog.selectDoctor')}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder={t('dialog.searchDoctor')} />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                {doctorsError ? (
                                                                    <span className="flex flex-col items-center gap-2">
                                                                        {tCommon('loadError')}
                                                                        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => loadDoctors()}>{tCommon('retry')}</Button>
                                                                    </span>
                                                                ) : t('dialog.noDoctorFound')}
                                                            </CommandEmpty>
                                                            <CommandGroup>
                                                                {doctors.map((doctor) => (
                                                                    <CommandItem
                                                                        value={doctor.name}
                                                                        key={doctor.id}
                                                                        onSelect={() => {
                                                                            form.setValue("user_id", doctor.id);
                                                                            setIsDoctorComboboxOpen(false);
                                                                        }}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", doctor.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                        {doctor.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <AvailabilityExceptionFields form={form} />
                                </fieldset>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit" loading={save.isPending}>{editingException ? t('dialog.save') : t('dialog.create')}</Button>
                                <DialogCancelButton disabled={save.isPending}>{t('dialog.cancel')}</DialogCancelButton>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <ConfirmActionDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('deleteDialog.title')}
                description={t('deleteDialog.description', {
                    doctor: deletingException?.user_name || deletingException?.user_id || '',
                    date: deletingException ? multiDateLabel(deletingException.dates, deletingException.exception_date) : '',
                })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingException) remove.run(deletingException); }}
                isPending={remove.isPending}
            />
        </div>
    );
}
