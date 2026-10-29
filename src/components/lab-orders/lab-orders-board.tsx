'use client';

import * as React from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, GripVertical, Loader2, MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { LabOrderDaysInStage, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';

import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS, isAbortError, isTimeoutError } from '@/services/api';
import { LabOrdersError, changeLabOrderStage, fetchLabOrdersBoard, searchLabOrders } from '@/services/lab-orders';

import type { LabOrder, LabOrderBoardFilters, LabStage } from '@/lib/types';

interface ColumnState {
  total: number;
  items: LabOrder[];
}

type BoardData = Record<number, ColumnState>;

const PER_COLUMN = 30;
const COLLAPSED_STORAGE = 'lab-orders-board-collapsed';

function readCollapsed(): Set<number> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch { /* sin storage */ }
  return new Set();
}

/** Copia del tablero con la orden fuera de todas las columnas y puesta en `toStage`. */
function placeOrder(data: BoardData, order: LabOrder, toStage: number, fromStage: number, index?: number): BoardData {
  const next: BoardData = { ...data };
  const from = next[fromStage];
  if (from) {
    const items = from.items.filter((o) => o.id !== order.id);
    next[fromStage] = { total: Math.max(0, from.total - (items.length < from.items.length ? 1 : 0)), items };
  }
  const to = next[toStage] ?? { total: 0, items: [] };
  const items = to.items.filter((o) => o.id !== order.id);
  const at = index == null ? 0 : Math.min(index, items.length);
  items.splice(at, 0, order);
  next[toStage] = { total: to.total + (items.length > to.items.length ? 1 : 0), items };
  return next;
}

export interface LabOrdersBoardProps {
  /** Etapas activas, en orden. Una columna por cada una. */
  stages: LabStage[];
  filters: Omit<LabOrderBoardFilters, 'per_column' | 'final_days'>;
  /** Las columnas finales muestran lo que llegó en los últimos N días. */
  finalDays: number;
  /** Cambia para volver a pedir el tablero (alta, edición, evento en vivo). */
  reloadKey: number;
  canChangeStage: boolean;
  onOpen: (order: LabOrder) => void;
  /** Después de mover una orden (para refrescar el detalle si está abierto). */
  onMoved?: (order: LabOrder) => void;
  className?: string;
}

/**
 * Tablero de órdenes de laboratorio: una columna por etapa activa. Arrastrar una tarjeta (o
 * "Mover a…" en su menú, para celular y teclado) cambia la etapa y se guarda en el momento:
 * la tarjeta se mueve enseguida, vuelve a su lugar si el guardado falla y no se puede volver
 * a mover mientras se guarda.
 */
