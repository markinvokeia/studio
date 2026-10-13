'use client';

import * as React from 'react';
import type { ColumnFiltersState, PaginationState, RowSelectionState, SortingState } from '@tanstack/react-table';
import { ClipboardList, FileUp, Globe, Inbox, LayoutList, MessageCircle, Pencil, PlusCircle, RefreshCw, Search, SquareKanban, UserCheck, UserPlus, UserRound, UserX, Users, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableToolbarCompactProvider, useCompactWidth, useDataTableToolbarCompact } from '@/components/ui/data-table-toolbar-context';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout, useNarrowMode } from '@/components/layout/two-panel-layout';

import { StudyOrderColumnsWrapper } from '@/app/[locale]/study-orders/columns';
import { StudyOrderAssignDialog, isStudyOrderAssignable } from './study-order-assign-dialog';
import { StudyOrderBoard, type BoardCapabilities, type BoardMove } from './study-order-board';
import { StudyOrderDetailPanel } from './study-order-detail-panel';
import { StudyOrderImportDialog } from './study-order-import-dialog';
import { StudyOrderRescheduleDialog } from './study-order-reschedule-dialog';
import { ReviewPendingBadge } from './review-pending-badge';
import { StudyOrderWizard } from './study-order-wizard';
import { referralLabel } from './study-order-referral-line';
import { StudyOrderStatusBadge } from './study-order-status-badge';
import { WhatsappSourceBadge } from './whatsapp-source-badge';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { cn, formatDisplayDate } from '@/lib/utils';
import { useStudyOrderScheduling } from '@/stores/study-order-scheduling-store';
import type { StudyOrder, StudyOrderAssignedFilter, StudyOrderListItem } from '@/lib/types';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import {
    acknowledgeStudyOrder,
    cancelStudyOrder,
    deleteStudyOrder,
    getStudyOrder,
    getStudyOrders,
    submitStudyOrder,
    type StudyOrderOrigin,
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
    source?: StudyOrderListItem['source'];
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
    /** Filtro de origen (solo en la bandeja de la clínica): se pinta junto al de estado. */
    originFilter?: React.ReactNode;
    onCreate?: () => void;
    onEditOrder?: (order: StudyOrderListItem) => void;
    /** Asignar quién la revisa (con permiso). */
    onAssignOrder?: (order: StudyOrderListItem) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    isLoading: boolean;
}

type OriginFilterValue = 'all' | StudyOrderOrigin;

const ORIGIN_ICONS: Record<OriginFilterValue, React.ComponentType<{ className?: string }>> = {
    all: Inbox,
    portal: Globe,
    whatsapp: MessageCircle,
};

/**
 * Filtro por origen de la bandeja. En una barra angosta (celular o con el detalle abierto) queda
 * solo el ícono del origen elegido; el nombre sigue en el desplegable.
 */
function OriginFilter({ value, onChange }: { value: OriginFilterValue; onChange: (value: OriginFilterValue) => void }) {
    const t = useTranslations('StudyOrdersPage');
    const compact = useDataTableToolbarCompact();
    const Icon = ORIGIN_ICONS[value];
    return (
        <Select value={value} onValueChange={(next) => onChange(next as OriginFilterValue)}>
            {compact ? (
                <SelectTrigger
                    className="relative h-9 w-9 justify-center px-0 [&>svg:last-child]:hidden"
                    aria-label={t('origin.label')}
                    title={t('origin.label')}
                >
                    <Icon className="h-4 w-4" />
                    <span className="sr-only"><SelectValue /></span>
                    {value !== 'all' && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                </SelectTrigger>
            ) : (
                <SelectTrigger className="h-9 w-[190px]" aria-label={t('origin.label')}>
                    <SelectValue />
                </SelectTrigger>
            )}
            <SelectContent>
                <SelectItem value="all">{t('origin.all')}</SelectItem>
                <SelectItem value="portal">{t('origin.portal')}</SelectItem>
                <SelectItem value="whatsapp">{t('origin.whatsapp')}</SelectItem>
            </SelectContent>
        </Select>
    );
}

/** "Importar orden": en una barra angosta, solo el ícono. */
function ImportOrderButton({ onClick }: { onClick: () => void }) {
    const t = useTranslations('StudyOrdersPage');
    const compact = useDataTableToolbarCompact();
    return compact ? (
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onClick}
            aria-label={t('importOrder')} title={t('importOrder')}>
            <FileUp className="h-4 w-4" aria-hidden="true" />
        </Button>
    ) : (
        <Button variant="outline" size="sm" className="h-9" onClick={onClick}>
            <FileUp className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('importOrder')}
        </Button>
    );
}

