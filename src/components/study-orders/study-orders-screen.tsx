'use client';

import * as React from 'react';
import type { ColumnFiltersState, PaginationState, RowSelectionState, SortingState } from '@tanstack/react-table';
import { ClipboardList, Pencil } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout, useNarrowMode } from '@/components/layout/two-panel-layout';

import { StudyOrderColumnsWrapper } from '@/app/[locale]/study-orders/columns';
import { StudyOrderDetailPanel } from './study-order-detail-panel';
import { StudyOrderRescheduleDialog } from './study-order-reschedule-dialog';
import { StudyOrderWizard } from './study-order-wizard';
import { referralLabel } from './study-order-referral-line';
import { StudyOrderStatusBadge } from './study-order-status-badge';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { formatDisplayDate } from '@/lib/utils';
import { useStudyOrderScheduling } from '@/stores/study-order-scheduling-store';
import type { StudyOrder, StudyOrderListItem } from '@/lib/types';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import {
    acknowledgeStudyOrder,
    cancelStudyOrder,
    deleteStudyOrder,
    getStudyOrder,
    getStudyOrders,
    submitStudyOrder,
    type StudyOrderScope,
} from '@/services/study-orders';

/**
 * Pantalla de órdenes de estudio. Las dos vistas del producto — "Mis Órdenes"
 * del derivador y "Órdenes" de la clínica — son esta misma pantalla con otro
 * `scope`: cambia el filtro del backend, aparece la columna del derivador y se
 * habilitan las acciones operativas. Mantenerlas como un solo componente evita
 * que se separen con el tiempo.
 */

/** Horas sin agendar desde el envío a partir de las cuales la orden va a "atrasadas". */
const DEFAULT_SLA_HOURS = 48;

/**
 * Lo mínimo que necesita un diálogo de confirmación. Tanto `StudyOrderListItem`
 * (la fila de la tabla) como `StudyOrder` (lo que carga el detalle) lo cumplen,
 * así que las acciones sirven desde los dos lados sin convertir nada.
 */
interface PendingOrder {
    id: string;
    order_number: string;
    patient_name: string;
}

export interface StudyOrdersScreenProps {
    scope: StudyOrderScope;
}

interface TableWithCardsProps {
    /**
     * En "Mis Órdenes" todas las filas son del mismo derivador —el que está
     * mirando—, así que repetir "derivado por X" en cada tarjeta no informa
     * nada. Sólo se muestra en la bandeja de la clínica, donde conviven órdenes
     * de distintos doctores.
     */
    scope: StudyOrderScope;
    orders: StudyOrderListItem[];
    total: number;
    columns: ReturnType<typeof StudyOrderColumnsWrapper>;
    selected: StudyOrderListItem | null;
    rowSelection: RowSelectionState;
    setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
    onRowSelect: (rows: StudyOrderListItem[]) => void;
    pagination: PaginationState;
    setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
    sorting: SortingState;
    setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
    columnFilters: ColumnFiltersState;
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
    bucket: string;
    onBucketChange: (value: string) => void;
    onCreate?: () => void;
    onEditOrder?: (order: StudyOrderListItem) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    isLoading: boolean;
}

/**
 * Subcomponente obligatorio: `useNarrowMode()` sólo devuelve algo distinto de
 * `false` dentro del subárbol de `leftPanel`, así que la decisión de mostrar
 * tarjetas en vez de tabla tiene que tomarse acá adentro y no en la página.
 */
