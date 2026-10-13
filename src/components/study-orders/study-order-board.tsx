'use client';

import * as React from 'react';
import {
    DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
    type Announcements, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, GripVertical, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

import { ReviewPendingBadge } from './review-pending-badge';
import { initialsOf, isStudyOrderAssignable } from './study-order-assign-dialog';
import { referralLabel } from './study-order-referral-line';
import { StudyOrderStatusBadge } from './study-order-status-badge';
import { WhatsappSourceBadge } from './whatsapp-source-badge';

import { cn, formatDisplayDate } from '@/lib/utils';
import type { StudyOrderAssignedFilter, StudyOrderBoardStatus, StudyOrderListItem } from '@/lib/types';
import { getStudyOrderBoard, type StudyOrderOrigin, type StudyOrderScope } from '@/services/study-orders';

/**
 * Vista "Estados" de la bandeja: una columna por estado de la orden, en el orden en que avanza.
 *
 * El estado no se guarda: lo deriva el backend de las citas. Por eso arrastrar una tarjeta no
 * cambia una columna en la base sino que dispara la acción real que lleva a ese estado (enviar,
 * tomar, agendar, anular), con sus mismas confirmaciones y permisos. Las columnas que dependen
 * de que se atiendan las citas (En curso, Completada) no aceptan tarjetas: se llenan solas.
 */

/** Columnas en el orden lógico en que avanza una orden. */
export const BOARD_COLUMNS: StudyOrderBoardStatus[] = [
    'draft', 'new', 'unscheduled', 'partially_scheduled', 'scheduled', 'in_progress', 'completed', 'cancelled',
];

/** Color de cada columna (franja superior y punto). */
const COLUMN_ACCENT: Record<StudyOrderBoardStatus, string> = {
    draft:               'bg-slate-400',
    new:                 'bg-sky-500',
    unscheduled:         'bg-amber-500',
    partially_scheduled: 'bg-orange-500',
    scheduled:           'bg-primary',
    in_progress:         'bg-blue-500',
    completed:           'bg-emerald-500',
    cancelled:           'bg-destructive',
};

/**
 * Relleno del contador de cada columna: el mismo color del estado, en un tono claro para que la
 * cantidad (en negro) se lea siempre, también en modo oscuro.
 */
const COLUMN_COUNT_FILL: Record<StudyOrderBoardStatus, string> = {
    draft:               'bg-slate-200',
    new:                 'bg-sky-200',
    unscheduled:         'bg-amber-200',
    partially_scheduled: 'bg-orange-200',
    scheduled:           'bg-violet-200',
    in_progress:         'bg-blue-200',
    completed:           'bg-emerald-200',
    cancelled:           'bg-red-200',
};

/** Acción que dispara soltar una tarjeta en otra columna. */
export type BoardMove = 'submit' | 'acknowledge' | 'schedule' | 'cancel';

/** Qué puede hacer quien mira el tablero (ya resuelto con permisos y alcance). */
export interface BoardCapabilities {
    submit: boolean;
    acknowledge: boolean;
    schedule: boolean;
    /** Anular. En Mis Órdenes, solo mientras la clínica no la tomó. */
    cancel: boolean;
    isClinic: boolean;
}

/**
 * La transición de `order` a `target`, o null si no hay ninguna. Mismas reglas que las acciones
 * del detalle; el backend las vuelve a validar.
 */
export function boardMoveFor(order: StudyOrderListItem, target: StudyOrderBoardStatus, caps: BoardCapabilities): BoardMove | null {
    const from = order.board_status;
    if (target === from) return null;
    if (target === 'cancelled') {
        if (order.status !== 'submitted' || !caps.cancel) return null;
        // El derivador solo puede anular lo que la clínica todavía no tomó.
        return caps.isClinic || !order.acknowledged_at ? 'cancel' : null;
    }
    if (from === 'draft' && target === 'new') return caps.submit ? 'submit' : null;
    if (from === 'new' && target === 'unscheduled') return caps.acknowledge ? 'acknowledge' : null;
    if (['new', 'unscheduled', 'partially_scheduled'].includes(from)
        && (target === 'partially_scheduled' || target === 'scheduled')) {
        return caps.schedule ? 'schedule' : null;
    }
    return null;
}

/** Por qué no se puede soltar ahí (clave de traducción de `board.blocked`). */
function blockedReason(order: StudyOrderListItem, target: StudyOrderBoardStatus): 'appointments' | 'backwards' | 'permission' {
    if (target === 'in_progress' || target === 'completed') return 'appointments';
    const fromIndex = BOARD_COLUMNS.indexOf(order.board_status);
    const toIndex = BOARD_COLUMNS.indexOf(target);
    if (target !== 'cancelled' && toIndex < fromIndex) return 'backwards';
    if (order.board_status === 'cancelled' || order.board_status === 'completed') return 'backwards';
    return 'permission';
}

interface ColumnState {
    total: number;
    items: StudyOrderListItem[];
}

type BoardData = Record<StudyOrderBoardStatus, ColumnState>;

const COLLAPSED_STORAGE = 'study-order-board-collapsed';

function readCollapsed(scope: StudyOrderScope): Set<StudyOrderBoardStatus> {
    try {
        const raw = localStorage.getItem(`${COLLAPSED_STORAGE}:${scope}`);
        if (raw) return new Set(JSON.parse(raw) as StudyOrderBoardStatus[]);
    } catch { /* sin storage: valores por defecto */ }
    // Las anuladas no son trabajo pendiente: arrancan plegadas.
    return new Set<StudyOrderBoardStatus>(['cancelled']);
}

export interface StudyOrderBoardProps {
    scope: StudyOrderScope;
    source?: StudyOrderOrigin;
    search: string;
    assigned: StudyOrderAssignedFilter;
    /** Tarjetas por columna (y cuántas más trae "Cargar más"). */
    perColumn: number;
    /** Cambia para volver a pedir el tablero (después de una acción, o con Actualizar). */
    reloadKey: number;
    capabilities: BoardCapabilities;
    selectedId?: string | null;
    onOpen: (order: StudyOrderListItem) => void;
    onMove: (order: StudyOrderListItem, move: BoardMove) => void;
    /** Abrir la asignación. Sin él no se ofrece. */
    onAssign?: (order: StudyOrderListItem) => void;
    /** Para que la barra muestre el spinner de Actualizar. */
    onLoadingChange?: (loading: boolean) => void;
    className?: string;
}

export function StudyOrderBoard({
    scope, source, search, assigned, perColumn, reloadKey, capabilities, selectedId,
    onOpen, onMove, onAssign, onLoadingChange, className,
}: StudyOrderBoardProps) {
    const t = useTranslations('StudyOrdersPage');
    const [data, setData] = React.useState<BoardData | null>(null);
    const [error, setError] = React.useState(false);
    const [retryKey, setRetryKey] = React.useState(0);
    const [loadingMore, setLoadingMore] = React.useState<Set<StudyOrderBoardStatus>>(new Set());
    const [collapsed, setCollapsed] = React.useState<Set<StudyOrderBoardStatus>>(() => new Set(['cancelled']));
    const [dragging, setDragging] = React.useState<StudyOrderListItem | null>(null);
    /** Por qué no se pudo soltar ahí: se muestra arriba del tablero hasta cerrarlo o volver a arrastrar. */
    const [blockedNotice, setBlockedNotice] = React.useState<{ order: string; target: StudyOrderBoardStatus; reason: ReturnType<typeof blockedReason> } | null>(null);

    React.useEffect(() => { setCollapsed(readCollapsed(scope)); }, [scope]);

    const toggleCollapsed = (status: StudyOrderBoardStatus) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            try { localStorage.setItem(`${COLLAPSED_STORAGE}:${scope}`, JSON.stringify([...next])); } catch { /* sin storage */ }
            return next;
        });
    };

    // Carga del tablero. Al recargar se deja lo que había a la vista (sin esqueleto); una
    // respuesta vieja no pisa a una nueva.
    React.useEffect(() => {
        const controller = new AbortController();
        setError(false);
        onLoadingChange?.(true);
        getStudyOrderBoard({ scope, source, search: search || undefined, assigned, limit: perColumn, signal: controller.signal })
            .then((columns) => {
                if (controller.signal.aborted) return;
                const next = Object.fromEntries(BOARD_COLUMNS.map((s) => [s, { total: 0, items: [] }])) as unknown as BoardData;
                for (const column of columns) {
                    if (next[column.status]) next[column.status] = { total: Number(column.total) || 0, items: column.items ?? [] };
                }
                setData(next);
                setLoadingMore(new Set());
            })
            .catch(() => { if (!controller.signal.aborted) setError(true); })
            .finally(() => { if (!controller.signal.aborted) onLoadingChange?.(false); });
        return () => controller.abort();
        // `onLoadingChange` no va: es un aviso hacia afuera, no una entrada.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, source, search, assigned, perColumn, reloadKey, retryKey]);

    const loadMore = async (status: StudyOrderBoardStatus) => {
        if (!data || loadingMore.has(status)) return;
        setLoadingMore((prev) => new Set(prev).add(status));
        try {
            const [column] = await getStudyOrderBoard({
                scope, source, search: search || undefined, assigned, limit: perColumn,
                column: status, offset: data[status].items.length,
            });
            if (column) {
                setData((prev) => prev && ({
                    ...prev,
                    [status]: {
                        total: Number(column.total) || prev[status].total,
                        // Sin repetidos: si entró una orden nueva, el corrimiento podría traer una que ya está.
                        items: [...prev[status].items, ...column.items.filter((o) => !prev[status].items.some((p) => p.id === o.id))],
                    },
                }));
            }
        } catch {
            setError(true);
        } finally {
            setLoadingMore((prev) => {
                const next = new Set(prev);
                next.delete(status);
                return next;
            });
        }
    };

    // Arrastrar: con el mouse recién después de moverse unos píxeles (un clic abre la orden), en
    // pantallas táctiles con una pulsación larga (si no, no se podría desplazar el tablero), y con
    // el teclado con la barra espaciadora (Enter abre la orden).
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
        useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
    );

    const findOrder = (id: string): StudyOrderListItem | null => {
        if (!data) return null;
        for (const status of BOARD_COLUMNS) {
            const found = data[status].items.find((o) => o.id === id);
            if (found) return found;
        }
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setDragging(findOrder(String(event.active.id)));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const order = findOrder(String(event.active.id));
        setDragging(null);
        const target = event.over?.id as StudyOrderBoardStatus | undefined;
        if (!order || !target || target === order.board_status) return;
        const move = boardMoveFor(order, target, capabilities);
        if (move) {
            onMove(order, move);
            return;
        }
        setBlockedNotice({ order: order.order_number, target, reason: blockedReason(order, target) });
    };

    const statusLabel = (status: StudyOrderBoardStatus) => t(`status.${status}`);
    const announcements: Announcements = {
        onDragStart: ({ active }) => t('board.a11y.start', { order: findOrder(String(active.id))?.order_number ?? '' }),
        onDragOver: ({ over }) => (over ? t('board.a11y.over', { status: statusLabel(over.id as StudyOrderBoardStatus) }) : t('board.a11y.outside')),
        onDragEnd: ({ over }) => (over ? t('board.a11y.drop', { status: statusLabel(over.id as StudyOrderBoardStatus) }) : t('board.a11y.cancel')),
        onDragCancel: () => t('board.a11y.cancel'),
    };

    if (error && !data) {
        return (
            <div className={cn('flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center', className)}>
                <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t('board.loadError')}</p>
                <Button variant="outline" size="sm" onClick={() => setRetryKey((k) => k + 1)}>{t('board.retry')}</Button>
            </div>
        );
    }

    return (
        <div className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}>
            {blockedNotice && (
                <div role="status" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                    <p className="min-w-0 flex-1">
                        <span className="font-medium">
                            {t('board.blocked.title', { order: blockedNotice.order, status: statusLabel(blockedNotice.target) })}
                        </span>{' '}
                        {t(`board.blocked.${blockedNotice.reason}`)}
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setBlockedNotice(null)}>
                        {t('board.blocked.dismiss')}
                    </Button>
                </div>
            )}
            {error && data && (
                <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                    <span className="flex-1">{t('board.loadError')}</span>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => setRetryKey((k) => k + 1)}>{t('board.retry')}</Button>
                </div>
            )}

            <DndContext
                sensors={sensors}
                onDragStart={(e) => { setBlockedNotice(null); handleDragStart(e); }}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setDragging(null)}
                accessibility={{ announcements, screenReaderInstructions: { draggable: t('board.a11y.instructions') } }}
            >
                {/* Desplazamiento horizontal: en pantallas chicas se ve una columna y se pasa a la siguiente. */}
                <div className="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto pb-2" role="list" aria-label={t('board.label')}>
                    {BOARD_COLUMNS.map((status) => {
                        const column = data?.[status];
                        const dropMove = dragging ? boardMoveFor(dragging, status, capabilities) : null;
                        return (
                            <BoardColumn
                                key={status}
                                status={status}
                                label={statusLabel(status)}
                                total={column?.total ?? 0}
                                isLoading={!data}
                                collapsed={collapsed.has(status)}
                                onToggleCollapsed={() => toggleCollapsed(status)}
                                dragState={!dragging ? 'idle' : dragging.board_status === status ? 'origin' : dropMove ? 'allowed' : 'blocked'}
                            >
                                {column?.items.map((order) => (
                                    <BoardCard
                                        key={order.id}
                                        order={order}
                                        scope={scope}
                                        isSelected={order.id === selectedId}
                                        onOpen={onOpen}
                                        onAssign={onAssign}
                                    />
                                ))}
                                {column && column.items.length === 0 && (
                                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t('board.emptyColumn')}</p>
                                )}
                                {column && column.items.length < column.total && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs"
                                        loading={loadingMore.has(status)}
                                        disabled={loadingMore.has(status)}
                                        onClick={() => void loadMore(status)}
                                    >
                                        {t('board.loadMore', { shown: column.items.length, total: column.total })}
                                    </Button>
                                )}
                            </BoardColumn>
                        );
                    })}
                </div>
                <DragOverlay dropAnimation={null}>
                    {dragging && <BoardCardBody order={dragging} scope={scope} className="w-[272px] rotate-1 shadow-xl ring-1 ring-primary/40" />}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

