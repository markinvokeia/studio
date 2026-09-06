'use client';

import * as React from 'react';
import type { ColumnFiltersState, PaginationState, RowSelectionState, SortingState } from '@tanstack/react-table';
import { ClipboardList, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
import { StudyOrderStatusBadge } from './study-order-status-badge';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { formatDisplayDate } from '@/lib/utils';
import type { StudyOrder, StudyOrderListItem } from '@/lib/types';
import {
    acknowledgeStudyOrder,
    cancelStudyOrder,
    deleteStudyOrder,
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
            submitted_at: tCols('submittedAt'),
            preferred_sede_name: tCols('sede'),
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
                    title={order.patient_name}
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
    const [sorting, setSorting] = React.useState<SortingState>([{ id: 'submitted_at', desc: true }]);
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
        onSchedule: canSchedule ? () => { /* Fase 3: deep link a la agenda */ } : undefined,
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
                            onSchedule={() => { /* Fase 3: deep link a la agenda */ }}
                            onReschedule={setReschedulingOrder}
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
