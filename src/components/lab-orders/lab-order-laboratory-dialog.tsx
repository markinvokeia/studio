'use client';

import * as React from 'react';
import { addDays, format, startOfToday } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { LabStageBadge } from '@/components/lab-orders/lab-order-shared';
import { LabSelector } from '@/components/lab-orders/lab-selector';

import { cn, formatDisplayDate } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { searchLaboratories } from '@/services/lab-orders';

import type { LabOrder, LabOrdersErrorCode, LabStage, LabStageKind, Laboratory } from '@/lib/types';

/** Qué hay que pedir antes de mover la orden a una etapa. */
export interface LabOrderMoveNeeds {
  /** Sin laboratorio, una orden solo puede ir a una etapa final (script 170). */
  laboratory: boolean;
  /** Enviar (salir de la etapa inicial hacia una no final) fija la fecha de entrega (script 172). */
  dueDate: boolean;
}

/**
 * Lo que el modal tiene que pedir para mover `order` a `target`, o null si se mueve directo.
 * `errorCode`: el backend lo pidió aunque los datos locales digan otra cosa (etapas cambiadas).
 */
export function labOrderMoveNeeds(
  order: Pick<LabOrder, 'laboratory_id' | 'stage_kind'>,
  target: Pick<LabStage, 'kind'> | { kind: LabStageKind } | undefined | null,
  errorCode?: LabOrdersErrorCode,
): LabOrderMoveNeeds | null {
  if (!target) return null;
  const laboratory = errorCode === 'LABORATORY_REQUIRED' || (!order.laboratory_id && target.kind !== 'final');
  const dueDate = errorCode === 'DUE_DATE_REQUIRED'
    || (order.stage_kind === 'initial' && target.kind !== 'initial' && target.kind !== 'final');
  return laboratory || dueDate ? { laboratory, dueDate } : null;
}

export interface LabOrderMoveRequest {
  order: Pick<LabOrder, 'id' | 'patient_name' | 'lab_category_ids' | 'laboratory_name' | 'due_date'>;
  /** `overdue_days` de la etapa destino: propone la fecha de entrega (hoy + ese plazo). */
  stage: Pick<LabStage, 'id' | 'name' | 'color'> & { overdue_days?: number | null };
  needs: LabOrderMoveNeeds;
}

/** Lo elegido en el modal: va en el mismo cambio de etapa. */
export interface LabOrderMoveDetails {
  laboratory: Laboratory | null;
  /** 'YYYY-MM-DD' (fecha local). */
  dueDate: string | null;
}

const todayKey = () => format(startOfToday(), 'yyyy-MM-dd');
const inDaysKey = (days: number) => format(addDays(startOfToday(), days), 'yyyy-MM-dd');

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
  const [dueDate, setDueDate] = React.useState('');
  /** La persona ya eligió: la sugerencia que llegue después no la pisa. */
  const touchedLabRef = React.useRef(false);

  React.useEffect(() => {
    touchedLabRef.current = false;
    setLaboratoryState(null);
    const saved = request?.order.due_date ?? '';
    const stageDays = request?.stage.overdue_days;
    setDueDate(
      saved && saved >= todayKey() ? saved
        : request?.needs.dueDate && stageDays && stageDays > 0 ? inDaysKey(stageDays)
          : '',
    );
  }, [request]);

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

  const needs = request?.needs;
  const pastDue = !!dueDate && dueDate < todayKey();
  const ready = !!needs
    && (!needs.laboratory || !!laboratory)
    && (!needs.dueDate || (!!dueDate && !pastDue));

  const details: LabOrderMoveDetails = { laboratory, dueDate: needs?.dueDate ? dueDate : null };
  return { laboratory, setLaboratory, dueDate, setDueDate, pastDue, ready, details };
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
          <p className="text-xs text-muted-foreground">{t('hint')}</p>
        </div>
      ) : request.order.laboratory_name && (
        <div className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('laboratory')}:</span>
          <span className="truncate font-medium">{request.order.laboratory_name}</span>
        </div>
      )}

      {needs.dueDate && (
        <div className="space-y-1.5" data-help-id="lab-orders.field.send-due-date">
          <Label>{t('dueDate')}</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dueShortcuts')} data-help-id="lab-orders.section.due-shortcuts">
            {shortcuts.map((days) => {
              const key = inDaysKey(days);
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

export interface LabOrderMoveDialogProps {
  /** Pedido abierto; `null` lo cierra. */
  request: LabOrderMoveRequest | null;
  onCancel: () => void;
  /** Quien abrió el modal hace el cambio de etapa con estos datos. */
  onConfirm: (details: LabOrderMoveDetails) => void;
}

/**
 * Antes de mover la orden (tablero, ficha del paciente): al enviarla al laboratorio, a qué
 * laboratorio va si no tiene y la fecha de entrega (obligatoria). Para otros movimientos sin
 * laboratorio, solo el laboratorio. En el detalle de la orden lo mismo va en línea.
 */
export function LabOrderMoveDialog({ request, onCancel, onConfirm }: LabOrderMoveDialogProps) {
  const t = useTranslations('LabOrdersPage.laboratoryDialog');
  const state = useLabOrderMoveState(request);
  const isSend = !!request?.needs.dueDate;

  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
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
            <LabOrderMoveFields request={request} state={state} />
          </DialogBody>
        )}
        <DialogFooter>
          <DialogCancelButton>{t('cancel')}</DialogCancelButton>
          <Button
            type="button"
            data-help-id="lab-orders.btn.confirm-move"
            disabled={!state.ready}
            onClick={() => { if (state.ready) onConfirm(state.details); }}
          >
            {request ? t('confirm', { stage: request.stage.name }) : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lo mismo que el modal, dentro del detalle de la orden: se completa ahí mismo, con la fecha y
 * (si hay uno solo) el laboratorio ya propuestos, así enviarla suele ser un solo clic.
 */
export function LabOrderMoveInline({ request, onCancel, onConfirm, isPending }: {
  request: LabOrderMoveRequest;
  onCancel: () => void;
  onConfirm: (details: LabOrderMoveDetails) => void;
  isPending: boolean;
}) {
  const t = useTranslations('LabOrdersPage.laboratoryDialog');
  const state = useLabOrderMoveState(request);
  const isSend = request.needs.dueDate;

  return (
    <div data-help-id="lab-orders.section.choose-laboratory" className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">{isSend ? t('sendTitle') : t('title')}</p>
        <p className="text-xs text-muted-foreground">{isSend ? t('inlineSendHint') : t('inlineHint')}</p>
      </div>
      <LabOrderMoveFields request={request} state={state} disabled={isPending} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>{t('cancel')}</Button>
        <Button
          type="button"
          size="sm"
          data-help-id="lab-orders.btn.confirm-move"
          className="gap-1.5"
          disabled={!state.ready}
          loading={isPending}
          onClick={() => { if (state.ready) onConfirm(state.details); }}
        >
          <span className="truncate">{t('confirm', { stage: request.stage.name })}</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
