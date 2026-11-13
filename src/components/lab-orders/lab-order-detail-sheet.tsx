'use client';

import * as React from 'react';
import { AlertTriangle, ArrowRight, Building2, ChevronDown, ExternalLink, FlaskConical, Mail, MapPin, Maximize2, Minimize2, Pencil, Phone, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { Can } from '@/components/auth/Can';
import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';
import { LabOrderMoveDialog, labOrderMoveNeeds, type LabOrderMoveRequest } from '@/components/lab-orders/lab-order-laboratory-dialog';
import {
  LabOrderDaysInStage, LabOrderNoLabBadge, LabOrderPastDueBadge, LabStageBadge, LabStageProgress, labOrderWork, nextLabStage,
  useLabOrderErrorText, useLabOrderOverdueReasons, useLabStayText,
} from '@/components/lab-orders/lab-order-shared';

import { useAsyncAction } from '@/hooks/use-async-action';
import { useLabOrdersLive } from '@/hooks/use-lab-orders-live';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneNumber } from '@/lib/phone-text';
import { cn, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS, isAbortError, isTimeoutError } from '@/services/api';
import { LabOrdersError, changeLabOrderStage, deleteLabOrder, fetchLabOrderDetail } from '@/services/lab-orders';

import { LAB_ORDERS_PERMISSIONS, PATIENTS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrder, LabOrderDetail, LabOrderLaboratoryInfo, LabStage } from '@/lib/types';

