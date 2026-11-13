'use client';

import * as React from 'react';
import { ArrowRight, ChevronDown, ExternalLink, FlaskConical, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { Can } from '@/components/auth/Can';
import { LabOrderDetailSheet } from '@/components/lab-orders/lab-order-detail-sheet';
import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';
import { LabOrderMoveDialog, labOrderMoveNeeds, type LabOrderMoveDetails, type LabOrderMoveRequest } from '@/components/lab-orders/lab-order-laboratory-dialog';
import {
  DUE_SOON_DAYS, LabOrderDaysInStage, LabOrderDueLabel, LabOrderNoLabBadge, LabStageBadge, LabStageProgress,
  daysUntilDue, labOrderWork, nextLabStage, useLabOrderErrorText,
} from '@/components/lab-orders/lab-order-shared';

import { useLabOrdersLive } from '@/hooks/use-lab-orders-live';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS, isAbortError, isTimeoutError } from '@/services/api';
import { LabOrdersError, changeLabOrderStage, searchLabOrders } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrder, LabStage, Laboratory } from '@/lib/types';

interface PatientLabOrdersTabProps {
  patientId: string;
  patientName: string;
  readOnly?: boolean;
}

/** Aviso de la tira de arriba: filtra la sección "En curso". */
type AlertFilter = 'overdue' | 'dueSoon' | 'noLab';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha ISO UTC del backend (con o sin Z) como Date. */
function parseUtc(iso: string): Date {
  return parseISO(iso.endsWith('Z') ? iso : `${iso}Z`);
}

function matchesAlert(order: LabOrder, filter: AlertFilter): boolean {
  if (filter === 'overdue') return order.is_overdue;
  if (filter === 'noLab') return !order.laboratory_id;
  if (!order.due_date || order.is_past_due) return false;
  const days = daysUntilDue(order.due_date);
  return days >= 0 && days < DUE_SOON_DAYS;
}

