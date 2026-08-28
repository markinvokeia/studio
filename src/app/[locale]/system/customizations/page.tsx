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
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import { Can } from '@/components/auth/Can';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';

import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';

import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { HookEvent, HookRegistration } from '@/lib/types';

import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Loader2, Pencil, Plus, Puzzle, Trash2, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// El mismo formato que fuerza el CHECK de hook_events.code y que validan los
// webhooks. Se repite aquí para dar el error antes de ir al servidor.
const EVENT_CODE_RE = /^[a-z][a-z0-9_]*\.(before|after)_[a-z0-9_]+$/;
// Un id de workflow de n8n, el que aparece en /workflow/<id>.
const HANDLER_REF_RE = /^[A-Za-z0-9_-]{8,40}$/;

const isJsonObject = (value?: string) => {
    if (!value || !value.trim()) return true;
    try {
        const parsed = JSON.parse(value);
        return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
    } catch {
        return false;
    }
};

const eventFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    code: z.string().min(1, t('codeRequired')).regex(EVENT_CODE_RE, t('codeFormat')),
    name: z.string().min(1, t('nameRequired')).max(120, t('nameMaxLength')),
    description: z.string().max(500, t('descriptionMaxLength')).optional(),
    module: z.string().min(1, t('moduleRequired')).max(40, t('moduleMaxLength')),
    timing: z.enum(['before', 'after']),
    payload_schema: z.string().optional().refine(isJsonObject, t('schemaInvalidJson')),
    payload_version: z.coerce.number().int().min(1, t('payloadVersionMin')),
    is_active: z.boolean().default(true),
}).refine(
    // El fragmento before/after del código y el campo timing tienen que decir lo
    // mismo: si no, el catálogo miente sobre cuándo corre el hook y quien escriba
    // la customización se equivoca sin manera de notarlo.
    (v) => !EVENT_CODE_RE.test(v.code) || (v.code.includes('.before_') ? 'before' : 'after') === v.timing,
    { message: t('timingMismatch'), path: ['timing'] },
);

type EventFormValues = z.infer<ReturnType<typeof eventFormSchema>>;

const registrationFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    event_code: z.string().min(1, t('eventCodeRequired')),
    name: z.string().min(1, t('nameRequired')).max(120, t('nameMaxLength')),
    description: z.string().max(500, t('descriptionMaxLength')).optional(),
    handler_ref: z.string().min(1, t('handlerRefRequired')).regex(HANDLER_REF_RE, t('handlerRefFormat')),
    seq: z.coerce.number().int().min(0, t('seqRange')).max(9999, t('seqRange')),
    mode: z.enum(['sync', 'async']),
    on_error: z.enum(['ignore', 'fail']),
    timeout_ms: z.coerce.number().int().min(1000, t('timeoutMin')).max(300000, t('timeoutMax')),
    config: z.string().optional().refine(isJsonObject, t('configInvalidJson')),
    log_enabled: z.boolean().default(true),
    is_active: z.boolean().default(true),
});

type RegistrationFormValues = z.infer<ReturnType<typeof registrationFormSchema>>;

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_SEQ = 100;

// ---------------------------------------------------------------------------
// Acceso a datos
//
// Los webhooks de n8n devuelven `[{}]` cuando el SELECT no trajo filas, y a veces
// responden 200 con un cuerpo de error (`[{ code: 4xx, message }]`). Ambos casos
// se desenvuelven aquí, igual que en el resto de las páginas de Sistema.
// ---------------------------------------------------------------------------

function unwrapError(response: any) {
    if (Array.isArray(response) && response.length > 0) {
        const first = response[0];
        if (first && (first.code >= 400 || first.error)) {
            throw new Error(first.message || first.error);
        }
    }
    if (response && typeof response === 'object' && !Array.isArray(response)) {
        if (response.error || response.code >= 400) {
            throw new Error(response.message || response.error);
        }
    }
    return response;
}

async function getHookEvents(search?: string): Promise<HookEvent[]> {
    const query: Record<string, string> = {};
    if (search) query.search = search;

    const response = await api.get(API_ROUTES.SYSTEM.HOOK_EVENTS, query);
    if (!Array.isArray(response)) return [];
    if (response.length === 1 && Object.keys(response[0]).length === 0) return [];
    unwrapError(response);

    return response.map((e: any) => ({
        ...e,
        payload_schema: e.payload_schema ?? {},
        implementations: Array.isArray(e.implementations) ? e.implementations : [],
        implementations_count: Number(e.implementations_count ?? 0),
        active_implementations_count: Number(e.active_implementations_count ?? 0),
    })) as HookEvent[];
}