const SECTION_TITLE = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export interface LabOrderDetailSheetProps {
  /** Orden a mostrar; null cierra el panel. */
  orderId: number | null;
  /** Etapas activas, en orden: opciones de "Mover a…". */
  stages: LabStage[];
  onClose: () => void;
  /** Después de editar, mover o eliminar (null) — para refrescar la lista. */
  onChanged: (order: LabOrder | null) => void;
  /** Solo lectura (historia clínica sin permiso de escritura): sin editar, eliminar ni mover. */
  readOnly?: boolean;
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

/**
 * Laboratorio asignado con lo que guarda su ficha de proveedor: categorías, teléfonos (se pueden
 * marcar), correo y dirección. Para pedir el estado del trabajo sin salir de la orden.
 */
function LabOrderLaboratorySection({ laboratory }: { laboratory: LabOrderLaboratoryInfo }) {
  const t = useTranslations('LabOrdersPage');
  const phones = [
    { key: 'phone', label: t('detail.labPhone'), value: laboratory.phone_number },
    { key: 'alt', label: t('detail.labAlternativePhone'), value: laboratory.alternative_phone },
  ].filter((p): p is { key: string; label: string; value: string } => !!p.value);
  const hasContact = phones.length > 0 || !!laboratory.email || !!laboratory.address;

  return (
    <section data-help-id="lab-orders.section.detail-laboratory" className="space-y-2">
      <h3 className={SECTION_TITLE}>{t('detail.sectionLaboratory')}</h3>
      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="break-words text-sm font-semibold leading-tight">{laboratory.name}</p>
            {laboratory.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {laboratory.categories.map((category) => (
                  <span key={category.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {category.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {!hasContact && <p className="text-xs text-muted-foreground">{t('detail.labNoContact')}</p>}
        {(hasContact || laboratory.rut) && (
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            {phones.map((phone) => (
              <React.Fragment key={phone.key}>
                <dt className="text-muted-foreground">{phone.label}</dt>
                <dd className="min-w-0">
                  <a
                    href={`tel:${phone.value.replace(/[^\d+]/g, '')}`}
                    className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
                    aria-label={t('detail.labCall', { name: laboratory.name })}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{formatPhoneNumber(phone.value)}</span>
                  </a>
                </dd>
              </React.Fragment>
            ))}
            {laboratory.email && (
              <>
                <dt className="text-muted-foreground">{t('detail.labEmail')}</dt>
                <dd className="min-w-0">
                  <a
                    href={`mailto:${laboratory.email}`}
                    className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
                    aria-label={t('detail.labWriteTo', { name: laboratory.name })}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{laboratory.email}</span>
                  </a>
                </dd>
              </>
            )}
            {laboratory.address && (
              <>
                <dt className="text-muted-foreground">{t('detail.labAddress')}</dt>
                <dd className="flex min-w-0 items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="whitespace-pre-line break-words">{laboratory.address}</span>
                </dd>
              </>
            )}
            {laboratory.rut && (
              <>
                <dt className="text-muted-foreground">{t('detail.labRut')}</dt>
                <dd className="font-mono text-xs leading-5">{laboratory.rut}</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </section>
  );
}

/** Detalle de una orden: datos, "Mover a…" (alternativa al arrastre, también en celular) e historial de etapas. */
function LabOrderDetailView({
  orderId, stages, onClose, onChanged, isExpanded, onToggleExpanded, variant, readOnly = false,
}: LabOrderDetailPanelProps & { variant: 'panel' | 'sheet' }) {
  const t = useTranslations('LabOrdersPage');
  const locale = useLocale();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const errorText = useLabOrderErrorText();
  const overdueReasons = useLabOrderOverdueReasons();
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

  // Enviarla al laboratorio (fecha de entrega) o moverla sin laboratorio: primero el modal.
  const [labRequest, setLabRequest] = React.useState<LabOrderMoveRequest | null>(null);
  const moveTargetRef = React.useRef<number | null>(null);
  /** Etapa destino del movimiento en curso: qué botón muestra el "cargando". */
  const [movingTo, setMovingTo] = React.useState<number | null>(null);

  const move = useAsyncAction(
    ({ toStageId, laboratoryId, dueDate }: { toStageId: number; laboratoryId?: string; dueDate?: string | null }) => {
      moveTargetRef.current = toStageId;
      setMovingTo(toStageId);
      return changeLabOrderStage(detail!.id, toStageId, detail!.current_stage_id, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }, { laboratoryId, dueDate });
    },
    {
      onSuccess: (order) => {
        toast({ title: t('moved', { stage: order.stage_name }) });
        onChanged(order);
        reload();
      },
      onError: (error) => {
        const target = stages.find((s) => s.id === moveTargetRef.current);
        const needs = detail && error instanceof LabOrdersError
          && (error.code === 'LABORATORY_REQUIRED' || error.code === 'DUE_DATE_REQUIRED')
          ? labOrderMoveNeeds(detail, target, error.code) : null;
        if (needs && detail && target) {
          setLabRequest({ order: detail, stage: target, needs });
          return;
        }
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

  const canChangeStage = !readOnly && hasPermission(LAB_ORDERS_PERMISSIONS.CHANGE_STAGE);
  const moveTargets = stages.filter((s) => s.is_active && s.id !== detail?.current_stage_id);
  const nextStage = detail ? nextLabStage(stages, detail.current_stage_id) : null;
  const stayText = useLabStayText();
  const detailHistory = detail?.history;
  const history = React.useMemo(
    () => [...(detailHistory ?? [])].sort((a, b) => b.changed_at.localeCompare(a.changed_at) || b.id - a.id),
    [detailHistory],
  );

  // Al enviarla se pide la fecha de entrega (y el laboratorio si falta): primero el modal.
  const requestMove = (target: LabStage) => {
    if (!detail) return;
    const needs = labOrderMoveNeeds(detail, target);
    if (needs) setLabRequest({ order: detail, stage: target, needs });
    else move.run({ toStageId: target.id });
  };

  const title = detail ? detail.patient_name : t('detail.loading');
  const subtitle = detail ? `#${detail.id} · ${labOrderWork(detail)}` : ' ';
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
            {overdueReasons(detail).map((reason) => (
              <p key={reason} className="text-xs text-destructive">{reason}</p>
            ))}
            <LabStageProgress stages={stages} currentStageId={detail.current_stage_id} className="pt-1" />
            {canChangeStage && moveTargets.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {nextStage && (
                  <Button
                    data-help-id="lab-orders.btn.next-stage"
                    size="sm"
                    className="h-9 min-w-0 flex-1 gap-1.5"
                    onClick={() => requestMove(nextStage)}
                    loading={move.isPending && movingTo === nextStage.id}
                    disabled={move.isPending}
                  >
                    <span className="truncate">{t('nextStage', { stage: nextStage.name })}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      data-help-id="lab-orders.btn.move-to"
                      size="sm"
                      variant="outline"
                      className={cn('h-9 gap-1.5', !nextStage && 'flex-1')}
                      disabled={move.isPending}
                      loading={move.isPending && movingTo !== nextStage?.id}
                    >
                      {nextStage ? t('otherStage') : t('moveTo')}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {moveTargets.map((stage) => (
                      <DropdownMenuItem key={stage.id} onSelect={() => requestMove(stage)}>
                        <span className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </section>

          <section data-help-id="lab-orders.section.detail-work" className="space-y-2">
            <h3 className={SECTION_TITLE}>{t('columns.work')}</h3>
            {detail.items.length > 0 && (
              <ul data-help-id="lab-orders.section.detail-services" className="space-y-1.5">
                {detail.items.map((item) => (
                  <li key={item.id} className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                    <p className="break-words font-medium">
                      {item.service_name}
                      {item.quantity > 1 && <span className="font-normal text-muted-foreground"> ×{item.quantity}</span>}
                    </p>
                    {(item.teeth.length > 0 || item.notes) && (
                      <p className="break-words text-xs text-muted-foreground">
                        {[item.teeth.length > 0 ? t('teethShort', { teeth: item.teeth.join(', ') }) : null, item.notes]
                          .filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {detail.work_description && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {detail.items.length > 0 && <span className="text-muted-foreground">{t('detail.description')}: </span>}
                {detail.work_description}
              </p>
            )}
            {/* Con servicios, las piezas ya van en cada uno: acá solo cuando no hay. */}
            {detail.items.length === 0 && detail.teeth.length > 0 && (
              <p className="text-sm text-muted-foreground">{t('teethShort', { teeth: detail.teeth.join(', ') })}</p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className={SECTION_TITLE}>{t('detail.sectionOrder')}</h3>
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('columns.patient')}</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="truncate">{detail.patient_name}</span>
                {/* Desde la ficha del paciente (sheet) ya se está en el paciente. */}
                {variant === 'panel' && (
                  <Can permission={PATIENTS_PERMISSIONS.VIEW_LIST}>
                    <Link
                      data-help-id="lab-orders.btn.open-patient"
                      href={`/${locale}/patients?q=${encodeURIComponent(detail.patient_name)}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {t('detail.openPatient')}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </Can>
                )}
              </dd>
              {/* Con los datos del laboratorio (script 172) va en su propia sección, abajo. */}
              {!detail.laboratory && (
                <>
                  <dt className="text-muted-foreground">{t('columns.laboratory')}</dt>
                  <dd className="truncate">
                    {detail.laboratory_name || (detail.is_pending ? <LabOrderNoLabBadge order={detail} /> : '—')}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">{t('columns.doctor')}</dt>
              <dd className="truncate">{detail.doctor_name || '—'}</dd>
              <dt className="text-muted-foreground">{t('form.dueDate')}</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{detail.due_date ? formatDisplayDate(detail.due_date) : '—'}</span>
                <LabOrderPastDueBadge order={detail} />
              </dd>
            </dl>
          </section>

          {detail.laboratory && <LabOrderLaboratorySection laboratory={detail.laboratory} />}

          {detail.notes && (
            <section className="space-y-2">
              <h3 className={SECTION_TITLE}>{t('form.notes')}</h3>
              <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 px-3 py-2 text-sm">{detail.notes}</p>
            </section>
          )}

          <section data-help-id="lab-orders.section.history" className="space-y-2">
            <h3 className={SECTION_TITLE}>{t('detail.history')}</h3>
            <ol className="space-y-2">
              {history.map((entry, index) => {
                // El historial va del más nuevo al más viejo: el siguiente movimiento es el anterior en la lista.
                const isCurrent = index === 0 && entry.to_stage_id === detail.current_stage_id;
                const stay = index > 0 ? stayText(entry.changed_at, history[index - 1].changed_at) : null;
                return (
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
                      {isCurrent && (
                        <span className="ml-auto text-xs font-medium text-primary">
                          {t('detail.current', { days: t('daysInStage', { count: detail.days_in_stage }) })}
                        </span>
                      )}
                      {stay && <span className="ml-auto text-xs font-medium text-muted-foreground">{stay}</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatUtcDateTime(entry.changed_at)}
                      {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ''}
                      {entry.note === 'stage_deactivated' ? ` · ${t('detail.byStageDeactivation')}` : entry.note ? ` · ${entry.note}` : ''}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

        </>
      )}
    </>
  );

  const dialogs = (
    <>
      <LabOrderMoveDialog
        request={labRequest}
        onCancel={() => setLabRequest(null)}
        onConfirm={({ laboratory, dueDate }) => {
          const request = labRequest;
          setLabRequest(null);
          if (request) move.run({ toStageId: request.stage.id, laboratoryId: laboratory?.id, dueDate });
        }}
      />
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

        {detail && !readOnly && (
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
