'use client';

import * as React from 'react';
import { addDays, format, parseISO, startOfToday, subDays } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { LabStageBadge, utcIsoToLocalDateKey } from '@/components/lab-orders/lab-order-shared';
import { LabSelector } from '@/components/lab-orders/lab-selector';

import { cn, formatDisplayDate } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { searchLaboratories } from '@/services/lab-orders';

import type { LabOrder, LabOrdersErrorCode, LabStage, LabStageKind, Laboratory } from '@/lib/types';

/** Qué hay que pedir antes de mover la orden a una etapa. */
export interface LabOrderMoveNeeds {
  /** Sin laboratorio, una orden solo puede ir a una etapa final (script 170). */
  laboratory: boolean;
  /**
   * Fecha de entrega: al enviar (salir de la etapa inicial hacia una no final, script 172) y al volver
   * a la etapa donde se fijó la fecha anterior (p. ej. reenviar al laboratorio, script 177).
   */
  dueDate: boolean;
}

/**
 * Lo que el modal tiene que pedir para mover `order` a `target`, o null si se mueve directo.
 * `errorCode`: el backend lo pidió aunque los datos locales digan otra cosa (etapas cambiadas).
 */
export function labOrderMoveNeeds(
  order: Pick<LabOrder, 'laboratory_id' | 'stage_kind' | 'current_stage_id' | 'due_stage_id'>,
  target: Pick<LabStage, 'id' | 'kind'> | { id?: number; kind: LabStageKind } | undefined | null,
  errorCode?: LabOrdersErrorCode,
): LabOrderMoveNeeds | null {
  if (!target) return null;
  const laboratory = errorCode === 'LABORATORY_REQUIRED' || (!order.laboratory_id && target.kind !== 'final');
  const sending = order.stage_kind === 'initial' && target.kind !== 'initial' && target.kind !== 'final';
  // Vuelve a la etapa donde se fijó la fecha: la anterior ya no sirve de plazo.
  const returning = target.kind !== 'final' && target.id != null
    && target.id === order.due_stage_id && target.id !== order.current_stage_id;
  const dueDate = errorCode === 'DUE_DATE_REQUIRED' || sending || returning;
  return laboratory || dueDate ? { laboratory, dueDate } : null;
}

export interface LabOrderMoveRequest {
  order: Pick<LabOrder, 'id' | 'patient_name' | 'lab_category_ids' | 'laboratory_name' | 'due_date' | 'stage_entered_at'>;
  /** `overdue_days` de la etapa destino: propone la fecha de entrega (hoy + ese plazo). */
  stage: Pick<LabStage, 'id' | 'name' | 'color'> & { overdue_days?: number | null };
  needs: LabOrderMoveNeeds;
}

/** Lo elegido en el modal: va en el mismo cambio de etapa. */
export interface LabOrderMoveDetails {
  laboratory: Laboratory | null;
  /** 'YYYY-MM-DD' (fecha local). */
  dueDate: string | null;
  /** 'YYYY-MM-DD': el día en que se envió, si fue antes de hoy (script 176). null = ahora. */
  effectiveDate: string | null;
}

const todayKey = () => format(startOfToday(), 'yyyy-MM-dd');
const yesterdayKey = () => format(subDays(startOfToday(), 1), 'yyyy-MM-dd');
/** `days` días después del día `from` ('YYYY-MM-DD'). */
const addDaysKey = (from: string, days: number) => format(addDays(parseISO(from), days), 'yyyy-MM-dd');

/** Atajos de fecha de entrega: 3 días, 1 y 2 semanas, más el plazo de la etapa si es otro. */
const DUE_SHORTCUTS = [3, 7, 14];

/**
 * Estado de lo que se pide al mover (laboratorio y fecha de entrega), ya propuesto para que
 * alcance con confirmar: la fecha que tenía la orden si todavía no pasó o, si no, hoy + el
 * plazo de atraso de la etapa destino; y el laboratorio cuando hay uno solo posible (el único
 * de la categoría de los servicios, o el único de la clínica).
 */