const ASSIGNED_ICONS: Record<StudyOrderAssignedFilter, React.ComponentType<{ className?: string }>> = {
    all: Users,
    me: UserCheck,
    none: UserX,
};

/** Filtro por responsable: todas, asignadas a mí o sin asignar. En una barra angosta, solo el ícono. */
function AssignedFilter({ value, onChange }: { value: StudyOrderAssignedFilter; onChange: (value: StudyOrderAssignedFilter) => void }) {
    const t = useTranslations('StudyOrdersPage');
    const compact = useDataTableToolbarCompact();
    const Icon = ASSIGNED_ICONS[value];
    return (
        <Select value={value} onValueChange={(next) => onChange(next as StudyOrderAssignedFilter)}>
            {compact ? (
                <SelectTrigger
                    className="relative h-9 w-9 justify-center px-0 [&>svg:last-child]:hidden"
                    aria-label={t('assignedFilter.label')}
                    title={t('assignedFilter.label')}
                >
                    <Icon className="h-4 w-4" />
                    <span className="sr-only"><SelectValue /></span>
                    {value !== 'all' && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                </SelectTrigger>
            ) : (
                <SelectTrigger className="h-9 w-[170px]" aria-label={t('assignedFilter.label')}>
                    {/* div y no span: el trigger recorta sus span hijos a una línea y rompería la fila. */}
                    <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <SelectValue />
                    </div>
                </SelectTrigger>
            )}
            <SelectContent>
                <SelectItem value="all">{t('assignedFilter.all')}</SelectItem>
                <SelectItem value="me">{t('assignedFilter.me')}</SelectItem>
                <SelectItem value="none">{t('assignedFilter.none')}</SelectItem>
            </SelectContent>
        </Select>
    );
}

export type StudyOrdersViewMode = 'list' | 'board';

/** Lista o Estados (tablero). */
function ViewModeSwitch({ value, onChange }: { value: StudyOrdersViewMode; onChange: (mode: StudyOrdersViewMode) => void }) {
    const t = useTranslations('StudyOrdersPage.view');
    const options: { mode: StudyOrdersViewMode; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
        { mode: 'list', icon: LayoutList, label: t('list') },
        { mode: 'board', icon: SquareKanban, label: t('board') },
    ];
    return (
        // Resaltado con el color de la marca: es lo que cambia toda la pantalla, tiene que verse.
        <div
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 p-1 shadow-sm"
            role="group"
            aria-label={t('label')}
        >
            {options.map(({ mode, icon: Icon, label }) => (
                <button
                    key={mode}
                    type="button"
                    aria-pressed={value === mode}
                    title={label}
                    onClick={() => onChange(mode)}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        value === mode
                            ? 'bg-primary text-primary-foreground shadow'
                            : 'text-primary/80 hover:bg-primary/10 hover:text-primary',
                    )}
                >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
}

/** Tarjetas por columna que se pueden elegir en el tablero. */
const BOARD_PAGE_SIZES = [10, 25, 50, 100] as const;

interface BoardToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    perColumn: number;
    onPerColumnChange: (value: number) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    onCreate?: () => void;
    /** Filtros y acciones de la página (origen, responsable, importar). */
    extra?: React.ReactNode;
}

/**
 * Barra del tablero: búsqueda, filtros, tarjetas por columna y actualizar. Como la de la lista,
 * mide su propio ancho: si no entra pasa a la línea siguiente y, muy angosta, queda solo con íconos.
 */
function BoardToolbar({ search, onSearchChange, perColumn, onPerColumnChange, onRefresh, isRefreshing, onCreate, extra }: BoardToolbarProps) {
    const t = useTranslations('StudyOrdersPage');
    const tToolbar = useTranslations('DataTableToolbar');
    const rootRef = React.useRef<HTMLDivElement>(null);
    const compact = useCompactWidth(rootRef);
    return (
        <DataTableToolbarCompactProvider value={compact}>
            <div ref={rootRef} className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-[12rem] flex-1 items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={t('filterPlaceholder')}
                            className="h-9 w-full pl-9 pr-9"
                            aria-label={t('filterPlaceholder')}
                        />
                        {search && (
                            <Button variant="ghost" onClick={() => onSearchChange('')}
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
                                <X className="h-4 w-4" />
                                <span className="sr-only">{tToolbar('clear')}</span>
                            </Button>
                        )}
                    </div>
                    {onCreate && (
                        <Button className={cn('h-9 shrink-0', compact ? 'w-9 px-0' : 'gap-1.5 px-3')} onClick={onCreate}
                            aria-label={t('newOrder')} title={t('newOrder')}>
                            <PlusCircle className="h-4 w-4" aria-hidden="true" />
                            {!compact && <span>{t('newOrder')}</span>}
                        </Button>
                    )}
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-2">
                    {extra}
                    <Select value={String(perColumn)} onValueChange={(v) => onPerColumnChange(Number(v))}>
                        <SelectTrigger className={cn('h-9', compact ? 'w-[72px]' : 'w-[150px]')} aria-label={t('board.perColumn')} title={t('board.perColumn')}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {BOARD_PAGE_SIZES.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {compact ? size : t('board.perColumnOption', { count: size })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onRefresh} disabled={isRefreshing}
                        aria-label={tToolbar('refresh')} title={tToolbar('refresh')}>
                        <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                    </Button>
                </div>
            </div>
        </DataTableToolbarCompactProvider>
    );
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
    bucket, onBucketChange, originFilter, onCreate, onEditOrder, onAssignOrder, onRefresh, isRefreshing, isLoading,
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
        () => (['new', 'pending', 'overdue', 'scheduled', 'completed', 'drafts', 'review'] as const).map((value) => ({
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
            extraButtons={originFilter}
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
                        <span className="flex items-center gap-1.5">
                            <ReviewPendingBadge count={order.review_pending} />
                            <WhatsappSourceBadge source={order.source} />
                            <StudyOrderStatusBadge
                                status={order.board_status}
                                isOverdue={order.is_overdue}
                                itemsScheduled={order.items_scheduled}
                                itemsTotal={order.items_total}
                            />
                        </span>
                    }
                    showArrow
                    onClick={() => onRowSelect([order])}
                    actions={
                        (order.status === 'draft' && onEditOrder) || (scope === 'clinic' && (order.assigned_to_name || onAssignOrder)) ? (
                            <>
                                {order.status === 'draft' && onEditOrder && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
                                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
                                    >
                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                        {tActions('edit')}
                                    </button>
                                )}
                                {/* Quién la revisa; con permiso, tocarlo abre la asignación. */}
                                {scope === 'clinic' && (onAssignOrder && isStudyOrderAssignable(order) ? (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onAssignOrder(order); }}
                                        className="flex min-w-0 items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
                                    >
                                        <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        <span className="truncate">
                                            {order.assigned_to_name ? tActions('reviewedBy', { name: order.assigned_to_name }) : tActions('assign')}
                                        </span>
                                    </button>
                                ) : order.assigned_to_name && (
                                    <span className="flex min-w-0 items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                                        <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{tActions('reviewedBy', { name: order.assigned_to_name })}</span>
                                    </span>
                                ))}
                            </>
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
    const { hasPermission, hasAllPermissions } = usePermissions();
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
    // Importar una orden en papel (fotos o PDF): espeja el backend. Crea el borrador sin doctor
    // vinculado (CREATE_FOR_DOCTOR) y solo la clínica ve esos borradores y sus originales (VIEW_ALL).
    const canImport = isClinic && hasAllPermissions([
        STUDY_ORDERS_PERMISSIONS.CREATE,
        STUDY_ORDERS_PERMISSIONS.CREATE_FOR_DOCTOR,
        STUDY_ORDERS_PERMISSIONS.VIEW_ALL,
    ]);
    const [isImportOpen, setIsImportOpen] = React.useState(false);
    // Asignar el responsable y filtrar por él: solo en la bandeja de la clínica, con la bandeja completa.
    const canSeeAll = isClinic && hasPermission(STUDY_ORDERS_PERMISSIONS.VIEW_ALL);
    const canAssign = canSeeAll && hasPermission(STUDY_ORDERS_PERMISSIONS.ASSIGN);
    const [assigned, setAssigned] = React.useState<StudyOrderAssignedFilter>(() => {
        const value = searchParams.get('assigned');
        return value === 'me' || value === 'none' ? value : 'all';
    });
    const [assigningOrder, setAssigningOrder] = React.useState<{ id: string; order_number: string; assigned_to?: string | null } | null>(null);

    // Vista: lista o Estados (tablero). Se recuerda por bandeja.
    const viewStorageKey = `study-orders-view:${scope}`;
    const [viewMode, setViewModeState] = React.useState<StudyOrdersViewMode>('list');
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(viewStorageKey);
            if (stored === 'list' || stored === 'board') setViewModeState(stored);
        } catch { /* sin storage: lista */ }
    }, [viewStorageKey]);
    const setViewMode = React.useCallback((mode: StudyOrdersViewMode) => {
        setViewModeState(mode);
        try { localStorage.setItem(viewStorageKey, mode); } catch { /* sin storage */ }
    }, [viewStorageKey]);
    const isBoard = viewMode === 'board';

    // Tablero: tarjetas por columna (se recuerda), búsqueda propia y recarga después de cada acción.
    const [perColumn, setPerColumnState] = React.useState(25);
    React.useEffect(() => {
        try {
            const stored = Number(localStorage.getItem('study-orders-board-per-column'));
            if ([10, 25, 50, 100].includes(stored)) setPerColumnState(stored);
        } catch { /* sin storage */ }
    }, []);
    const setPerColumn = React.useCallback((value: number) => {
        setPerColumnState(value);
        try { localStorage.setItem('study-orders-board-per-column', String(value)); } catch { /* sin storage */ }
    }, []);
    const [boardSearchInput, setBoardSearchInput] = React.useState('');
    const [boardSearch, setBoardSearch] = React.useState('');
    React.useEffect(() => {
        const timer = setTimeout(() => setBoardSearch(boardSearchInput.trim()), 400);
        return () => clearTimeout(timer);
    }, [boardSearchInput]);
    const [boardReloadKey, setBoardReloadKey] = React.useState(0);
    const [isBoardLoading, setIsBoardLoading] = React.useState(false);

    // Origen: portal o WhatsApp. Se combina con el filtro de estado: las que el agente de WhatsApp
    // pasó a una persona son las de WhatsApp en borrador. El aviso de derivación abre la bandeja
    // así (`?source=whatsapp&bucket=drafts`); `?view=whatsapp` es el link de antes.
    const legacyHandoffLink = searchParams.get('view') === 'whatsapp';
    const [origin, setOrigin] = React.useState<'all' | StudyOrderOrigin>(() => {
        const source = searchParams.get('source');
        if (legacyHandoffLink) return 'whatsapp';
        return source === 'portal' || source === 'whatsapp' ? source : 'all';
    });

    const [orders, setOrders] = React.useState<StudyOrderListItem[]>([]);
    const [total, setTotal] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [selected, setSelected] = React.useState<StudyOrderListItem | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [bucket, setBucket] = React.useState(() => (legacyHandoffLink ? 'drafts' : searchParams.get('bucket') || 'all'));
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
                source: isClinic && origin !== 'all' ? origin : undefined,
                search: searchTerm || undefined,
                assigned: canSeeAll ? assigned : undefined,
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
        [scope, bucket, origin, isClinic, canSeeAll, assigned, searchTerm, sorting, pagination.pageIndex, pagination.pageSize],
    );

    // Cualquier cambio de filtro vuelve a la primera página, o se pediría una
    // página que ya no existe.
    React.useEffect(() => {
        setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
    }, [bucket, origin, assigned, searchTerm]);

    // Debounce: la búsqueda por paciente escribe letra a letra. En la vista Estados la lista no
    // se pide: el tablero trae lo suyo.
    React.useEffect(() => {
        if (isBoard) return;
        const timer = setTimeout(() => { void loadOrders(); }, 400);
        return () => clearTimeout(timer);
    }, [loadOrders, isBoard]);

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

    /** Detalle a pantalla entera (la lista queda oculta). Cerrarlo vuelve a las dos columnas. */
    const [isDetailExpanded, setIsDetailExpanded] = React.useState(false);

    const handleCloseDetail = React.useCallback(() => {
        setSelected(null);
        setRowSelection({});
        setIsDetailExpanded(false);
    }, []);

    /** Envuelve una mutación con toasts y recarga silenciosa. */
    const runMutation = React.useCallback(
        async (action: () => Promise<unknown>, successTitle: string, successDescription?: string) => {
            setIsMutating(true);
            try {
                await action();
                toast({ title: successTitle, description: successDescription });
                if (isBoard) setBoardReloadKey((k) => k + 1);
                else await loadOrders(true);
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
        [toast, loadOrders, isBoard, t],
    );

    /** Recarga lo que esté a la vista: la lista o el tablero. */
    const reloadView = React.useCallback(() => {
        if (isBoard) setBoardReloadKey((k) => k + 1);
        else void loadOrders(true);
    }, [isBoard, loadOrders]);

    /** Además, el detalle abierto (su orderId no cambió, no se entera solo). */
    const reloadAll = React.useCallback(() => {
        reloadView();
        setDetailRefreshKey((k) => k + 1);
    }, [reloadView]);

    /** Abrir una orden desde el tablero: el detalle a pantalla completa. */
    const openFromBoard = React.useCallback((order: StudyOrderListItem) => {
        setSelected(order);
        setIsDetailExpanded(true);
    }, []);

    /** Soltar una tarjeta en otra columna: la acción real que lleva a ese estado. */
    const handleBoardMove = React.useCallback((order: StudyOrderListItem, move: BoardMove) => {
        switch (move) {
            case 'submit': setPendingSubmit(order); break;
            case 'acknowledge':
                void runMutation(() => acknowledgeStudyOrder(order.id), t('toast.acknowledgedTitle'));
                break;
            case 'schedule': void handleSchedule(order.id); break;
            case 'cancel': setPendingCancel(order); break;
        }
    }, [runMutation, handleSchedule, t]);

    const boardCapabilities = React.useMemo<BoardCapabilities>(() => ({
        submit: canSubmit,
        acknowledge: canAcknowledge,
        schedule: canSchedule,
        cancel: canCancel,
        isClinic,
    }), [canSubmit, canAcknowledge, canSchedule, canCancel, isClinic]);

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
        onAssign: canAssign ? setAssigningOrder : undefined,
    });

    const isMine = !isClinic;

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <TwoPanelLayout
                isRightPanelOpen={!!selected}
                forceRightOnly={isDetailExpanded}
                onBack={handleCloseDetail}
                storageKey={`study-orders-${scope}`}
                // Con el detalle abierto la lista pasa a modo tarjetas y necesita
                // poco ancho; el detalle, que muestra la orden entera, necesita mucho.
                leftPanelDefaultSize={30}
                rightPanelDefaultSize={70}
                minLeftSize={18}
                leftPanel={
                    <Card className="flex h-full flex-col border-0 shadow-none lg:border lg:shadow-sm">
                        {/* flex-wrap: con poco ancho el selector de vista baja a una segunda fila en
                            vez de apretar el título. */}
                        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
                            <div className="flex min-w-[16rem] flex-1 items-center gap-3">
                                <div className="header-icon-circle shrink-0">
                                    <ClipboardList className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <CardTitle>{isMine ? t('titleMine') : t('titleClinic')}</CardTitle>
                                    <CardDescription>
                                        {isMine ? t('descriptionMine') : t('descriptionClinic')}
                                    </CardDescription>
                                </div>
                            </div>
                            <ViewModeSwitch value={viewMode} onChange={setViewMode} />
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card p-4 sm:p-6">
                            {isBoard ? (
                                <div className="flex min-h-0 flex-1 flex-col gap-3">
                                    <BoardToolbar
                                        search={boardSearchInput}
                                        onSearchChange={setBoardSearchInput}
                                        perColumn={perColumn}
                                        onPerColumnChange={setPerColumn}
                                        onRefresh={() => setBoardReloadKey((k) => k + 1)}
                                        isRefreshing={isBoardLoading}
                                        onCreate={canCreate ? handleCreate : undefined}
                                        extra={isClinic ? (
                                            <>
                                                <OriginFilter value={origin} onChange={setOrigin} />
                                                {canSeeAll && <AssignedFilter value={assigned} onChange={setAssigned} />}
                                                {canImport && <ImportOrderButton onClick={() => setIsImportOpen(true)} />}
                                            </>
                                        ) : undefined}
                                    />
                                    <StudyOrderBoard
                                        scope={scope}
                                        source={isClinic && origin !== 'all' ? origin : undefined}
                                        search={boardSearch}
                                        assigned={canSeeAll ? assigned : 'all'}
                                        perColumn={perColumn}
                                        reloadKey={boardReloadKey}
                                        capabilities={boardCapabilities}
                                        selectedId={selected?.id}
                                        onOpen={openFromBoard}
                                        onMove={handleBoardMove}
                                        onAssign={canAssign ? setAssigningOrder : undefined}
                                        onLoadingChange={setIsBoardLoading}
                                    />
                                </div>
                            ) : (
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
                                originFilter={isClinic ? (
                                    <>
                                        <OriginFilter value={origin} onChange={setOrigin} />
                                        {canSeeAll && <AssignedFilter value={assigned} onChange={setAssigned} />}
                                        {canImport && <ImportOrderButton onClick={() => setIsImportOpen(true)} />}
                                    </>
                                ) : undefined}
                                onCreate={canCreate ? handleCreate : undefined}
                                onEditOrder={canUpdate ? handleEdit : undefined}
                                onAssignOrder={canAssign ? setAssigningOrder : undefined}
                                onRefresh={() => void loadOrders(true)}
                                isRefreshing={isRefreshing}
                                isLoading={isLoading}
                            />
                            )}
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
                            closeOnDesktopOnly
                            isExpanded={isDetailExpanded}
                            onToggleExpand={() => setIsDetailExpanded((v) => !v)}
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
                            onAssign={canAssign ? setAssigningOrder : undefined}
                            onReviewChanged={reloadView}
                        />
                    )
                }
            />

            {canAssign && (
                <StudyOrderAssignDialog
                    order={assigningOrder}
                    onOpenChange={(open) => { if (!open) setAssigningOrder(null); }}
                    onAssigned={reloadAll}
                />
            )}

            <StudyOrderRescheduleDialog
                open={!!reschedulingOrder}
                onOpenChange={(o) => { if (!o) setReschedulingOrder(null); }}
                order={reschedulingOrder}
                onDone={reloadAll}
            />

            <StudyOrderWizard
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                orderId={editingId}
                orderNumber={editingNumber}
                onSaved={reloadAll}
            />

            {canImport && (
                <StudyOrderImportDialog
                    open={isImportOpen}
                    onOpenChange={setIsImportOpen}
                    onImported={(order) => {
                        reloadView();
                        // Se abre el borrador para completarlo: es lo siguiente que hay que hacer.
                        setEditingId(order.id);
                        setEditingNumber(order.order_number);
                        setIsFormOpen(true);
                    }}
                    onClosedWhileReading={() => {
                        toast({ title: t('importDialog.toast.continuesTitle'), description: t('importDialog.toast.continuesDescription') });
                        reloadView();
                    }}
                />
            )}

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
                            {pendingDelete?.source === 'whatsapp' && <> {t('deleteDialog.whatsappHandoff')}</>}
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
