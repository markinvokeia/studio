'use client';

import * as React from 'react';
import { AlertTriangle, ArrowRight, FlaskConical, Maximize2, Minimize2, Pencil, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { Can } from '@/components/auth/Can';
import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';
import { LabOrderDaysInStage, LabStageBadge, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';

import { useAsyncAction } from '@/hooks/use-async-action';
import { useLabOrdersLive } from '@/hooks/use-lab-orders-live';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS, isAbortError, isTimeoutError } from '@/services/api';
import { LabOrdersError, changeLabOrderStage, deleteLabOrder, fetchLabOrderDetail } from '@/services/lab-orders';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrder, LabOrderDetail, LabStage } from '@/lib/types';

export interface LabOrderDetailSheetProps {
  /** Orden a mostrar; null cierra el panel. */
  orderId: number | null;
  /** Etapas activas, en orden: opciones de "Mover a…". */
  stages: LabStage[];
  onClose: () => void;
  /** Después de editar, mover o eliminar (null) — para refrescar la lista. */
  onChanged: (order: LabOrder | null) => void;
}

export interface LabOrderDetailPanelProps extends LabOrderDetailSheetProps {
  /** Panel derecho a pantalla completa (como el resto de los paneles de detalle). */
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

/** Detalle como panel derecho de un TwoPanelLayout (Órdenes de laboratorio). */
export function LabOrderDetailPanel(props: LabOrderDetailPanelProps) {
  return <LabOrderDetailView {...props} variant="panel" />;
}

/** Detalle en un Sheet, para abrirlo desde otra pantalla (ficha del paciente). */
export function LabOrderDetailSheet(props: LabOrderDetailSheetProps) {
  return <LabOrderDetailView {...props} variant="sheet" />;
}

/** Detalle de una orden: datos, "Mover a…" (alternativa al arrastre, también en celular) e historial de etapas. */
function LabOrderDetailView({
  orderId, stages, onClose, onChanged, isExpanded, onToggleExpanded, variant,
}: LabOrderDetailPanelProps & { variant: 'panel' | 'sheet' }) {
  const t = useTranslations('LabOrdersPage');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const errorText = useLabOrderErrorText();
  const [detail, setDetail] = React.useState<LabOrderDetail | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (orderId == null) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    // Otra orden: no mostrar la anterior mientras carga.
    setDetail((prev) => (prev?.id === orderId ? prev : null));
    fetchLabOrderDetail(orderId, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setDetail(data); })
      .catch((error) => { if (!isAbortError(error)) setLoadError(errorText(error)); });
    return () => controller.abort();
  }, [orderId, reloadKey, errorText]);

  const reload = () => setReloadKey((k) => k + 1);

  // Si otro usuario la mueve o la edita mientras está abierta, se ve sin cerrar el panel.
  useLabOrdersLive(() => { if (orderId != null) reload(); });

  const move = useAsyncAction(
    (toStageId: number) => changeLabOrderStage(detail!.id, toStageId, detail!.current_stage_id, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
    {
      onSuccess: (order) => {
        toast({ title: t('moved', { stage: order.stage_name }) });
        onChanged(order);
        reload();
      },
      onError: (error) => {
        // Otro usuario la movió, o el guardado pudo aplicarse: se muestra el estado real.
        if (isTimeoutError(error) || (error instanceof LabOrdersError && error.code === 'STAGE_CONFLICT')) reload();
        toast({ variant: 'destructive', title: t('moveError'), description: errorText(error) });
      },
      showErrorToast: false,
    },
  );

  const remove = useAsyncAction(
    () => deleteLabOrder(detail!.id, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
    {
      onSuccess: () => {
        toast({ title: t('deleted') });
        setDeleteOpen(false);
        onChanged(null);
        onClose();
      },
      errorTitle: t('deleteError'),
    },
  );

  const canChangeStage = hasPermission(LAB_ORDERS_PERMISSIONS.CHANGE_STAGE);
  const moveTargets = stages.filter((s) => s.is_active && s.id !== detail?.current_stage_id);

  const title = detail ? detail.patient_name : t('detail.loading');
  const subtitle = detail ? `#${detail.id} · ${detail.work_description}` : ' ';
  const busy = move.isPending || remove.isPending;

  const body = (
    <>
      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={reload}>{t('retry')}</Button>
          </AlertDescription>
        </Alert>
      )}

      {!detail && !loadError && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {detail && (
        <>
          <section data-help-id="lab-orders.section.detail-stage" className="space-y-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LabStageBadge name={detail.stage_name} color={detail.stage_color} />
              <LabOrderDaysInStage order={detail} />
            </div>
            {detail.is_overdue && (
              <p className="text-xs text-destructive">{t('overdueHint', { days: detail.stage_overdue_days ?? 0 })}</p>
            )}
            {canChangeStage && (
              <Select
                value=""
                onValueChange={(value) => move.run(Number(value))}
                disabled={move.isPending || moveTargets.length === 0}
              >
                <SelectTrigger data-help-id="lab-orders.btn.move-to" className="h-9" aria-label={t('moveTo')}>
                  <SelectValue placeholder={move.isPending ? t('moving') : t('moveTo')} />
                </SelectTrigger>
                <SelectContent>
                  {moveTargets.map((stage) => (
                    <SelectItem key={stage.id} value={String(stage.id)}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </section>

          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('columns.laboratory')}</dt>
            <dd className="truncate">{detail.laboratory_name || '—'}</dd>
            <dt className="text-muted-foreground">{t('columns.doctor')}</dt>
            <dd className="truncate">{detail.doctor_name || '—'}</dd>
            <dt className="text-muted-foreground">{t('columns.work')}</dt>
            <dd className="whitespace-pre-wrap break-words">{detail.work_description}</dd>
            <dt className="text-muted-foreground">{t('form.teeth')}</dt>
            <dd>{detail.teeth.length > 0 ? detail.teeth.join(', ') : '—'}</dd>
            <dt className="text-muted-foreground">{t('form.dueDate')}</dt>
            <dd>{detail.due_date ? formatDisplayDate(detail.due_date) : '—'}</dd>
            <dt className="text-muted-foreground">{t('form.notes')}</dt>
            <dd className="whitespace-pre-wrap break-words">{detail.notes || '—'}</dd>
            <dt className="text-muted-foreground">{t('columns.createdAt')}</dt>
            <dd>{formatUtcDateTime(detail.created_at)}{detail.created_by_name ? ` · ${detail.created_by_name}` : ''}</dd>
          </dl>

          <section data-help-id="lab-orders.section.history" className="space-y-2">
            <h3 className="text-sm font-semibold">{t('detail.history')}</h3>
            <ol className="space-y-2">
              {detail.history.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.from_stage_name ? (
                      <>
                        <LabStageBadge name={entry.from_stage_name} color={entry.from_stage_color || '#64748b'} />
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">{t('detail.created')}</span>
                    )}
                    <LabStageBadge name={entry.to_stage_name} color={entry.to_stage_color} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatUtcDateTime(entry.changed_at)}
                    {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ''}
                    {entry.note === 'stage_deactivated' ? ` · ${t('detail.byStageDeactivation')}` : entry.note ? ` · ${entry.note}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  );

  const dialogs = (
    <>
      <LabOrderFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        order={detail}
        onSaved={(order) => {
          toast({ title: t('saved') });
          onChanged(order);
          reload();
        }}
      />

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { id: detail?.id ?? '', patient: detail?.patient_name ?? '' })}
        cancelLabel={t('deleteDialog.cancel')}
        confirmLabel={t('deleteDialog.confirm')}
        onConfirm={() => remove.run()}
        isPending={remove.isPending}
      />
    </>
  );

  if (variant === 'panel') {
    // Mismo encabezado que los paneles de detalle de Proveedores / Grupos: ícono, título y
    // acciones como íconos a la derecha (editar, eliminar, expandir, cerrar).
    return (
      <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
        <CardHeader data-help-id="lab-orders.section.detail" className="flex-none p-4 pb-2 space-y-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="header-icon-circle flex-none"><FlaskConical className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base lg:text-lg truncate">{title}</CardTitle>
              <CardDescription className="text-xs truncate">{subtitle}</CardDescription>
            </div>
            <div className="flex flex-none items-center gap-1">
              <TooltipProvider delayDuration={200}>
                {detail && (
                  <Can permission={LAB_ORDERS_PERMISSIONS.UPDATE}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button data-help-id="lab-orders.btn.edit" variant="ghost" size="icon" className="h-8 w-8" aria-label={t('detail.edit')} onClick={() => setEditOpen(true)} disabled={busy}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('detail.edit')}</TooltipContent>
                    </Tooltip>
                  </Can>
                )}
                {detail && (
                  <Can permission={LAB_ORDERS_PERMISSIONS.DELETE}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button data-help-id="lab-orders.btn.delete" variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" aria-label={t('detail.delete')} onClick={() => setDeleteOpen(true)} disabled={busy}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('detail.delete')}</TooltipContent>
                    </Tooltip>
                  </Can>
                )}
                {onToggleExpanded && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label={isExpanded ? t('detail.restore') : t('detail.expand')} onClick={onToggleExpanded}>
                        {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isExpanded ? t('detail.restore') : t('detail.expand')}</TooltipContent>
                  </Tooltip>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={onClose} disabled={busy}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">{t('detail.close')}</span>
                </Button>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">{body}</div>
        {dialogs}
      </Card>
    );
  }

  return (
    <Sheet open={orderId != null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle className="truncate">{title}</SheetTitle>
          <SheetDescription className="truncate">{subtitle}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">{body}</div>

        {detail && (
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Can permission={LAB_ORDERS_PERMISSIONS.DELETE}>
              <Button
                data-help-id="lab-orders.btn.delete"
                variant="ghost"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
                {t('detail.delete')}
              </Button>
            </Can>
            <Can permission={LAB_ORDERS_PERMISSIONS.UPDATE}>
              <Button data-help-id="lab-orders.btn.edit" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)} disabled={busy}>
                <Pencil className="h-4 w-4" />
                {t('detail.edit')}
              </Button>
            </Can>
          </div>
        )}
      </SheetContent>
      {dialogs}
    </Sheet>
  );
}