function StudyOrdersTableWithCards({
    scope,
    orders, total, columns, selected, rowSelection, setRowSelection, onRowSelect,
    pagination, setPagination, sorting, setSorting, columnFilters, setColumnFilters,
    bucket, onBucketChange, onCreate, onEditOrder, onRefresh, isRefreshing, isLoading,
}: TableWithCardsProps) {
    const t = useTranslations('StudyOrdersPage');
    const tCols = useTranslations('StudyOrdersPage.columns');
    const tActions = useTranslations('StudyOrdersPage.actions');
    const { isNarrow: panelNarrow } = useNarrowMode();
    const isViewportNarrow = useViewportNarrow();
    const isNarrow = !!selected || panelNarrow || isViewportNarrow;

    // Sin 'all': DataTableToolbar ya agrega su propia opción "Todos" con ese
    // mismo value, y repetirla dejaba dos ítems marcados a la vez.
    const bucketOptions = React.useMemo(
        () => (['new', 'pending', 'overdue', 'scheduled', 'completed', 'drafts'] as const).map((value) => ({
            value,
            label: t(`buckets.${value}`),
        })),
        [t],
    );

    const columnTranslations = React.useMemo(
        () => ({
            order_number: tCols('orderNumber'),
            patient_name: tCols('patient'),
            doctor_name: tCols('doctor'),
            items: tCols('items'),
            status: tCols('status'),
        }),
        [tCols],
    );

    return (
        <DataTable
            columns={columns}
            data={orders}
            pageCount={Math.max(1, Math.ceil(total / pagination.pageSize))}
            rowCount={total}
            pagination={pagination}
            onPaginationChange={setPagination}
            manualPagination
            sorting={sorting}
            onSortingChange={setSorting}
            columnFilters={columnFilters}
            onColumnFiltersChange={setColumnFilters}
            filterColumnId="patient_name"
            filterPlaceholder={t('filterPlaceholder')}
            filterOptions={bucketOptions}
            filterValue={bucket}
            onFilterChange={onBucketChange}
            columnTranslations={columnTranslations}
            onCreate={onCreate}
            createButtonLabel={t('newOrder')}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            isLoading={isLoading}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRowSelectionChange={onRowSelect}
            isNarrow={isNarrow}
            onRowClick={(order) => onRowSelect([order])}
            renderCard={(order, isSelected) => (
                <DataCard
                    isSelected={isSelected}
                    // "Ana Pérez derivado por Dra. García": el derivador es parte
                    // de la identidad de la orden, no un dato secundario.
                    title={referralLabel(order.patient_name, scope === 'clinic' ? order.doctor_name : null, t)}
                    // `subtitle` es un string, así que los tres datos restantes
                    // (número, fecha y cantidad) van en una línea separados por punto.
                    subtitle={[
                        order.order_number,
                        formatDisplayDate(order.submitted_at ?? order.created_at),
                        t('itemsCountShort', { count: order.items_total }),
                    ].filter(Boolean).join(' · ')}
                    badge={
                        <StudyOrderStatusBadge
                            status={order.board_status}
                            isOverdue={order.is_overdue}
                            itemsScheduled={order.items_scheduled}
                            itemsTotal={order.items_total}
                        />
                    }
                    showArrow
                    onClick={() => onRowSelect([order])}
                    actions={
                        order.status === 'draft' && onEditOrder ? (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
                            >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                {tActions('edit')}
                            </button>
                        ) : undefined
                    }
                />
            )}
        />
    );
}