// ─── Columna ────────────────────────────────────────────────────────────────

interface BoardColumnProps {
    status: StudyOrderBoardStatus;
    label: string;
    total: number;
    isLoading: boolean;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    /** Mientras se arrastra: si acepta la tarjeta, si no, o si es de donde salió. */
    dragState: 'idle' | 'origin' | 'allowed' | 'blocked';
    children?: React.ReactNode;
}

function BoardColumn({ status, label, total, isLoading, collapsed, onToggleCollapsed, dragState, children }: BoardColumnProps) {
    const t = useTranslations('StudyOrdersPage.board');
    const { setNodeRef, isOver } = useDroppable({ id: status });

    // Plegada: una franja angosta con el nombre y el total. Igual acepta tarjetas (anular).
    if (collapsed) {
        return (
            <div
                ref={setNodeRef}
                role="listitem"
                className={cn(
                    'flex w-11 flex-none snap-start flex-col items-center gap-2 rounded-lg border bg-muted/40 py-2 transition-colors',
                    dragState === 'allowed' && 'border-primary/50 bg-primary/5',
                    dragState === 'allowed' && isOver && 'bg-primary/15 ring-2 ring-primary',
                    dragState === 'blocked' && 'opacity-50',
                )}
            >
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapsed}
                    aria-label={t('expandColumn', { status: label })} title={t('expandColumn', { status: label })}>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className={cn('h-2 w-2 rounded-full', COLUMN_ACCENT[status])} aria-hidden="true" />
                <span className={cn('min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-gray-950', COLUMN_COUNT_FILL[status])}>
                    {isLoading ? '…' : total}
                </span>
                <span className="text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">{label}</span>
            </div>
        );
    }

    return (
        <section
            ref={setNodeRef}
            role="listitem"
            aria-label={`${label} (${total})`}
            className={cn(
                'flex w-[288px] flex-none snap-start flex-col overflow-hidden rounded-lg border bg-muted/40 transition-colors',
                dragState === 'allowed' && 'border-primary/50 bg-primary/5',
                dragState === 'allowed' && isOver && 'bg-primary/15 ring-2 ring-primary',
                dragState === 'blocked' && 'opacity-50',
            )}
        >
            <div className={cn('h-1 w-full', COLUMN_ACCENT[status])} aria-hidden="true" />
            <header className="flex items-center gap-2 px-3 py-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</h3>
                <span className={cn('min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-gray-950', COLUMN_COUNT_FILL[status])}>
                    {isLoading ? '…' : total}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={onToggleCollapsed}
                    aria-label={t('collapseColumn', { status: label })} title={t('collapseColumn', { status: label })}>
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
            </header>
            {dragState === 'blocked' && (
                <p className="px-3 pb-1 text-[11px] text-muted-foreground">{t('notAllowedHere')}</p>
            )}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {isLoading ? (
                    <>
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </>
                ) : children}
            </div>
        </section>
    );
}