export function LabOrdersBoard({ stages, filters, finalDays, reloadKey, canChangeStage, onOpen, onMoved, className }: LabOrdersBoardProps) {
  const t = useTranslations('LabOrdersPage');
  const { toast } = useToast();
  const errorText = useLabOrderErrorText();
  const [data, setData] = React.useState<BoardData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);
  const [pending, setPending] = React.useState<Set<number>>(new Set());
  const [loadingMore, setLoadingMore] = React.useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set());
  const [dragging, setDragging] = React.useState<LabOrder | null>(null);
  /** Llegó una recarga mientras se guardaba un movimiento: se aplica cuando terminan. */
  const deferredReloadRef = React.useRef(false);
  /** Órdenes con un guardado en vuelo. Ref (no estado) para que un segundo arrastre inmediato ya lo vea. */
  const inFlightRef = React.useRef<Set<number>>(new Set());
  const [internalReload, setInternalReload] = React.useState(0);

  React.useEffect(() => {
    if (pending.size === 0 && deferredReloadRef.current) {
      deferredReloadRef.current = false;
      setInternalReload((k) => k + 1);
    }
  }, [pending]);

  React.useEffect(() => { setCollapsed(readCollapsed()); }, []);

  const stageById = React.useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const { search, laboratory_id, doctor_id, overdue_only } = filters;
  React.useEffect(() => {
    // Una recarga con un movimiento en vuelo pisaría la tarjeta movida: se posterga.
    if (inFlightRef.current.size > 0) {
      deferredReloadRef.current = true;
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetchLabOrdersBoard(
      { search, laboratory_id, doctor_id, overdue_only, per_column: PER_COLUMN, final_days: finalDays },
      { signal: controller.signal },
    )
      .then((columns) => {
        if (controller.signal.aborted) return;
        const next: BoardData = {};
        for (const column of columns) next[column.stage_id] = { total: column.total, items: column.items };
        setData(next);
      })
      .catch((error) => { if (!isAbortError(error)) setLoadError(errorText(error)); });
    return () => controller.abort();
  }, [search, laboratory_id, doctor_id, overdue_only, finalDays, reloadKey, retryKey, internalReload, errorText]);

  const toggleCollapsed = (stageId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      try { localStorage.setItem(COLLAPSED_STORAGE, JSON.stringify([...next])); } catch { /* sin storage */ }
      return next;
    });
  };

  const findOrder = (id: number): { order: LabOrder; stageId: number; index: number } | null => {
    if (!data) return null;
    for (const [stageId, column] of Object.entries(data)) {
      const index = column.items.findIndex((o) => o.id === id);
      if (index >= 0) return { order: column.items[index], stageId: Number(stageId), index };
    }
    return null;
  };

  const move = async (orderId: number, toStageId: number) => {
    const found = findOrder(orderId);
    if (!found || found.stageId === toStageId || inFlightRef.current.has(orderId)) return;
    inFlightRef.current.add(orderId);
    const { order, stageId: fromStageId, index } = found;
    const target = stageById.get(toStageId);

    // Optimista: la tarjeta pasa ya a la columna destino, marcada como "guardando".
    setData((prev) => prev && placeOrder(prev, {
      ...order,
      current_stage_id: toStageId,
      stage_name: target?.name ?? order.stage_name,
      stage_color: target?.color ?? order.stage_color,
      stage_kind: target?.kind ?? order.stage_kind,
      stage_overdue_days: target?.overdue_days ?? null,
      days_in_stage: 0,
      is_overdue: false,
      is_pending: target ? target.kind !== 'final' : order.is_pending,
    }, toStageId, fromStageId));
    setPending((prev) => new Set(prev).add(orderId));

    try {
      const saved = await changeLabOrderStage(orderId, toStageId, fromStageId, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
      setData((prev) => prev && placeOrder(prev, saved, saved.current_stage_id, toStageId));
      onMoved?.(saved);
    } catch (error) {
      // Vuelve a su columna y a su lugar.
      setData((prev) => prev && placeOrder(prev, order, fromStageId, toStageId, index));
      toast({ variant: 'destructive', title: t('moveError'), description: errorText(error) });
      if (isTimeoutError(error) || (error instanceof LabOrdersError && (error.code === 'STAGE_CONFLICT' || error.code === 'INVALID_STAGE'))) {
        deferredReloadRef.current = true;
      }
    } finally {
      inFlightRef.current.delete(orderId);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const loadMore = async (stage: LabStage) => {
    const column = data?.[stage.id];
    if (!column || loadingMore.has(stage.id)) return;
    setLoadingMore((prev) => new Set(prev).add(stage.id));
    try {
      const isFinal = stage.kind === 'final';
      const result = await searchLabOrders({
        stage_ids: [stage.id],
        search, laboratory_id, doctor_id, overdue_only,
        entered_within_days: isFinal ? finalDays : undefined,
        // Mismo orden que el tablero: finales más recientes primero, el resto más antiguas primero.
        sort: isFinal ? 'days_asc' : 'days_desc',
        limit: PER_COLUMN,
        offset: column.items.length,
      });
      setData((prev) => prev && ({
        ...prev,
        [stage.id]: {
          total: result.total || prev[stage.id].total,
          items: [...prev[stage.id].items, ...result.items.filter((o) => !prev[stage.id].items.some((p) => p.id === o.id))],
        },
      }));
    } catch (error) {
      toast({ variant: 'destructive', title: t('loadMoreError'), description: errorText(error) });
    } finally {
      setLoadingMore((prev) => {
        const next = new Set(prev);
        next.delete(stage.id);
        return next;
      });
    }
  };

  // Mouse: después de moverse unos píxeles (un clic abre la orden). Táctil: pulsación larga (si
  // no, no se podría desplazar el tablero). Teclado: barra espaciadora (Enter abre la orden).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDragging(findOrder(Number(event.active.id))?.order ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const toStage = event.over ? Number(event.over.id) : NaN;
    if (!Number.isFinite(toStage)) return;
    void move(Number(event.active.id), toStage);
  };

  const stageName = (id: string | number | undefined) => (id == null ? '' : stageById.get(Number(id))?.name ?? '');
  const orderLabel = (id: string | number) => {
    const order = findOrder(Number(id))?.order;
    return order ? `#${order.id} ${order.patient_name}` : `#${id}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.a11y.start', { order: orderLabel(active.id) }),
    onDragOver: ({ active, over }) => (over ? t('board.a11y.over', { order: orderLabel(active.id), stage: stageName(over.id) }) : t('board.a11y.outside', { order: orderLabel(active.id) })),
    onDragEnd: ({ active, over }) => (over ? t('board.a11y.end', { order: orderLabel(active.id), stage: stageName(over.id) }) : t('board.a11y.cancel', { order: orderLabel(active.id) })),
    onDragCancel: ({ active }) => t('board.a11y.cancel', { order: orderLabel(active.id) }),
  };

  if (loadError && !data) {
    return (
      <div role="alert" className="m-1 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <span>{loadError}</span>
        <Button size="sm" variant="outline" onClick={() => setRetryKey((k) => k + 1)}>{t('retry')}</Button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('board.a11y.instructions') } }}
    >
      {loadError && (
        <div role="alert" className="mx-1 mb-2 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => setRetryKey((k) => k + 1)}>{t('retry')}</Button>
        </div>
      )}
      <div data-help-id="lab-orders.section.board" className={cn('flex min-h-0 flex-1 gap-3 overflow-x-auto px-1 pb-3', className)}>
        {stages.map((stage) => {
          const column = data?.[stage.id];
          const isCollapsed = collapsed.has(stage.id);
          return (
            <BoardColumn
              key={stage.id}
              stage={stage}
              column={column}
              isLoading={!data}
              isCollapsed={isCollapsed}
              finalDays={finalDays}
              loadingMore={loadingMore.has(stage.id)}
              onToggleCollapsed={() => toggleCollapsed(stage.id)}
              onLoadMore={() => loadMore(stage)}
            >
              {column?.items.map((order) => (
                <BoardCard
                  key={order.id}
                  order={order}
                  stages={stages}
                  isPending={pending.has(order.id)}
                  canChangeStage={canChangeStage}
                  onOpen={() => onOpen(order)}
                  onMove={(toStageId) => { void move(order.id, toStageId); }}
                />
              ))}
            </BoardColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <CardBody order={dragging} className="rotate-1 shadow-xl ring-1 ring-primary/30" />}
      </DragOverlay>
    </DndContext>
  );
}

interface BoardColumnProps {
  stage: LabStage;
  column?: ColumnState;
  isLoading: boolean;
  isCollapsed: boolean;
  finalDays: number;
  loadingMore: boolean;
  onToggleCollapsed: () => void;
  onLoadMore: () => void;
  children?: React.ReactNode;
}

function BoardColumn({ stage, column, isLoading, isCollapsed, finalDays, loadingMore, onToggleCollapsed, onLoadMore, children }: BoardColumnProps) {
  const t = useTranslations('LabOrdersPage');
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = column?.total ?? 0;
  const shown = column?.items.length ?? 0;
  const isFinal = stage.kind === 'final';

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex w-11 shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 py-2 transition-colors',
          isOver && 'border-primary bg-primary/5',
        )}
      >
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggleCollapsed} aria-label={t('board.expand', { stage: stage.name })}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-semibold tabular-nums">{total}</span>
        <span className="text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">{stage.name}</span>
      </div>
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={stage.name}
      className={cn(
        'flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/30 transition-colors',
        isOver && 'border-primary bg-primary/5',
      )}
    >
      <div className="h-1 shrink-0" style={{ backgroundColor: stage.color }} />
      <header className="flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={stage.name}>{stage.name}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">{total}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggleCollapsed} aria-label={t('board.collapse', { stage: stage.name })}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </header>
      {isFinal && <p className="px-3 pb-1 text-[11px] text-muted-foreground">{t('board.finalWindow', { days: finalDays })}</p>}
      <div className="min-h-[6rem] flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {isLoading && (
          <>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        )}
        {!isLoading && shown === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">{t('board.emptyColumn')}</p>}
        {children}
        {shown < total && (
          <Button variant="ghost" size="sm" className="w-full" onClick={onLoadMore} loading={loadingMore}>
            {t('board.loadMore', { count: total - shown })}
          </Button>
        )}
      </div>
    </section>
  );
}

interface BoardCardProps {
  order: LabOrder;
  stages: LabStage[];
  isPending: boolean;
  canChangeStage: boolean;
  onOpen: () => void;
  onMove: (toStageId: number) => void;
}

function BoardCard({ order, stages, isPending, canChangeStage, onOpen, onMove }: BoardCardProps) {
  const t = useTranslations('LabOrdersPage');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    // Mientras se guarda no se puede volver a mover la misma tarjeta.
    disabled: !canChangeStage || isPending,
  });
  const targets = stages.filter((s) => s.id !== order.current_stage_id);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-roledescription={canChangeStage ? t('board.a11y.card') : undefined}
      aria-busy={isPending || undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter') onOpen();
      }}
      className={cn(
        'group relative outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg',
        canChangeStage && !isPending && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <CardBody order={order} isPending={isPending}>
        {canChangeStage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                disabled={isPending}
                aria-label={t('board.cardMenu', { id: order.id })}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>{t('moveTo')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {targets.map((stage) => (
                <DropdownMenuItem key={stage.id} onSelect={() => onMove(stage.id)}>
                  <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardBody>
    </div>
  );
}

function CardBody({ order, isPending, className, children }: { order: LabOrder; isPending?: boolean; className?: string; children?: React.ReactNode }) {
  const t = useTranslations('LabOrdersPage');
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-2.5 text-left shadow-sm transition-colors',
        order.is_overdue ? 'border-destructive/50 bg-destructive/5' : 'border-border',
        isPending && 'opacity-70',
        className,
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{order.patient_name}</p>
          <p className="truncate text-xs text-muted-foreground">{order.work_description}</p>
          {order.laboratory_name && <p className="truncate text-xs text-muted-foreground">{order.laboratory_name}</p>}
        </div>
        {children}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 pl-5">
        <span className="font-mono text-[11px] text-muted-foreground">#{order.id}</span>
        {order.due_date && order.is_pending && (
          <span className="truncate text-[11px] text-muted-foreground">{t('dueShort', { date: formatDisplayDate(order.due_date) })}</span>
        )}
        {order.is_pending && <LabOrderDaysInStage order={order} />}
      </div>
    </div>
  );
}