export function useLabOrderMoveState(request: LabOrderMoveRequest | null) {
  const [laboratory, setLaboratoryState] = React.useState<Laboratory | null>(null);
  const [dueDate, setDueDateState] = React.useState('');
  /** Día en que se envió ('YYYY-MM-DD'): hoy, salvo que se esté registrando un envío anterior. */
  const [sentOn, setSentOnState] = React.useState(todayKey);
  /** La persona ya eligió: la sugerencia que llegue después no la pisa. */
  const touchedLabRef = React.useRef(false);
  /** La persona eligió la fecha de entrega: cambiar el día del envío ya no la recalcula. */
  const touchedDueRef = React.useRef(false);

  /** La fecha que tenía la orden si no es anterior al envío; si no, el envío + el plazo de la etapa. */
  const proposeDue = React.useCallback((base: string) => {
    const saved = request?.order.due_date ?? '';
    const stageDays = request?.stage.overdue_days;
    return saved && saved >= base ? saved
      : request?.needs.dueDate && stageDays && stageDays > 0 ? addDaysKey(base, stageDays)
        : '';
  }, [request]);

  React.useEffect(() => {
    touchedLabRef.current = false;
    touchedDueRef.current = false;
    setLaboratoryState(null);
    setSentOnState(todayKey());
    setDueDateState(proposeDue(todayKey()));
  }, [proposeDue]);

  // Un solo laboratorio posible: se propone. Con más, la persona elige.
  React.useEffect(() => {
    if (!request?.needs.laboratory) return;
    const categories = request.order.lab_category_ids;
    const categoryId = categories.length === 1 ? categories[0] : null;
    const controller = new AbortController();
    searchLaboratories({ categoryId, limit: 2 }, { signal: controller.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation })
      .then((labs) => {
        if (!controller.signal.aborted && !touchedLabRef.current && labs.length === 1) setLaboratoryState(labs[0]);
      })
      .catch(() => { /* sin sugerencia: se elige a mano */ });
    return () => controller.abort();
  }, [request]);

  const setLaboratory = (lab: Laboratory | null) => {
    touchedLabRef.current = true;
    setLaboratoryState(lab);
  };
  const setDueDate = (value: string) => {
    touchedDueRef.current = true;
    setDueDateState(value);
  };
  const setSentOn = (value: string) => {
    setSentOnState(value);
    if (!touchedDueRef.current && value) setDueDateState(proposeDue(value));
  };

  const needs = request?.needs;
  const today = todayKey();
  /** Primer día posible del envío: cuando la orden entró a su etapa actual. */
  const minSentOn = request?.order.stage_entered_at ? utcIsoToLocalDateKey(request.order.stage_entered_at) : '';
  const sentOnInvalid = !!needs?.dueDate && (!sentOn || sentOn > today || (!!minSentOn && sentOn < minSentOn));
  /** La entrega no puede ser anterior al envío. */
  const pastDue = !!dueDate && !!sentOn && dueDate < sentOn;
  /** Envío retroactivo con una entrega que ya pasó: se puede, pero la orden queda atrasada. */
  const dueAlreadyPast = !!dueDate && !pastDue && dueDate < today;
  const ready = !!needs
    && (!needs.laboratory || !!laboratory)
    && (!needs.dueDate || (!!dueDate && !pastDue && !sentOnInvalid));

  const details: LabOrderMoveDetails = {
    laboratory,
    dueDate: needs?.dueDate ? dueDate : null,
    effectiveDate: needs?.dueDate && sentOn && sentOn < today ? sentOn : null,
  };
  return {
    laboratory, setLaboratory, dueDate, setDueDate, sentOn, setSentOn, minSentOn, sentOnInvalid,
    pastDue, dueAlreadyPast, ready, details,
  };
}