async function upsertHookEvent(payload: Record<string, unknown>): Promise<HookEvent> {
    return unwrapError(await api.post(API_ROUTES.SYSTEM.HOOK_EVENTS_UPSERT, payload));
}

async function deleteHookEvent(id: string): Promise<void> {
    unwrapError(await api.delete(API_ROUTES.SYSTEM.HOOK_EVENTS_DELETE, { id }));
}

async function upsertRegistration(payload: Record<string, unknown>): Promise<HookRegistration> {
    return unwrapError(await api.post(API_ROUTES.SYSTEM.HOOK_REGISTRY_UPSERT, payload));
}

async function deleteRegistration(id: string): Promise<void> {
    unwrapError(await api.delete(API_ROUTES.SYSTEM.HOOK_REGISTRY_DELETE, { id }));
}

export default function CustomizationsPage() {
    const t = useTranslations('CustomizationsPage');
    const tValidation = useTranslations('CustomizationsPage.validation');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(SYSTEM_PERMISSIONS.CUSTOMIZATIONS_CREATE);
    const canUpdate = hasPermission(SYSTEM_PERMISSIONS.CUSTOMIZATIONS_UPDATE);
    const canDelete = hasPermission(SYSTEM_PERMISSIONS.CUSTOMIZATIONS_DELETE);
    const canManageEvents = hasPermission(SYSTEM_PERMISSIONS.CUSTOMIZATIONS_EVENTS_MANAGE);

    const [events, setEvents] = React.useState<HookEvent[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

    // Se guarda el id y no el objeto: así, tras recargar, el panel derecho
    // muestra siempre la versión fresca del evento sin re-sincronizar nada.
    const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
    const selectedEvent = React.useMemo(
        () => events.find((e) => e.id === selectedEventId) ?? null,
        [events, selectedEventId],
    );

    const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
    const [isEditingEvent, setIsEditingEvent] = React.useState(false);
    const [isRegDialogOpen, setIsRegDialogOpen] = React.useState(false);
    const [editingRegistration, setEditingRegistration] = React.useState<HookRegistration | null>(null);

    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const [deletingRegistration, setDeletingRegistration] = React.useState<HookRegistration | null>(null);
    const [deletingEvent, setDeletingEvent] = React.useState<HookEvent | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const eventForm = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema(tValidation)),
        defaultValues: {
            code: '', name: '', description: '', module: 'core',
            timing: 'after', payload_schema: '', payload_version: 1, is_active: true,
        },
    });

    const regForm = useForm<RegistrationFormValues>({
        resolver: zodResolver(registrationFormSchema(tValidation)),
        defaultValues: {
            event_code: '', name: '', description: '', handler_ref: '',
            seq: DEFAULT_SEQ, mode: 'sync', on_error: 'ignore',
            timeout_ms: DEFAULT_TIMEOUT_MS, config: '', log_enabled: true, is_active: true,
        },
    });

    const loadEvents = React.useCallback(async (filters: ColumnFiltersState) => {
        setIsRefreshing(true);
        try {
            const search = filters.find((f) => f.id === 'name')?.value as string | undefined;
            setEvents(await getHookEvents(search));
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.loadErrorDescription'),
            });
        } finally {
            setIsRefreshing(false);
            setIsLoading(false);
        }
    }, [toast, t]);

    React.useEffect(() => {
        loadEvents(columnFilters);
    }, [loadEvents, columnFilters]);

    const handleRowSelection = (rows: HookEvent[]) => {
        setSelectedEventId(rows.length > 0 ? rows[0].id : null);
    };

    const handleClose = () => {
        setSelectedEventId(null);
        setRowSelection({});
    };

    // -- Eventos del catálogo ------------------------------------------------

    const openCreateEvent = () => {
        setIsEditingEvent(false);
        setSubmissionError(null);
        eventForm.reset({
            code: '', name: '', description: '', module: 'core',
            timing: 'after', payload_schema: '', payload_version: 1, is_active: true,
        });
        setIsEventDialogOpen(true);
    };

    const openEditEvent = (event: HookEvent) => {
        setIsEditingEvent(true);
        setSubmissionError(null);
        eventForm.reset({
            id: event.id,
            code: event.code,
            name: event.name,
            description: event.description ?? '',
            module: event.module,
            timing: event.timing,
            payload_schema: JSON.stringify(event.payload_schema ?? {}, null, 2),
            payload_version: event.payload_version,
            is_active: event.is_active,
        });
        setIsEventDialogOpen(true);
    };

    const onSubmitEvent = async (values: EventFormValues) => {
        setIsSaving(true);
        setSubmissionError(null);
        try {
            const saved = await upsertHookEvent({
                id: values.id || null,
                code: values.code,
                name: values.name,
                description: values.description || null,
                module: values.module,
                timing: values.timing,
                payload_schema: values.payload_schema?.trim() ? JSON.parse(values.payload_schema) : {},
                payload_version: values.payload_version,
                is_active: values.is_active,
            });
            toast({
                title: isEditingEvent ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.name }),
            });
            setIsEventDialogOpen(false);
            if (saved?.id) setSelectedEventId(saved.id);
            await loadEvents(columnFilters);
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.submitErrorDescription'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDeleteEvent = async () => {
        if (!deletingEvent) return;
        setIsDeleting(true);
        try {
            await deleteHookEvent(deletingEvent.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteEventSuccessDescription', { name: deletingEvent.name }),
            });
            if (selectedEventId === deletingEvent.id) handleClose();
            setDeletingEvent(null);
            await loadEvents(columnFilters);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.deleteErrorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        } finally {
            setIsDeleting(false);
        }
    };

    // -- Implementaciones ----------------------------------------------------

    const openDefineRegistration = () => {
        if (!selectedEvent) return;
        setEditingRegistration(null);
        setSubmissionError(null);
        regForm.reset({
            event_code: selectedEvent.code,
            name: '', description: '', handler_ref: '',
            seq: DEFAULT_SEQ,
            // Un evento 'before' sólo admite modo síncrono: en asíncrono el hook
            // no puede devolver cambios ni frenar la operación.
            mode: 'sync',
            on_error: 'ignore',
            timeout_ms: DEFAULT_TIMEOUT_MS,
            config: '', log_enabled: true, is_active: true,
        });
        setIsRegDialogOpen(true);
    };

    const openEditRegistration = (registration: HookRegistration) => {
        setEditingRegistration(registration);
        setSubmissionError(null);
        regForm.reset({
            id: registration.id,
            event_code: registration.event_code,
            name: registration.name,
            description: registration.description ?? '',
            handler_ref: registration.handler_ref,
            seq: registration.seq,
            mode: registration.mode,
            on_error: registration.on_error,
            timeout_ms: registration.timeout_ms,
            config: JSON.stringify(registration.config ?? {}, null, 2),
            log_enabled: registration.log_enabled,
            is_active: registration.is_active,
        });
        setIsRegDialogOpen(true);
    };

    const onSubmitRegistration = async (values: RegistrationFormValues) => {
        setIsSaving(true);
        setSubmissionError(null);
        try {
            await upsertRegistration({
                id: values.id || null,
                event_code: values.event_code,
                name: values.name,
                description: values.description || null,
                // v1 sólo despacha sub-workflows de n8n; el campo no se muestra.
                handler_type: 'n8n_workflow',
                handler_ref: values.handler_ref,
                seq: values.seq,
                mode: values.mode,
                on_error: values.on_error,
                timeout_ms: values.timeout_ms,
                config: values.config?.trim() ? JSON.parse(values.config) : {},
                log_enabled: values.log_enabled,
                is_active: values.is_active,
            });
            toast({
                title: editingRegistration ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.name }),
            });
            setIsRegDialogOpen(false);
            await loadEvents(columnFilters);
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.submitErrorDescription'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDeleteRegistration = async () => {
        if (!deletingRegistration) return;
        setIsDeleting(true);
        try {
            await deleteRegistration(deletingRegistration.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingRegistration.name }),
            });
            setDeletingRegistration(null);
            await loadEvents(columnFilters);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.deleteErrorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        } finally {
            setIsDeleting(false);
        }
    };

    // -- Tabla ---------------------------------------------------------------

    const columns: ColumnDef<HookEvent>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} />,
            filterFn: () => true,
        },
        {
            accessorKey: 'code',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.code')} />,
            cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
        },
        {
            accessorKey: 'module',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.module')} />,
            cell: ({ row }) => <Badge variant="secondary">{row.original.module}</Badge>,
        },
        {
            accessorKey: 'timing',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.timing')} />,
            cell: ({ row }) => (
                <Badge variant={row.original.timing === 'before' ? 'warning' : 'info'}>
                    {t(`timing.${row.original.timing}`)}
                </Badge>
            ),
        },
        {
            id: 'implementations',
            accessorFn: (row) => row.active_implementations_count,
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.implementations')} />,
            cell: ({ row }) => (
                <Badge variant={row.original.active_implementations_count > 0 ? 'success' : 'outline'}>
                    {row.original.active_implementations_count}/{row.original.implementations_count}
                </Badge>
            ),
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => (
                <Badge variant={row.original.is_active ? 'success' : 'outline'}>
                    {row.original.is_active ? t('columns.yes') : t('columns.no')}
                </Badge>
            ),
        },
    ];

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Puzzle className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={events}
                    filterColumnId="name"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canManageEvents ? openCreateEvent : undefined}
                    createButtonLabel={t('createEvent')}
                    onRefresh={() => loadEvents(columnFilters)}
                    isRefreshing={isRefreshing}
                    isLoading={isLoading}
                    isNarrow={isNarrow || !!selectedEvent}
                    renderCard={(row: HookEvent, isSelected: boolean) => (
                        <DataCard
                            isSelected={isSelected}
                            title={row.name}
                            subtitle={row.code}
                            badge={(
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.active_implementations_count > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {row.active_implementations_count}/{row.implementations_count}
                                </span>
                            )}
                            showArrow
                        />
                    )}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                />
            </CardContent>
        </Card>
    );

    const implementations = selectedEvent?.implementations ?? [];

    const rightPanel = selectedEvent ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="header-icon-circle mt-0.5"><Puzzle className="h-5 w-5" /></div>
                        <div className="min-w-0">
                            <CardTitle className="text-lg truncate">{selectedEvent.name}</CardTitle>
                            <code className="text-xs text-muted-foreground break-all">{selectedEvent.code}</code>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <Badge variant="secondary">{selectedEvent.module}</Badge>
                                <Badge variant={selectedEvent.timing === 'before' ? 'warning' : 'info'}>
                                    {t(`timing.${selectedEvent.timing}`)}
                                </Badge>
                                {selectedEvent.is_system && <Badge variant="outline">{t('detail.systemEvent')}</Badge>}
                                {!selectedEvent.is_active && <Badge variant="destructive">{t('detail.inactive')}</Badge>}
                            </div>
                        </div>
                    </div>
                    {/* Un evento de sistema no se edita ni se borra: su code está embebido
                        en el flujo n8n que lo dispara. */}
                    {canManageEvents && (
                        <div className="flex-none flex items-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEditEvent(selectedEvent)}>
                                <Pencil className="h-4 w-4 mr-1.5" />{t('detail.editEvent')}
                            </Button>
                            {!selectedEvent.is_system && (
                                <Button variant="ghost" size="icon" onClick={() => setDeletingEvent(selectedEvent)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>

            <Separator />

            <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-4 mt-3 w-fit flex-none">
                    <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
                    <TabsTrigger value="implementations">
                        {t('tabs.implementations')} ({implementations.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex">
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedEvent.description && (
                            <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{t(`detail.timingHelp.${selectedEvent.timing}`)}</p>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium">{t('detail.payloadSchema')}</span>
                                <span className="text-xs text-muted-foreground">
                                    {t('detail.payloadVersion', { version: selectedEvent.payload_version })}
                                </span>
                            </div>
                            {/* El esquema no lleva max-h propio: el scroll es el del tab, así
                                no quedan dos barras anidadas compitiendo. */}
                            <pre className="text-[11px] leading-relaxed bg-muted rounded-md border p-3 overflow-x-auto">
                                {JSON.stringify(selectedEvent.payload_schema ?? {}, null, 2)}
                            </pre>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="implementations" className="mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex">
                    {implementations.length > 0 && (
                        <div className="flex-none flex items-center justify-end gap-2 px-4 pt-4">
                            <Can permission={SYSTEM_PERMISSIONS.CUSTOMIZATIONS_CREATE}>
                                <Button size="sm" onClick={openDefineRegistration}>
                                    <Plus className="h-4 w-4 mr-1.5" />{t('detail.define')}
                                </Button>
                            </Can>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4">
                    {implementations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center gap-3 rounded-md border border-dashed py-10 px-4">
                            <Webhook className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">{t('detail.noImplementations')}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t('detail.noImplementationsHint')}</p>
                            </div>
                            <Can
                                permission={SYSTEM_PERMISSIONS.CUSTOMIZATIONS_CREATE}
                                fallback={<p className="text-xs text-muted-foreground">{t('detail.noPermissionToDefine')}</p>}
                            >
                                <Button size="sm" onClick={openDefineRegistration}>
                                    <Plus className="h-4 w-4 mr-1.5" />{t('detail.define')}
                                </Button>
                            </Can>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {implementations.map((impl) => (
                                <li key={impl.id} className="rounded-md border p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <span className="flex-none mt-0.5 text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                {impl.seq}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{impl.name}</p>
                                                <code className="text-[11px] text-muted-foreground break-all">{impl.handler_ref}</code>
                                                {impl.description && (
                                                    <p className="text-xs text-muted-foreground mt-1">{impl.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-none flex items-center gap-1">
                                            {canUpdate && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRegistration(impl)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletingRegistration(impl)}>
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                        <Badge variant="outline">{t(`detail.modes.${impl.mode}`)}</Badge>
                                        <Badge variant={impl.on_error === 'fail' ? 'destructive' : 'outline'}>
                                            {t(`detail.errors.${impl.on_error}`)}
                                        </Badge>
                                        <Badge variant={impl.is_active ? 'success' : 'outline'}>
                                            {impl.is_active ? t('detail.active') : t('detail.inactive')}
                                        </Badge>
                                        {impl.last_status && (
                                            <Badge variant={impl.last_status === 'error' ? 'destructive' : 'secondary'}>
                                                {t(`detail.status.${impl.last_status}`)}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-2">
                                        {t('detail.lastExecuted')}:{' '}
                                        {impl.last_executed_at ? formatDateTime(impl.last_executed_at) : t('detail.never')}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                    </div>
                </TabsContent>
            </Tabs>
        </Card>
    ) : null;

    // El diálogo de implementación sólo se abre con un evento seleccionado, y
    // ambos caminos (definir / editar) fijan event_code a partir de él, así que
    // el timing del evento seleccionado es la fuente de verdad. Derivarlo con
    // regForm.watch() sería redundante y desactivaría la memoización de toda la
    // página.
    const isBeforeEvent = selectedEvent?.timing === 'before';

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                isRightPanelOpen={!!selectedEvent}
                onBack={handleClose}
                leftPanelDefaultSize={40}
                rightPanelDefaultSize={60}
            />

            {/* --- Diálogo: tipo de hook (catálogo) --- */}
            <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                <DialogContent maxWidth="2xl" confirmOnClose isDirty={eventForm.formState.isDirty}>
                    <DialogHeader>
                        <DialogTitle>{isEditingEvent ? t('eventDialog.editTitle') : t('eventDialog.createTitle')}</DialogTitle>
                        <DialogDescription>{t('eventDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...eventForm}>
                        <form onSubmit={eventForm.handleSubmit(onSubmitEvent)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField control={eventForm.control} name="code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('eventDialog.code')}</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder={t('eventDialog.codePlaceholder')} disabled={isEditingEvent && selectedEvent?.is_system} />
                                            </FormControl>
                                            <FormDescription className="text-xs">{t('eventDialog.codeHelp')}</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={eventForm.control} name="timing" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('eventDialog.timing')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={isEditingEvent && selectedEvent?.is_system}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="before">{t('timing.before')}</SelectItem>
                                                    <SelectItem value="after">{t('timing.after')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={eventForm.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('eventDialog.name')}</FormLabel>
                                            <FormControl><Input {...field} placeholder={t('eventDialog.namePlaceholder')} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={eventForm.control} name="module" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('eventDialog.module')}</FormLabel>
                                            <FormControl><Input {...field} placeholder={t('eventDialog.modulePlaceholder')} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={eventForm.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('eventDialog.descriptionLabel')}</FormLabel>
                                        <FormControl><Textarea {...field} rows={2} placeholder={t('eventDialog.descriptionPlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={eventForm.control} name="payload_schema" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('eventDialog.payloadSchema')}</FormLabel>
                                        <FormControl><Textarea {...field} rows={8} className="font-mono text-xs" placeholder="{}" /></FormControl>
                                        <FormDescription className="text-xs">{t('eventDialog.payloadSchemaHelp')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField control={eventForm.control} name="payload_version" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('eventDialog.payloadVersion')}</FormLabel>
                                            <FormControl><Input {...field} type="number" min={1} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={eventForm.control} name="is_active" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center gap-2 pt-8">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className="!mt-0">{t('eventDialog.isActive')}</FormLabel>
                                        </FormItem>
                                    )} />
                                </div>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {isSaving ? t('eventDialog.saving') : t('eventDialog.save')}
                                </Button>
                                <DialogCancelButton>{t('eventDialog.cancel')}</DialogCancelButton>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* --- Diálogo: implementación --- */}
            <Dialog open={isRegDialogOpen} onOpenChange={setIsRegDialogOpen}>
                <DialogContent maxWidth="2xl" confirmOnClose isDirty={regForm.formState.isDirty}>
                    <DialogHeader>
                        <DialogTitle>{editingRegistration ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                        <DialogDescription>{t('dialog.description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...regForm}>
                        <form onSubmit={regForm.handleSubmit(onSubmitRegistration)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                <FormField control={regForm.control} name="event_code" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.event')}</FormLabel>
                                        <FormControl><Input {...field} readOnly className="font-mono text-xs bg-muted" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField control={regForm.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.name')}</FormLabel>
                                            <FormControl><Input {...field} placeholder={t('dialog.namePlaceholder')} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={regForm.control} name="handler_ref" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.handlerRef')}</FormLabel>
                                            <FormControl><Input {...field} className="font-mono text-xs" placeholder={t('dialog.handlerRefPlaceholder')} /></FormControl>
                                            <FormDescription className="text-xs">{t('dialog.handlerRefHelp')}</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={regForm.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.descriptionLabel')}</FormLabel>
                                        <FormControl><Textarea {...field} rows={2} placeholder={t('dialog.descriptionPlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <FormField control={regForm.control} name="seq" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.seq')}</FormLabel>
                                            <FormControl><Input {...field} type="number" min={0} max={9999} /></FormControl>
                                            <FormDescription className="text-xs">{t('dialog.seqHelp')}</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={regForm.control} name="mode" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.mode')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="sync">{t('detail.modes.sync')}</SelectItem>
                                                    {/* Un hook asíncrono no puede devolver un patch ni frenar la
                                                        operación, así que en un evento 'before' sería un fallo silencioso. */}
                                                    <SelectItem value="async" disabled={isBeforeEvent}>{t('detail.modes.async')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs">
                                                {isBeforeEvent ? t('dialog.asyncDisabledForBefore') : t('dialog.modeHelp')}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={regForm.control} name="on_error" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.onError')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="ignore">{t('detail.errors.ignore')}</SelectItem>
                                                    <SelectItem value="fail">{t('detail.errors.fail')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs">{t('dialog.onErrorHelp')}</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={regForm.control} name="timeout_ms" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.timeout')}</FormLabel>
                                        <FormControl><Input {...field} type="number" min={1000} max={300000} step={1000} /></FormControl>
                                        <FormDescription className="text-xs">{t('dialog.timeoutHelp')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={regForm.control} name="config" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.config')}</FormLabel>
                                        <FormControl><Textarea {...field} rows={5} className="font-mono text-xs" placeholder="{}" /></FormControl>
                                        <FormDescription className="text-xs">{t('dialog.configHelp')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="flex flex-wrap items-center gap-6">
                                    <FormField control={regForm.control} name="log_enabled" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center gap-2">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className="!mt-0">{t('dialog.logEnabled')}</FormLabel>
                                        </FormItem>
                                    )} />
                                    <FormField control={regForm.control} name="is_active" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center gap-2">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className="!mt-0">{t('dialog.isActive')}</FormLabel>
                                        </FormItem>
                                    )} />
                                </div>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {isSaving ? t('dialog.saving') : t('dialog.save')}
                                </Button>
                                <DialogCancelButton>{t('dialog.cancel')}</DialogCancelButton>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* --- Confirmación: borrar implementación --- */}
            <AlertDialog open={!!deletingRegistration} onOpenChange={(open) => !open && setDeletingRegistration(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description', { name: deletingRegistration?.name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteRegistration} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t('deleteDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* --- Confirmación: borrar tipo de hook --- */}
            <AlertDialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteEventDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteEventDialog.description', { name: deletingEvent?.name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('deleteEventDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteEvent} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t('deleteEventDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