// ─── Tarjeta ────────────────────────────────────────────────────────────────

interface BoardCardProps {
    order: StudyOrderListItem;
    scope: StudyOrderScope;
    isSelected: boolean;
    onOpen: (order: StudyOrderListItem) => void;
    onAssign?: (order: StudyOrderListItem) => void;
}

function BoardCard({ order, scope, isSelected, onOpen, onAssign }: BoardCardProps) {
    const t = useTranslations('StudyOrdersPage.board');
    const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: order.id });

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            aria-roledescription={t('a11y.card')}
            aria-label={`${order.order_number} · ${order.patient_name}`}
            onClick={() => onOpen(order)}
            onKeyDown={(e) => {
                listeners?.onKeyDown?.(e);
                if (e.key === 'Enter' && !e.defaultPrevented) onOpen(order);
            }}
            className={cn(
                'group relative cursor-grab rounded-md outline-none active:cursor-grabbing',
                'focus-visible:ring-2 focus-visible:ring-ring',
                isDragging && 'opacity-30',
            )}
        >
            <BoardCardBody
                order={order}
                scope={scope}
                className={cn(isSelected && 'ring-2 ring-primary')}
                summary={<OrderSummaryPopover order={order} scope={scope} onOpen={onOpen} onAssign={onAssign} />}
                onAssign={onAssign && isStudyOrderAssignable(order) ? () => onAssign(order) : undefined}
            />
        </div>
    );
}

