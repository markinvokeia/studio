'use client';

import * as React from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Ban, Bell, BellRing, FlaskConical, GripVertical, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { Can } from '@/components/auth/Can';
import { DEFAULT_LAB_DUE_ALERT, LabStageAlertsDialog, labStageAlertIssues } from '@/components/lab-orders/lab-stage-alerts-dialog';

import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS, isAbortError, isTimeoutError } from '@/services/api';
import { fetchLabStageAlertOptions, type LabStageAlertOptions } from '@/services/lab-stage-alert-options';
import { LabStagesSaveError, fetchLabStages, saveLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabStage, LabStageAlerts, LabStageKind, LabStageSaveItem } from '@/lib/types';

const KINDS: LabStageKind[] = ['initial', 'intermediate', 'final'];
const DEFAULT_COLOR = '#64748b';

/** Etapa en edición. `key` identifica la fila también antes de guardarla (id todavía null). */
interface DraftStage {
  key: string;
  id: number | null;
  name: string;
  color: string;
  kind: LabStageKind;
  /** Texto del input: '' = sin umbral. */
  overdueDays: string;
  isActive: boolean;
  ordersCount: number;
  inUse: boolean;
  /** Al desactivar una etapa con órdenes: a qué etapa pasan (se aplica al guardar). */
  moveOrdersTo: number | null;
  alerts: LabStageAlerts;
}

const NO_ALERTS: LabStageAlerts = { enter: null, dwell: null, due: null };

function toDraft(stage: LabStage): DraftStage {
  return {
    key: `id-${stage.id}`,
    id: stage.id,
    name: stage.name,
    color: stage.color,
    kind: stage.kind,
    overdueDays: stage.overdue_days != null ? String(stage.overdue_days) : '',
    isActive: stage.is_active,
    ordersCount: stage.orders_count,
    inUse: stage.in_use,
    moveOrdersTo: null,
    alerts: stage.alerts ?? NO_ALERTS,
  };
}

function toSaveItem(stage: DraftStage): LabStageSaveItem {
  const overdue = Number.parseInt(stage.overdueDays, 10);
  return {
    id: stage.id,
    name: stage.name.trim(),
    color: stage.color,
    kind: stage.kind,
    overdue_days: stage.kind !== 'final' && overdue > 0 ? overdue : null,
    is_active: stage.isActive,
    move_orders_to: stage.isActive ? null : stage.moveOrdersTo,
    // Una final (o sin umbral) no tiene alerta por permanencia; una final tampoco por entrega vencida.
    alerts: {
      enter: stage.alerts.enter,
      dwell: stage.kind !== 'final' && overdue > 0 ? stage.alerts.dwell : null,
      due: stage.kind !== 'final' ? stage.alerts.due : null,
    },
  };
}

type ValidationIssue = 'noInitial' | 'manyInitial' | 'noFinal' | 'emptyName' | 'duplicateName' | 'invalidOverdue' | 'dwellWithoutThreshold' | 'invalidAlerts';

/** Lo mismo que valida lab_stages_save: se muestra antes de guardar para no ir al servidor a fallar. */
function validate(stages: DraftStage[]): ValidationIssue[] {
  const active = stages.filter((s) => s.isActive);
  const issues: ValidationIssue[] = [];
  const initials = active.filter((s) => s.kind === 'initial').length;
  if (initials === 0) issues.push('noInitial');
  if (initials > 1) issues.push('manyInitial');
  if (!active.some((s) => s.kind === 'final')) issues.push('noFinal');
  if (stages.some((s) => !s.name.trim())) issues.push('emptyName');
  const names = active.map((s) => s.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) issues.push('duplicateName');
  if (stages.some((s) => s.overdueDays !== '' && !(Number.parseInt(s.overdueDays, 10) > 0))) issues.push('invalidOverdue');
  // Se borró el umbral de una etapa que tenía alerta por permanencia: al guardar se perdería.
  if (stages.some((s) => s.alerts.dwell && s.kind !== 'final' && !(Number.parseInt(s.overdueDays, 10) > 0))) issues.push('dwellWithoutThreshold');
  if (stages.some((s) => [s.alerts.enter, s.alerts.dwell, s.alerts.due].some((a) => labStageAlertIssues(a).length > 0))) issues.push('invalidAlerts');
  return issues;
}

/**
 * Configuración → Etapas de laboratorio. Lista editable de etapas activas (arrastrar para
 * reordenar) y debajo las desactivadas. Todo se guarda junto con "Guardar": el backend valida
 * la configuración completa (una sola inicial, al menos una final) en una transacción.
 */