type MoveState = ReturnType<typeof useLabOrderMoveState>;

/** Campos del movimiento: laboratorio (si falta) y fecha de entrega con atajos. */
export function LabOrderMoveFields({ request, state, disabled = false }: {
  request: LabOrderMoveRequest;
  state: MoveState;
  disabled?: boolean;
}) {
  const t = useTranslations('LabOrdersPage.laboratoryDialog');
  const { needs } = request;
  const previousDuePassed = !!request.order.due_date && request.order.due_date < todayKey();
  const stageDays = request.stage.overdue_days;
  const shortcuts = Array.from(new Set([...DUE_SHORTCUTS, ...(stageDays && stageDays > 0 ? [stageDays] : [])]))
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {needs.laboratory ? (
        <div className="space-y-1.5" data-help-id="lab-orders.field.send-laboratory">
          <Label>{t('laboratory')}</Label>
          <LabSelector
            value={state.laboratory?.id ?? ''}
            selectedName={state.laboratory?.name}
            categoryIds={request.order.lab_category_ids}
            onValueChange={(_id, lab) => state.setLaboratory(lab ?? null)}
            disabled={disabled}
          />
          {/* Sin laboratorio no se puede confirmar: se dice en rojo, como al crear la orden. */}
          {state.laboratory ? (
            <p className="text-xs text-muted-foreground">{t('hint')}</p>
          ) : (
            <p role="alert" className="text-xs font-medium text-destructive">
              {t(needs.dueDate ? 'laboratoryMissingSend' : 'laboratoryMissing')}
            </p>
          )}
        </div>
      ) : request.order.laboratory_name && (
        <div className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('laboratory')}:</span>
          <span className="truncate font-medium">{request.order.laboratory_name}</span>
        </div>
      )}

      {needs.dueDate && <SentOnField state={state} disabled={disabled} />}

      {needs.dueDate && (
        <div className="space-y-1.5" data-help-id="lab-orders.field.send-due-date">
          <Label>{t('dueDate')}</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dueShortcuts')} data-help-id="lab-orders.section.due-shortcuts">
            {shortcuts.map((days) => {
              const key = addDaysKey(state.sentOn || todayKey(), days);
              const on = state.dueDate === key;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => state.setDueDate(key)}
                  disabled={disabled}
                  aria-pressed={on}
                  title={formatDisplayDate(key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                  )}
                >
                  {t('dueIn', { days })}
                </button>
              );
            })}
          </div>
          <DatePickerInput
            value={state.dueDate}
            onChange={state.setDueDate}
            disabled={disabled}
            // Sin disabledDays: con él, una fecha pasada escrita a mano no llega a onChange
            // y se mandaría la anterior. La validación es pastDue (confirmar deshabilitado).
            aria-invalid={state.pastDue}
          />
          {state.pastDue ? (
            <p className="text-xs font-medium text-destructive">{t('dueDatePast')}</p>
          ) : state.dueAlreadyPast ? (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t('dueDateAlreadyPast')}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {previousDuePassed && request.order.due_date
                ? t('dueDatePreviousPassed', { date: formatDisplayDate(request.order.due_date) })
                : t('dueDateHint')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "¿Cuándo se envió?": hoy por defecto; ayer u otro día si se está registrando tarde un envío
 * (script 176). Los plazos (días en la etapa, entrega propuesta, atraso) cuentan desde ese día.
 */
function SentOnField({ state, disabled }: { state: MoveState; disabled: boolean }) {
  const t = useTranslations('LabOrdersPage.laboratoryDialog');
  const today = todayKey();
  const yesterday = yesterdayKey();
  const canYesterday = !state.minSentOn || yesterday >= state.minSentOn;
  const [otherOpen, setOtherOpen] = React.useState(false);
  const isOther = otherOpen || (state.sentOn !== today && state.sentOn !== yesterday);
  const chip = (on: boolean) => cn(
    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
  );

  return (
    <div className="space-y-1.5" data-help-id="lab-orders.field.sent-on">
      <Label>{t('sentOn')}</Label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('sentOn')}>
        <button type="button" className={chip(!isOther && state.sentOn === today)} aria-pressed={!isOther && state.sentOn === today}
          disabled={disabled} onClick={() => { setOtherOpen(false); state.setSentOn(today); }}>
          {t('sentToday')}
        </button>
        {canYesterday && (
          <button type="button" className={chip(!isOther && state.sentOn === yesterday)} aria-pressed={!isOther && state.sentOn === yesterday}
            disabled={disabled} onClick={() => { setOtherOpen(false); state.setSentOn(yesterday); }}>
            {t('sentYesterday')}
          </button>
        )}
        <button type="button" className={chip(isOther)} aria-pressed={isOther}
          disabled={disabled} onClick={() => setOtherOpen(true)}>
          {t('sentOther')}
        </button>
      </div>
      {isOther && (
        <DatePickerInput
          value={state.sentOn}
          onChange={state.setSentOn}
          disabled={disabled}
          // Sin disabledDays (se tragaría la fecha escrita): la validación es sentOnInvalid.
          aria-invalid={state.sentOnInvalid}
        />
      )}
      {state.sentOnInvalid ? (
        <p className="text-xs font-medium text-destructive">
          {state.minSentOn ? t('sentOnInvalid', { date: formatDisplayDate(state.minSentOn) }) : t('sentOnFuture')}
        </p>
      ) : state.sentOn !== today && (
        <p className="text-xs text-muted-foreground">{t('sentOnHint')}</p>
      )}
    </div>
  );
}

export interface LabOrderMoveDialogProps {
  /** Pedido abierto; `null` lo cierra. */
  request: LabOrderMoveRequest | null;
  onCancel: () => void;
  /** Quien abrió el modal hace el cambio de etapa con estos datos. */
  onConfirm: (details: LabOrderMoveDetails) => void;
  /** Guardando con el modal abierto (detalle de la orden): bloquea campos y cierre. */
  isPending?: boolean;
}

/**
 * Antes de mover la orden (tablero, ficha del paciente, detalle): al enviarla al laboratorio, a
 * qué laboratorio va si no tiene y la fecha de entrega (obligatoria), ya propuestas para que
 * alcance con confirmar. Para otros movimientos sin laboratorio, solo el laboratorio.
 */
export function LabOrderMoveDialog({ request, onCancel, onConfirm, isPending = false }: LabOrderMoveDialogProps) {
  const t = useTranslations('LabOrdersPage.laboratoryDialog');
  const state = useLabOrderMoveState(request);
  const isSend = !!request?.needs.dueDate;

  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open && !isPending) onCancel(); }}>
      <DialogContent className="sm:max-w-md" data-help-id="lab-orders.section.choose-laboratory">
        <DialogHeader>
          <DialogTitle>{isSend ? t('sendTitle') : t('title')}</DialogTitle>
          <DialogDescription>
            {request
              ? t(isSend ? 'sendDescription' : 'description', { id: request.order.id, patient: request.order.patient_name })
              : ''}
          </DialogDescription>
        </DialogHeader>
        {request && (
          <DialogBody className="space-y-4 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t('movingTo')}</span>
              <LabStageBadge name={request.stage.name} color={request.stage.color} />
            </div>
            <LabOrderMoveFields request={request} state={state} disabled={isPending} />
          </DialogBody>
        )}
        <DialogFooter>
          <DialogCancelButton disabled={isPending}>{t('cancel')}</DialogCancelButton>
          <Button
            type="button"
            data-help-id="lab-orders.btn.confirm-move"
            className="gap-1.5"
            disabled={!state.ready}
            loading={isPending}
            onClick={() => { if (state.ready && !isPending) onConfirm(state.details); }}
          >
            {request && <span className="truncate">{t('confirm', { stage: request.stage.name })}</span>}
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