interface BoardCardBodyProps {
    order: StudyOrderListItem;
    scope: StudyOrderScope;
    /** Botón de resumen (no va en la copia que sigue al puntero). */
    summary?: React.ReactNode;
    /** Asignar quién la revisa (con permiso y si la orden lo admite). */
    onAssign?: () => void;
    className?: string;
}

/** Lo que se ve de una orden en el tablero; la usa la tarjeta y la copia que se arrastra. */
function BoardCardBody({ order, scope, summary, onAssign, className }: BoardCardBodyProps) {
    const t = useTranslations('StudyOrdersPage');
    const reviewPending = Number(order.review_pending) || 0;
    return (
        <article className={cn('space-y-1.5 rounded-md border bg-card p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md', className)}>
            <div className="flex items-center gap-1.5">
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums text-muted-foreground">{order.order_number}</span>
                {summary}
            </div>
            <p className="line-clamp-2 font-medium leading-snug">
                {referralLabel(order.patient_name, scope === 'clinic' ? order.doctor_name : null, t)}
            </p>
            {order.items_summary && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{order.items_summary}</p>
            )}
            {(order.source === 'whatsapp' || reviewPending > 0 || order.is_overdue) && (
                <div className="flex flex-wrap items-center gap-1">
                    <WhatsappSourceBadge source={order.source} />
                    <ReviewPendingBadge count={order.review_pending} />
                    {order.is_overdue && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {t('status.overdue')}
                        </span>
                    )}
                </div>
            )}
            <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                <span className="tabular-nums">{formatDisplayDate(order.submitted_at ?? order.created_at)}</span>
                {order.items_total > 0 && (
                    <span className="tabular-nums">
                        · {t('board.progress', { scheduled: order.items_scheduled, total: order.items_total })}
                    </span>
                )}
            </div>
            {scope === 'clinic' && <ReviewerRow name={order.assigned_to_name} onAssign={onAssign} />}
        </article>
    );
}