export default function LabStagesConfigPage() {
  const t = useTranslations('LabStagesPage');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();

  const [stages, setStages] = React.useState<DraftStage[]>([]);
  const [initialJson, setInitialJson] = React.useState('[]');
  const [moveDialogKey, setMoveDialogKey] = React.useState<string | null>(null);
  const [alertsDialogKey, setAlertsDialogKey] = React.useState<string | null>(null);
  const [alertOptions, setAlertOptions] = React.useState<LabStageAlertOptions | null>(null);
  const [alertOptionsError, setAlertOptionsError] = React.useState<string | null>(null);
  const [alertOptionsKey, setAlertOptionsKey] = React.useState(0);
  const newKeyRef = React.useRef(0);

  const { data: loaded, setData, isLoading, isRefreshing, error: loadError, reload } = useDataLoader(
    (signal) => fetchLabStages({ signal }),
    [] as LabStage[],
  );

  // La lista editable se rearma cada vez que llegan datos del servidor (carga o guardado).
  React.useEffect(() => {
    const drafts = loaded.map(toDraft);
    setStages(drafts);
    setInitialJson(JSON.stringify(drafts));
  }, [loaded]);

  const isDirty = JSON.stringify(stages) !== initialJson;
  const issues = React.useMemo(() => validate(stages), [stages]);
  const activeStages = stages.filter((s) => s.isActive);
  const inactiveStages = stages.filter((s) => !s.isActive);

  const save = useAsyncAction(
    () => saveLabStages(stages.map(toSaveItem), { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
    {
      onSuccess: (saved) => {
        setData(saved);
        toast({ title: t('saved') });
      },
      onError: (error) => {
        // Tras un timeout la configuración pudo guardarse igual: se relee para ver el estado real.
        if (isTimeoutError(error)) reload();
        toast({
          variant: 'destructive',
          title: t('saveError'),
          description: error instanceof LabStagesSaveError
            ? t(`errors.${error.code}`, { name: error.detail ?? '' })
            : isTimeoutError(error) ? tCommon('timeoutError') : getErrorMessage(error) || tCommon('genericError'),
        });
      },
      // El toast lo arma onError: los errores de validación del backend llegan como código y se traducen.
      showErrorToast: false,
    },
  );

  const busy = save.isPending || isRefreshing;

  const update = (key: string, patch: Partial<DraftStage>) => {
    setStages((prev) => prev.map((s) => {
      if (s.key === key) return { ...s, ...patch };
      // Solo puede haber una inicial: la anterior pasa a intermedia.
      if (patch.kind === 'initial' && s.kind === 'initial' && s.isActive) return { ...s, kind: 'intermediate' };
      return s;
    }));
  };

  const changeKind = (key: string, kind: LabStageKind) => {
    const stage = stages.find((s) => s.key === key);
    // Una etapa final no tiene atraso ni, por lo tanto, alertas por permanencia o entrega vencida.
    update(key, kind === 'final' ? { kind, overdueDays: '', alerts: { enter: stage?.alerts.enter ?? null, dwell: null, due: null } } : { kind });
  };

  // Opciones de las alertas (roles, personal, plantillas): se piden al abrir el diálogo por primera vez.
  const needsAlertOptions = alertsDialogKey !== null && alertOptions === null;
  React.useEffect(() => {
    if (!needsAlertOptions) return;
    const controller = new AbortController();
    setAlertOptionsError(null);
    fetchLabStageAlertOptions({ signal: controller.signal })
      .then((opts) => { if (!controller.signal.aborted) setAlertOptions(opts); })
      .catch((error) => { if (!isAbortError(error)) setAlertOptionsError(getErrorMessage(error) || tCommon('genericError')); });
    return () => controller.abort();
  }, [needsAlertOptions, alertOptionsKey, tCommon]);

  const addStage = () => {
    newKeyRef.current += 1;
    const draft: DraftStage = {
      key: `new-${newKeyRef.current}`, id: null, name: '', color: DEFAULT_COLOR, kind: 'intermediate',
      overdueDays: '', isActive: true, ordersCount: 0, inUse: false, moveOrdersTo: null,
      // Una etapa nueva ya avisa si la entrega se vence mientras la orden está en ella.
      alerts: { ...NO_ALERTS, due: { ...DEFAULT_LAB_DUE_ALERT } },
    };
    // Antes de la primera final: el circuito suele terminar en las finales.
    setStages((prev) => {
      const firstFinal = prev.findIndex((s) => s.isActive && s.kind === 'final');
      if (firstFinal < 0) return [...prev, draft];
      return [...prev.slice(0, firstFinal), draft, ...prev.slice(firstFinal)];
    });
  };

  const removeStage = (key: string) => setStages((prev) => prev.filter((s) => s.key !== key));

  const deactivate = (stage: DraftStage) => {
    // Con órdenes hay que decir a dónde pasan antes de ocultarla del tablero.
    if (stage.ordersCount > 0) {
      setMoveDialogKey(stage.key);
      return;
    }
    update(stage.key, { isActive: false });
  };

  const reactivate = (key: string) => {
    // Vuelve al final de las activas; si era la inicial, vuelve como intermedia
    // para no romper "una sola inicial" (se puede volver a marcar).
    setStages((prev) => {
      const stage = prev.find((s) => s.key === key);
      if (!stage) return prev;
      const revived: DraftStage = {
        ...stage, isActive: true, moveOrdersTo: null,
        kind: stage.kind === 'initial' ? 'intermediate' : stage.kind,
      };
      const rest = prev.filter((s) => s.key !== key);
      const lastActive = rest.reduce((idx, s, i) => (s.isActive ? i : idx), -1);
      return [...rest.slice(0, lastActive + 1), revived, ...rest.slice(lastActive + 1)];
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setStages((prev) => {
      const from = prev.findIndex((s) => s.key === active.id);
      const to = prev.findIndex((s) => s.key === over.id);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  };

  const [discardOpen, setDiscardOpen] = React.useState(false);
  const discard = () => {
    setStages(JSON.parse(initialJson) as DraftStage[]);
    setDiscardOpen(false);
  };

  const moveDialogStage = stages.find((s) => s.key === moveDialogKey) ?? null;
  const alertsDialogStage = stages.find((s) => s.key === alertsDialogKey) ?? null;
  const alertsDialogOverdue = alertsDialogStage ? Number.parseInt(alertsDialogStage.overdueDays, 10) : NaN;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  // Si la carga falla no se muestra una lista vacía: guardarla borraría las etapas reales.
  if (loadError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader icon={<FlaskConical className="h-5 w-5" />} title={t('title')} description={t('description')} />
        <Alert variant="destructive" className="m-1">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('loadError')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={() => reload()} loading={isRefreshing}>
              {tCommon('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        icon={<FlaskConical className="h-5 w-5" />}
        title={t('title')}
        description={t('description')}
        actions={
          <Can permission={LAB_ORDERS_PERMISSIONS.STAGES_CONFIG}>
            <div className="flex items-center gap-2">
              <Button data-help-id="config.lab-stages.btn.discard" title={t('discard')} variant="outline" onClick={() => setDiscardOpen(true)} disabled={!isDirty || busy} className="gap-1.5 px-2.5 lg:px-4">
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only lg:not-sr-only">{t('discard')}</span>
              </Button>
              <Button data-help-id="config.lab-stages.btn.add" title={t('add')} variant="outline" onClick={addStage} disabled={busy} className="gap-1.5 px-2.5 lg:px-4">
                <Plus className="h-4 w-4" />
                <span className="sr-only lg:not-sr-only">{t('add')}</span>
              </Button>
              <Button
                data-help-id="config.lab-stages.btn.save"
                title={t('save')}
                onClick={() => save.run()}
                disabled={!isDirty || issues.length > 0 || busy}
                loading={save.isPending}
                className="gap-1.5 px-2.5 lg:px-4"
              >
                <Save className="h-4 w-4" />
                <span className="sr-only lg:not-sr-only">{t('save')}</span>
              </Button>
            </div>
          </Can>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1 pb-6">
        <p className="px-1 text-xs text-muted-foreground">{t('hint')}</p>

        {issues.length > 0 && (
          <Alert data-help-id="config.lab-stages.section.issues" className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>{t('issues.title')}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-0.5 pl-4">
                {issues.map((issue) => <li key={issue}>{t(`issues.${issue}`)}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card data-help-id="config.lab-stages.section.active">
          <div className={cn('hidden items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground lg:grid', STAGE_ROW_GRID)}>
            <span />
            <span>{t('columns.color')}</span>
            <span>{t('columns.name')}</span>
            <span>{t('columns.kind')}</span>
            <span>{t('columns.overdueDays')}</span>
            <span>{t('columns.orders')}</span>
            <span />
          </div>
          <TooltipProvider delayDuration={200}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activeStages.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y">
                  {activeStages.map((stage, index) => (
                    <SortableStageRow
                      key={stage.key}
                      stage={stage}
                      position={index + 1}
                      disabled={busy}
                      onChange={(patch) => update(stage.key, patch)}
                      onKindChange={(kind) => changeKind(stage.key, kind)}
                      onDeactivate={() => deactivate(stage)}
                      onRemove={() => removeStage(stage.key)}
                      onEditAlerts={() => setAlertsDialogKey(stage.key)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </TooltipProvider>
          {activeStages.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('emptyActive')}</p>
          )}
        </Card>

        {inactiveStages.length > 0 && (
          <section data-help-id="config.lab-stages.section.inactive" className="space-y-2">
            <h3 className="px-1 text-sm font-semibold">{t('inactiveTitle')}</h3>
            <ul className="divide-y rounded-xl border border-dashed border-border bg-muted/20">
              {inactiveStages.map((stage) => {
                const target = stages.find((s) => s.id != null && s.id === stage.moveOrdersTo);
                return (
                  <li key={stage.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: stage.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{stage.name}</span>
                    {target && (
                      <span className="text-xs text-muted-foreground">
                        {t('movesTo', { count: stage.ordersCount, name: target.name })}
                      </span>
                    )}
                    <Can permission={LAB_ORDERS_PERMISSIONS.STAGES_CONFIG}>
                      <Button size="sm" variant="outline" onClick={() => reactivate(stage.key)} disabled={busy}>
                        {t('reactivate')}
                      </Button>
                    </Can>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <LabStageAlertsDialog
        open={alertsDialogStage !== null}
        onOpenChange={(open) => { if (!open) setAlertsDialogKey(null); }}
        stageName={alertsDialogStage?.name || t('newBadge')}
        stageKind={alertsDialogStage?.kind ?? 'intermediate'}
        overdueDays={alertsDialogOverdue > 0 ? alertsDialogOverdue : null}
        value={alertsDialogStage?.alerts ?? NO_ALERTS}
        options={alertOptions}
        optionsError={alertOptionsError}
        onRetryOptions={() => setAlertOptionsKey((k) => k + 1)}
        disabled={busy}
        onApply={(alerts) => { if (alertsDialogKey) update(alertsDialogKey, { alerts }); }}
      />

      <ConfirmActionDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('discardDialog.title')}
        description={t('discardDialog.description')}
        cancelLabel={t('discardDialog.cancel')}
        confirmLabel={t('discardDialog.confirm')}
        onConfirm={discard}
        isPending={false}
      />

      <MoveOrdersDialog
        stage={moveDialogStage}
        targets={activeStages.filter((s) => s.key !== moveDialogKey && s.id != null)}
        onOpenChange={(open) => { if (!open) setMoveDialogKey(null); }}
        onConfirm={(targetId) => {
          if (moveDialogKey) update(moveDialogKey, { isActive: false, moveOrdersTo: targetId });
          setMoveDialogKey(null);
        }}
      />
    </div>
  );
}

/**
 * Columnas de la tabla de etapas (encabezado y filas). Debajo de lg la fila se apila en dos
 * renglones: con el menú lateral y la barra derecha, en tablet la tabla no entra.
 */
const STAGE_ROW_GRID = 'lg:grid-cols-[2rem_3rem_minmax(8rem,1fr)_9rem_8.5rem_6.5rem_7.5rem]';

interface SortableStageRowProps {
  stage: DraftStage;
  position: number;
  disabled: boolean;
  onChange: (patch: Partial<DraftStage>) => void;
  onKindChange: (kind: LabStageKind) => void;
  onDeactivate: () => void;
  onRemove: () => void;
  onEditAlerts: () => void;
}

function SortableStageRow({ stage, position, disabled, onChange, onKindChange, onDeactivate, onRemove, onEditAlerts }: SortableStageRowProps) {
  const t = useTranslations('LabStagesPage');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.key,
    disabled,
  });
  // Una etapa nueva o sin uso se puede borrar; con órdenes o historial solo se desactiva.
  const canRemove = !stage.inUse;
  const isFinal = stage.kind === 'final';
  const alertCount = [stage.alerts.enter, stage.alerts.dwell, stage.alerts.due].filter(Boolean).length;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[2rem_3rem_minmax(0,1fr)] items-center gap-2 bg-card px-3 py-2.5',
        STAGE_ROW_GRID,
        isDragging && 'relative z-10 rounded-lg shadow-lg ring-1 ring-primary/30',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t('dragHandle', { name: stage.name || position })}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Input
        type="color"
        value={stage.color}
        onChange={(e) => onChange({ color: e.target.value })}
        disabled={disabled}
        className="h-9 w-12 p-1"
        aria-label={t('columns.color')}
      />

      <Input
        value={stage.name}
        onChange={(e) => onChange({ name: e.target.value })}
        disabled={disabled}
        maxLength={80}
        placeholder={t('namePlaceholder')}
        aria-label={t('columns.name')}
        aria-invalid={!stage.name.trim()}
        className={cn(!stage.name.trim() && 'border-destructive/60')}
      />

      <div className="col-span-3 grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2 pl-[5.5rem] lg:col-span-1 lg:block lg:pl-0">
        <Select value={stage.kind} onValueChange={(value) => onKindChange(value as LabStageKind)} disabled={disabled}>
          <SelectTrigger aria-label={t('columns.kind')} className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>{t(`kinds.${kind}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="lg:hidden">
          <OverdueInput stage={stage} disabled={disabled || isFinal} onChange={onChange} />
        </div>
      </div>

      <div className="hidden lg:block">
        <OverdueInput stage={stage} disabled={disabled || isFinal} onChange={onChange} />
      </div>

      <div className="col-span-3 flex items-center justify-between gap-2 pl-[5.5rem] lg:contents">
        <span className="text-sm">
          {stage.ordersCount > 0
            ? <Badge variant="outline" className="whitespace-nowrap font-medium">{t('ordersCount', { count: stage.ordersCount })}</Badge>
            : <span className="text-xs text-muted-foreground">{stage.id == null ? t('newBadge') : '—'}</span>}
        </span>

        <Can permission={LAB_ORDERS_PERMISSIONS.STAGES_CONFIG}>
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-help-id="config.lab-stages.btn.alerts"
                  size="icon"
                  variant="ghost"
                  onClick={onEditAlerts}
                  disabled={disabled}
                  aria-label={t('alerts.open', { count: alertCount })}
                  className={cn('relative', alertCount > 0 && 'text-primary')}
                >
                  {alertCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  {alertCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {alertCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('alerts.open', { count: alertCount })}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onDeactivate}
                    disabled={disabled || stage.kind === 'initial'}
                    aria-label={t('deactivate')}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{stage.kind === 'initial' ? t('deactivateInitialHint') : t('deactivate')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onRemove}
                    disabled={disabled || !canRemove}
                    aria-label={t('remove')}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{canRemove ? t('remove') : t('removeInUseHint')}</TooltipContent>
            </Tooltip>
          </div>
        </Can>
      </div>
    </li>
  );
}

function OverdueInput({ stage, disabled, onChange }: { stage: DraftStage; disabled: boolean; onChange: (patch: Partial<DraftStage>) => void }) {
  const t = useTranslations('LabStagesPage');
  const isFinal = stage.kind === 'final';
  const hasValue = !isFinal && stage.overdueDays.trim() !== '';
  return (
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={isFinal ? '' : stage.overdueDays}
        onChange={(e) => onChange({ overdueDays: e.target.value })}
        disabled={disabled}
        placeholder={isFinal ? t('overdueNotApplicable') : t('overduePlaceholder')}
        aria-label={t('columns.overdueDays')}
        className={cn('h-9', hasValue && 'pr-10')}
      />
      {/* Sin valor se ve el placeholder ("Sin umbral"): el sufijo lo taparía. */}
      {hasValue && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {t('daysSuffix')}
        </span>
      )}
    </div>
  );
}

function MoveOrdersDialog({
  stage,
  targets,
  onOpenChange,
  onConfirm,
}: {
  stage: DraftStage | null;
  targets: DraftStage[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (targetId: number) => void;
}) {
  const t = useTranslations('LabStagesPage');
  const [target, setTarget] = React.useState<string>('');

  React.useEffect(() => {
    if (stage) setTarget('');
  }, [stage]);

  return (
    <Dialog open={stage !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('moveDialog.title', { name: stage?.name ?? '' })}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4 px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {t('moveDialog.description', { count: stage?.ordersCount ?? 0, name: stage?.name ?? '' })}
          </p>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger aria-label={t('moveDialog.target')}>
              <SelectValue placeholder={t('moveDialog.target')} />
            </SelectTrigger>
            <SelectContent>
              {targets.map((s) => (
                <SelectItem key={s.key} value={String(s.id)}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{t('moveDialog.appliedOnSave')}</p>
        </DialogBody>
        <DialogFooter>
          <DialogCancelButton>{t('moveDialog.cancel')}</DialogCancelButton>
          <Button onClick={() => onConfirm(Number(target))} disabled={!target}>
            {t('moveDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