export function StudyOrdersScreen({ scope }: StudyOrdersScreenProps) {
    const t = useTranslations('StudyOrdersPage');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const router = useRouter();
    const locale = useLocale();
    const searchParams = useSearchParams();
    const { start: startScheduling } = useStudyOrderScheduling();
    const { printStudyOrder } = usePrintDocument();


    const canCreate = hasPermission(STUDY_ORDERS_PERMISSIONS.CREATE);
    const canUpdate = hasPermission(STUDY_ORDERS_PERMISSIONS.UPDATE);
    const canSubmit = hasPermission(STUDY_ORDERS_PERMISSIONS.SUBMIT);
    const canDelete = hasPermission(STUDY_ORDERS_PERMISSIONS.DELETE);
    const isClinic = scope === 'clinic';
    // Tomar y agendar son trabajo de la clínica: no se ofrecen en Mis Órdenes
    // aunque el usuario tenga el permiso (un administrador, por ejemplo).
    const canAcknowledge = isClinic && hasPermission(STUDY_ORDERS_PERMISSIONS.ACKNOWLEDGE);
    const canSchedule = isClinic && hasPermission(STUDY_ORDERS_PERMISSIONS.SCHEDULE);
    // Anular: espeja la regla del backend. La clínica necesita el permiso; en
    // Mis Órdenes las órdenes son propias y el derivador puede anular las que
    // todavía no fueron tomadas — ese corte lo aplican la fila y el panel.
    const canCancel = !isClinic || hasPermission(STUDY_ORDERS_PERMISSIONS.CANCEL);

    const [orders, setOrders] = React.useState<StudyOrderListItem[]>([]);
    const [total, setTotal] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [selected, setSelected] = React.useState<StudyOrderListItem | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [bucket, setBucket] = React.useState('all');
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    // Por número de orden descendente, que es cronológico: la secuencia
    // OE-AAAA-NNNNNN se emite en orden. La columna `submitted_at` dejó de
    // existir al fusionarse con `order_number`, y apuntar el orden a una
    // columna inexistente rompía la tabla.
    const [sorting, setSorting] = React.useState<SortingState>([{ id: 'order_number', desc: true }]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const [pendingSubmit, setPendingSubmit] = React.useState<PendingOrder | null>(null);
    const [pendingDelete, setPendingDelete] = React.useState<PendingOrder | null>(null);
    const [pendingCancel, setPendingCancel] = React.useState<PendingOrder | null>(null);
    const [cancelReason, setCancelReason] = React.useState('');
    const [isMutating, setIsMutating] = React.useState(false);

    // `null` = alta; un id = edición de ese borrador. `isFormOpen` va aparte
    // porque `null` es un valor válido de `editingId`.
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editingNumber, setEditingNumber] = React.useState<string | null>(null);
    const [detailRefreshKey, setDetailRefreshKey] = React.useState(0);
    const [reschedulingOrder, setReschedulingOrder] = React.useState<StudyOrder | null>(null);

    const searchTerm = React.useMemo(
        () => (columnFilters.find((f) => f.id === 'patient_name')?.value as string | undefined) ?? '',
        [columnFilters],
    );

    const loadOrders = React.useCallback(
        async (silent = false) => {
            if (silent) setIsRefreshing(true);
            else setIsLoading(true);

            const sort = sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : undefined;
            const { items, total: count } = await getStudyOrders({
                scope,
                boardStatus: bucket === 'all' ? undefined : bucket,
                search: searchTerm || undefined,
                slaHours: DEFAULT_SLA_HOURS,
                sort,
                page: pagination.pageIndex + 1,
                limit: pagination.pageSize,
            });

            setOrders(items);
            setTotal(count);
            setIsLoading(false);
            setIsRefreshing(false);
        },
        [scope, bucket, searchTerm, sorting, pagination.pageIndex, pagination.pageSize],
    );

    // Cualquier cambio de filtro vuelve a la primera página, o se pediría una
    // página que ya no existe.
    React.useEffect(() => {
        setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
    }, [bucket, searchTerm]);

    // Debounce: la búsqueda por paciente escribe letra a letra.
    React.useEffect(() => {
        const timer = setTimeout(() => { void loadOrders(); }, 400);
        return () => clearTimeout(timer);
    }, [loadOrders]);

    const handleRowSelect = React.useCallback((rows: StudyOrderListItem[]) => {
        setSelected(rows[0] ?? null);
    }, []);

    /**
     * Manda a la agenda con el paciente, el doctor y los estudios pendientes ya
     * puestos. Reutiliza el deep link que la agenda ya entiende para las
     * notificaciones (`?act=schedule&…`): los servicios no caben en la URL, así
     * que viajan por sessionStorage, igual que hace notification-card.
     *
     * `studyOrderId` es lo único nuevo: la agenda lo guarda y, cuando el
     * guardado devuelve el id de la cita, la ata a la orden.
     */
    /**
     * Imprime la orden. El hook la vuelve a pedir al backend, así que el papel
     * refleja el estado de este momento y no el que tenía el panel al abrirse.
     */
    const handlePrint = React.useCallback(async (orderId: string) => {
        try {
            await printStudyOrder(orderId);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.genericError'),
                description: error instanceof Error && error.message !== 'no_data' ? error.message : undefined,
            });
        }
    }, [printStudyOrder, toast, t]);

    const handleSchedule = React.useCallback(async (orderId: string) => {
        const order = await getStudyOrder(orderId);
        if (!order) return;

        const pending = order.items.filter((i) => !i.is_cancelled && !i.is_scheduled);
        const items = (pending.length > 0 ? pending : order.items).map((i) => ({
            service_id: i.service_id,
            service_name: i.service_name,
        }));

        // La operación queda en un store global: sobrevive al cierre del diálogo,
        // al cambio de sede y a moverse por el calendario, y es lo que el aviso
        // de la agenda muestra hasta que el operario la cancele.
        startScheduling({
            orderId: order.id,
            orderNumber: order.order_number,
            patientId: order.patient_id,
            patientName: order.patient_name,
            doctorId: order.doctor_id,
            doctorName: order.doctor_name,
            serviceIds: items.map((i) => i.service_id),
        });

        try {
            sessionStorage.setItem(`notif-services:${order.id}`, JSON.stringify(items));
        } catch {
            // Sin sessionStorage se agenda igual: el selector de orden del
            // diálogo vuelve a resolver los estudios.
        }

        const params = new URLSearchParams({
            act: 'schedule',
            patientId: order.patient_id ?? '',
            patientName: order.patient_name,
            sessionRef: order.id,
            studyOrderId: order.id,
        });
        if (order.doctor_id) params.set('doctorId', order.doctor_id);
        if (order.doctor_name) params.set('doctorName', order.doctor_name);

        router.push(`/${locale}/appointments?${params.toString()}`);
    }, [router, locale, startScheduling]);

    /**
     * Deep link desde la tarjeta de notificación: `?orderId=…&act=schedule|cancel`.
     * Abre el detalle de esa orden y, si viene `act=cancel`, el diálogo de
     * anulación con su motivo — meter ese formulario en la tarjeta habría sido
     * peor que traer al operario a donde ya está.
     */
    const handledDeepLinkRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        const orderId = searchParams.get('orderId');
        if (!orderId || handledDeepLinkRef.current === orderId) return;
        handledDeepLinkRef.current = orderId;
        const act = searchParams.get('act');

        // Se limpia la URL enseguida para que un segundo clic en la misma
        // notificación vuelva a disparar.
        window.history.replaceState({}, '', window.location.pathname);

        void getStudyOrder(orderId).then((order) => {
            if (!order) return;
            const row: PendingOrder = {
                id: order.id,
                order_number: order.order_number,
                patient_name: order.patient_name,
            };
            setSelected(row as unknown as StudyOrderListItem);
            if (act === 'cancel') setPendingCancel(row);
            if (act === 'schedule') void handleSchedule(order.id);
        });
    }, [searchParams, handleSchedule]);

    const handleCreate = React.useCallback(() => {
        setEditingId(null);
        setEditingNumber(null);
        setIsFormOpen(true);
    }, []);

    const handleEdit = React.useCallback((order: StudyOrderListItem) => {
        // Sólo los borradores son editables; sobre una enviada se abre el detalle.
        if (order.status !== 'draft') {
            setSelected(order);
            return;
        }
        setEditingId(order.id);
        setEditingNumber(order.order_number);
        setIsFormOpen(true);
    }, []);

    const handleCloseDetail = React.useCallback(() => {
        setSelected(null);
        setRowSelection({});
    }, []);

    /** Envuelve una mutación con toasts y recarga silenciosa. */
    const runMutation = React.useCallback(
        async (action: () => Promise<unknown>, successTitle: string, successDescription?: string) => {
            setIsMutating(true);
            try {
                await action();
                toast({ title: successTitle, description: successDescription });
                await loadOrders(true);
                // El panel de detalle no se entera solo: su orderId no cambió.
                setDetailRefreshKey((k) => k + 1);
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: t('toast.errorTitle'),
                    description: error instanceof Error ? error.message : t('toast.genericError'),
                });
            } finally {
                setIsMutating(false);
            }
        },
        [toast, loadOrders, t],
    );

    const columns = StudyOrderColumnsWrapper({
        scope,
        onEdit: canUpdate ? handleEdit : undefined,
        onSubmit: canSubmit ? setPendingSubmit : undefined,
        onDelete: canDelete ? setPendingDelete : undefined,
        onAcknowledge: canAcknowledge
            ? (order) => void runMutation(() => acknowledgeStudyOrder(order.id), t('toast.acknowledgedTitle'))
            : undefined,
        onSchedule: canSchedule ? (order) => void handleSchedule(order.id) : undefined,
        onCancel: canCancel ? setPendingCancel : undefined,
    });

    const isMine = !isClinic;

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <TwoPanelLayout
                isRightPanelOpen={!!selected}
                onBack={handleCloseDetail}
                storageKey={`study-orders-${scope}`}
                // Con el detalle abierto la lista pasa a modo tarjetas y necesita
                // poco ancho; el detalle, que muestra la orden entera, necesita mucho.
                leftPanelDefaultSize={30}
                rightPanelDefaultSize={70}
                minLeftSize={18}
                leftPanel={
                    <Card className="flex h-full flex-col border-0 shadow-none lg:border lg:shadow-sm">
                        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                            <div className="header-icon-circle">
                                <ClipboardList className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <CardTitle>{isMine ? t('titleMine') : t('titleClinic')}</CardTitle>
                                <CardDescription>
                                    {isMine ? t('descriptionMine') : t('descriptionClinic')}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card p-4 sm:p-6">
                            <StudyOrdersTableWithCards
                                scope={scope}
                                orders={orders}
                                total={total}
                                columns={columns}
                                selected={selected}
                                rowSelection={rowSelection}
                                setRowSelection={setRowSelection}
                                onRowSelect={handleRowSelect}
                                pagination={pagination}
                                setPagination={setPagination}
                                sorting={sorting}
                                setSorting={setSorting}
                                columnFilters={columnFilters}
                                setColumnFilters={setColumnFilters}
                                bucket={bucket}
                                onBucketChange={setBucket}
                                onCreate={canCreate ? handleCreate : undefined}
                                onEditOrder={canUpdate ? handleEdit : undefined}
                                onRefresh={() => void loadOrders(true)}
                                isRefreshing={isRefreshing}
                                isLoading={isLoading}
                            />
                        </CardContent>
                    </Card>
                }
                rightPanel={
                    selected && (
                        <StudyOrderDetailPanel
                            orderId={selected.id}
                            scope={scope}
                            refreshKey={detailRefreshKey}
                            onClose={handleCloseDetail}
                            onEdit={(order) => {
                                setEditingId(order.id);
                                setEditingNumber(order.order_number);
                                setIsFormOpen(true);
                            }}
                            onSubmit={setPendingSubmit}
                            onDelete={setPendingDelete}
                            onCancel={setPendingCancel}
                            onAcknowledge={(order) =>
                                void runMutation(() => acknowledgeStudyOrder(order.id), t('toast.acknowledgedTitle'))}
                            onSchedule={(order) => void handleSchedule(order.id)}
                            onReschedule={setReschedulingOrder}
                            onPrint={(order) => void handlePrint(order.id)}
                        />
                    )
                }
            />

            <StudyOrderRescheduleDialog
                open={!!reschedulingOrder}
                onOpenChange={(o) => { if (!o) setReschedulingOrder(null); }}
                order={reschedulingOrder}
                onDone={() => {
                    void loadOrders(true);
                    setDetailRefreshKey((k) => k + 1);
                }}
            />

            <StudyOrderWizard
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                orderId={editingId}
                orderNumber={editingNumber}
                onSaved={() => {
                    void loadOrders(true);
                    setDetailRefreshKey((k) => k + 1);
                }}
            />

            <AlertDialog open={!!pendingSubmit} onOpenChange={(open) => !open && setPendingSubmit(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('submitDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('submitDialog.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('submitDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isMutating}
                            onClick={() => {
                                const order = pendingSubmit;
                                setPendingSubmit(null);
                                if (order) {
                                    void runMutation(
                                        () => submitStudyOrder(order.id),
                                        t('toast.submittedTitle'),
                                        t('toast.submittedDescription', { number: order.order_number }),
                                    );
                                }
                            }}
                        >
                            {t('submitDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description', { patient: pendingDelete?.patient_name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isMutating}
                            onClick={() => {
                                const order = pendingDelete;
                                setPendingDelete(null);
                                if (order) {
                                    if (selected?.id === order.id) handleCloseDetail();
                                    void runMutation(() => deleteStudyOrder(order.id), t('toast.deletedTitle'));
                                }
                            }}
                        >
                            {t('deleteDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={!!pendingCancel}
                onOpenChange={(open) => { if (!open) { setPendingCancel(null); setCancelReason(''); } }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('cancelDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('cancelDialog.description', { number: pendingCancel?.order_number ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder={t('cancelDialog.reasonLabel')}
                        rows={3}
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancelDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isMutating || !cancelReason.trim()}
                            onClick={() => {
                                const order = pendingCancel;
                                const reason = cancelReason.trim();
                                setPendingCancel(null);
                                setCancelReason('');
                                if (order && reason) {
                                    void runMutation(() => cancelStudyOrder(order.id, reason), t('toast.cancelledTitle'));
                                }
                            }}
                        >
                            {t('cancelDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default StudyOrdersScreen;