/**
 * "Revisada por: …" al pie de la tarjeta. Con permiso es un botón que abre la asignación ("Asignar"
 * si todavía no la tiene nadie); no arrastra ni abre la orden.
 */
function ReviewerRow({ name, onAssign }: { name?: string | null; onAssign?: () => void }) {
    const t = useTranslations('StudyOrdersPage.board');
    if (!name && !onAssign) return null;

    const content = name ? (
        <>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary" aria-hidden="true">
                {initialsOf(name)}
            </span>
            <span className="min-w-0 truncate">
                <span className="text-muted-foreground">{t('reviewedByLabel')}</span>{' '}
                <span className="font-medium text-foreground">{name}</span>
            </span>
        </>
    ) : (
        <>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground" aria-hidden="true">
                <UserPlus className="h-3 w-3" />
            </span>
            <span className="font-medium text-primary">{t('assign')}</span>
        </>
    );

    if (!onAssign) {
        return <div className="flex min-w-0 items-center gap-1.5 border-t pt-1.5 text-[11px]">{content}</div>;
    }
    return (
        <button
            type="button"
            className="-mx-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-1.5 rounded border-t px-1 pt-1.5 text-left text-[11px] transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={name ? t('reassignHint', { name }) : t('assign')}
            // Que no arrastre ni abra la orden: este botón solo asigna.
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAssign(); }}
        >
            {content}
        </button>
    );
}