/** Ficha del paciente → Clínica → Laboratorio: sus órdenes en curso y finalizadas. */
export function PatientLabOrdersTab({ patientId, patientName, readOnly = false }: PatientLabOrdersTabProps) {
  const t = useTranslations('LabOrdersPage');
  const locale = useLocale();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const errorText = useLabOrderErrorText();
  const [orders, setOrders] = React.useState<LabOrder[] | null>(null);
  const [stages, setStages] = React.useState<LabStage[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [alertFilter, setAlertFilter] = React.useState<AlertFilter | null>(null);
  /** null: abierta solo si no hay órdenes en curso. */
  const [finishedOpen, setFinishedOpen] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchLabStages({ signal: controller.signal })
      .then((data) => setStages(data.filter((s) => s.is_active)))
      .catch(() => { /* sin etapas solo faltan el progreso y "Pasar a…"; la lista igual se muestra */ });
    return () => controller.abort();
  }, []);

  // Todas las del paciente (son pocas; el backend trae solo pendientes si no se dice): se separan acá.
  React.useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    searchLabOrders({ patient_id: patientId, pending_only: false, limit: 200 }, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setOrders(result.items); })
      .catch((error) => { if (!isAbortError(error)) setLoadError(errorText(error)); });
    return () => controller.abort();
  }, [patientId, reloadKey, errorText]);

  // Otro paciente: los avisos y la sección plegada vuelven al estado inicial.
  React.useEffect(() => {
    setAlertFilter(null);
    setFinishedOpen(null);
  }, [patientId]);

  const reload = () => setReloadKey((k) => k + 1);

  // Otro usuario creó, movió o editó una orden: se relee (la lista es corta).
  useLabOrdersLive(reload);

  const inProgress = React.useMemo(() => (orders ?? []).filter((o) => o.is_pending), [orders]);
  const finished = React.useMemo(() => (orders ?? []).filter((o) => !o.is_pending), [orders]);
  const alertCounts = React.useMemo(() => ({
    overdue: inProgress.filter((o) => matchesAlert(o, 'overdue')).length,
    dueSoon: inProgress.filter((o) => matchesAlert(o, 'dueSoon')).length,
    noLab: inProgress.filter((o) => matchesAlert(o, 'noLab')).length,
  }), [inProgress]);
  // Un aviso que ya no tiene órdenes (se movieron) deja de filtrar.
  const activeFilter = alertFilter && alertCounts[alertFilter] > 0 ? alertFilter : null;
  const visibleInProgress = activeFilter ? inProgress.filter((o) => matchesAlert(o, activeFilter)) : inProgress;
  const isFinishedOpen = finishedOpen ?? inProgress.length === 0;

  const canCreate = !readOnly && hasPermission(LAB_ORDERS_PERMISSIONS.CREATE);
  const canChangeStage = !readOnly && hasPermission(LAB_ORDERS_PERMISSIONS.CHANGE_STAGE);

  // "Pasar a «X»" desde la tarjeta: una orden a la vez.
  const [movingId, setMovingId] = React.useState<number | null>(null);
  const movingRef = React.useRef(false);
  const [labRequest, setLabRequest] = React.useState<LabOrderMoveRequest | null>(null);

  const moveOrder = async (order: LabOrder, target: LabStage, details?: LabOrderMoveDetails) => {
    if (movingRef.current) return;
    // Al enviarla se pide la fecha de entrega (y el laboratorio si falta): primero el modal.
    const needs = details ? null : labOrderMoveNeeds(order, target);
    if (needs) {
      setLabRequest({ order, stage: target, needs });
      return;
    }
    movingRef.current = true;
    setMovingId(order.id);
    try {
      const saved = await changeLabOrderStage(order.id, target.id, order.current_stage_id, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }, { laboratoryId: details?.laboratory?.id, dueDate: details?.dueDate });
      setOrders((prev) => prev && prev.map((o) => (o.id === saved.id ? saved : o)));
      toast({ title: t('moved', { stage: saved.stage_name }) });
    } catch (error) {
      const retryNeeds = error instanceof LabOrdersError
        && (error.code === 'LABORATORY_REQUIRED' || error.code === 'DUE_DATE_REQUIRED')
        ? labOrderMoveNeeds(order, target, error.code) : null;
      if (retryNeeds) {
        setLabRequest({ order, stage: target, needs: retryNeeds });
        return;
      }
      toast({ variant: 'destructive', title: t('moveError'), description: errorText(error) });
      // Otro usuario la movió, o el guardado pudo aplicarse: se muestra el estado real.
      if (isTimeoutError(error) || (error instanceof LabOrdersError && (error.code === 'STAGE_CONFLICT' || error.code === 'INVALID_STAGE'))) reload();
    } finally {
      movingRef.current = false;
      setMovingId(null);
    }
  };

  const total = orders?.length ?? 0;

  const newOrderButton = canCreate && (
    <Button data-help-id="patients.btn.new-lab-order" size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
      <Plus className="h-4 w-4" />
      {t('new')}
    </Button>
  );

  const renderCard = (order: LabOrder) => {
    const next = order.is_pending && canChangeStage ? nextLabStage(stages, order.current_stage_id) : null;
    const isMoving = movingId === order.id;
    // Con el progreso a la vista, la etiqueta de etapa repetiría el paso resaltado.
    const showProgress = order.is_pending && stages.some((s) => s.id === order.current_stage_id);
    const entered = parseUtc(order.stage_entered_at);
    const totalDays = Math.max(0, Math.floor((entered.getTime() - parseUtc(order.created_at).getTime()) / DAY_MS));
    const details = [
      order.laboratory_name,
      order.teeth.length > 0 ? t('teethShort', { teeth: order.teeth.join(', ') }) : null,
      order.due_date && order.is_pending ? t('dueShort', { date: formatDisplayDate(order.due_date) }) : null,
    ].filter(Boolean).join(' · ');

    return (
      <li
        key={order.id}
        className={cn(
          'relative rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring',
          order.is_overdue ? 'border-destructive/40' : 'border-border',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* El botón cubre toda la tarjeta (after:inset-0); "Pasar a…" queda por encima. */}
            <button
              type="button"
              onClick={() => setSelectedId(order.id)}
              className="block max-w-full truncate text-left text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
            >
              {labOrderWork(order)}
            </button>
            {details && <p className="truncate text-xs text-muted-foreground">{details}</p>}
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">#{order.id}</span>
        </div>

        {showProgress && (
          <LabStageProgress stages={stages} currentStageId={order.current_stage_id} className="mt-2.5" />
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {!showProgress && <LabStageBadge name={order.stage_name} color={order.stage_color} />}
            <LabOrderDueLabel order={order} onlySoon />
            <LabOrderNoLabBadge order={order} />
            {!order.is_pending && (
              <span className="text-[11px] text-muted-foreground">
                {t('patientTab.finishedOn', { date: format(entered, 'dd/MM/yyyy'), days: totalDays })}
              </span>
            )}
          </div>
          {order.is_pending && (
            <div className="flex items-center gap-2">
              <LabOrderDaysInStage order={order} />
              {next && (
                <Button
                  data-help-id="patients.btn.lab-order-next-stage"
                  size="sm"
                  variant="outline"
                  className="relative z-10 h-7 gap-1 px-2 text-xs"
                  disabled={movingId !== null}
                  onClick={() => { void moveOrder(order, next); }}
                >
                  {isMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span className="max-w-[10rem] truncate">{t('nextStage', { stage: next.name })}</span>
                  {!isMoving && <ArrowRight className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

  const alertChips: { key: AlertFilter; label: string; tone: string }[] = [
    { key: 'overdue', label: t('patientTab.alertOverdue', { count: alertCounts.overdue }), tone: 'border-destructive/40 bg-destructive/5 text-destructive' },
    { key: 'dueSoon', label: t('patientTab.alertDueSoon', { count: alertCounts.dueSoon }), tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    { key: 'noLab', label: t('patientTab.alertNoLab', { count: alertCounts.noLab }), tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  ];
  const shownChips = alertChips.filter((c) => alertCounts[c.key] > 0);

  return (
    <div data-help-id="patients.section.lab-orders" className="flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 dark:bg-link/15">
            <FlaskConical className="h-5 w-5 text-primary dark:text-link" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{t('title')}</h3>
            <p className="text-sm text-muted-foreground">
              {orders === null
                ? ' '
                : t('patientTab.subtitle', { pending: inProgress.length, finished: finished.length })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {total > 0 && (
            <Can permission={LAB_ORDERS_PERMISSIONS.VIEW_MENU}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button data-help-id="patients.btn.open-lab-orders" variant="outline" size="icon" className="h-9 w-9" asChild>
                      <Link href={`/${locale}/lab-orders?patient=${encodeURIComponent(patientId)}`} aria-label={t('patientTab.openModule')}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('patientTab.openModule')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Can>
          )}
          {newOrderButton}
        </div>
      </div>

      <div className="space-y-4 p-3">
        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={reload}>{t('retry')}</Button>
          </div>
        )}

        {orders === null && !loadError && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        )}

        {orders !== null && total === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t('patientTab.emptyTitle')}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t('patientTab.emptyHint')}</p>
            {newOrderButton && <div className="mt-1">{newOrderButton}</div>}
          </div>
        )}

        {orders !== null && total > 0 && (
          <>
            {shownChips.length > 0 && (
              <div data-help-id="patients.section.lab-order-alerts" role="group" aria-label={t('patientTab.alertsLabel')} className="flex flex-wrap gap-1.5">
                {shownChips.map((chip) => {
                  const active = activeFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setAlertFilter(active ? null : chip.key)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        chip.tone,
                        active ? 'ring-2 ring-current/30 ring-offset-1 ring-offset-background' : 'opacity-90 hover:opacity-100',
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}

            <section data-help-id="patients.section.lab-orders-in-progress" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('patientTab.inProgress')} ({inProgress.length})
                </h4>
                {activeFilter && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setAlertFilter(null)}>
                    {t('patientTab.showAll')}
                  </Button>
                )}
              </div>
              {inProgress.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">{t('patientTab.noneInProgress')}</p>
              ) : (
                <ul className="space-y-2">{visibleInProgress.map(renderCard)}</ul>
              )}
            </section>

            {finished.length > 0 && (
              <Collapsible open={isFinishedOpen} onOpenChange={setFinishedOpen}>
                <section data-help-id="patients.section.lab-orders-finished" className="space-y-2">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !isFinishedOpen && '-rotate-90')} />
                      {t('patientTab.finished')} ({finished.length})
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="space-y-2">{finished.map(renderCard)}</ul>
                  </CollapsibleContent>
                </section>
              </Collapsible>
            )}
          </>
        )}
      </div>

      <LabOrderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        patient={{ id: patientId, name: patientName }}
        onSaved={(order) => {
          toast({ title: t('created', { id: order.id }) });
          reload();
        }}
      />

      <LabOrderDetailSheet
        orderId={selectedId}
        stages={stages}
        readOnly={readOnly}
        onClose={() => setSelectedId(null)}
        onChanged={() => reload()}
      />

      <LabOrderMoveDialog
        request={labRequest}
        onCancel={() => setLabRequest(null)}
        onConfirm={(details) => {
          const request = labRequest;
          setLabRequest(null);
          const order = request && orders?.find((o) => o.id === request.order.id);
          const target = request && stages.find((s) => s.id === request.stage.id);
          if (order && target) void moveOrder(order, target, details);
        }}
      />
    </div>
  );
}