// ─── Resumen a primera vista ────────────────────────────────────────────────

interface OrderSummaryPopoverProps {
    order: StudyOrderListItem;
    scope: StudyOrderScope;
    onOpen: (order: StudyOrderListItem) => void;
    onAssign?: (order: StudyOrderListItem) => void;
}

function OrderSummaryPopover({ order, scope, onOpen, onAssign }: OrderSummaryPopoverProps) {
    const t = useTranslations('StudyOrdersPage');
    const [open, setOpen] = React.useState(false);
    const reviewPending = Number(order.review_pending) || 0;
    const canAssignThis = !!onAssign && isStudyOrderAssignable(order);

    const row = (label: string, value: React.ReactNode) => (value === null || value === undefined || value === '') ? null : (
        <div className="grid grid-cols-[96px_1fr] gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
        </div>
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t('board.summary')}
                    title={t('board.summary')}
                    // Que no arrastre ni abra la orden: el botón es solo para el resumen.
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-80 space-y-3 p-3 text-xs"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-muted-foreground">{order.order_number}</p>
                        <p className="truncate text-sm font-semibold">{order.patient_name}</p>
                    </div>
                    <StudyOrderStatusBadge
                        status={order.board_status}
                        isOverdue={order.is_overdue}
                        itemsScheduled={order.items_scheduled}
                        itemsTotal={order.items_total}
                        className="flex-col items-end"
                    />
                </div>
                <dl className="space-y-1.5">
                    {row(t('board.fields.document'), order.patient_document)}
                    {row(t('board.fields.phone'), order.patient_phone)}
                    {scope === 'clinic' && row(t('board.fields.doctor'), order.doctor_name || order.referring_doctor_name)}
                    {row(t('board.fields.studies'), order.items_summary)}
                    {order.items_total > 0 && row(t('board.fields.progress'), t('board.progressLong', {
                        scheduled: order.items_scheduled, completed: order.items_completed, total: order.items_total,
                    }))}
                    {row(t('board.fields.sede'), order.preferred_sede_name)}
                    {row(t('board.fields.submitted'), order.submitted_at ? formatDisplayDate(order.submitted_at) : null)}
                    {scope === 'clinic' && row(t('board.fields.assigned'), order.assigned_to_name || t('board.unassigned'))}
                    {reviewPending > 0 && row(t('board.fields.review'), t('review.pendingCount', { count: reviewPending }))}
                </dl>
                <div className="flex gap-2">
                    <Button size="sm" className="h-8 flex-1" onClick={() => { setOpen(false); onOpen(order); }}>
                        {t('board.openDetail')}
                    </Button>
                    {canAssignThis && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setOpen(false); onAssign?.(order); }}>
                            <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            {order.assigned_to ? t('board.reassign') : t('board.assign')}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default StudyOrderBoard;
