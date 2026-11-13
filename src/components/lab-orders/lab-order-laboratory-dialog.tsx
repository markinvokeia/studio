'use client';

import * as React from 'react';
import { format, startOfToday } from 'date-fns';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { LabStageBadge } from '@/components/lab-orders/lab-order-shared';
import { LabSelector } from '@/components/lab-orders/lab-selector';

import { formatDisplayDate } from '@/lib/utils';

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
  stage: Pick<LabStage, 'id' | 'name' | 'color'>;
  needs: LabOrderMoveNeeds;
}

/** Lo elegido en el modal: va en el mismo cambio de etapa. */
export interface LabOrderMoveDetails {
  laboratory: Laboratory | null;
  /** 'YYYY-MM-DD' (fecha local). */
  dueDate: string | null;
}

export interface LabOrderMoveDialogProps {
  /** Pedido abierto; `null` lo cierra. */
  request: LabOrderMoveRequest | null;
  onCancel: () => void;
  /** Quien abrió el modal hace el cambio de etapa con estos datos. */
  onConfirm: (details: LabOrderMoveDetails) => void;
}

const todayKey = () => format(startOfToday(), 'yyyy-MM-dd');

/**
 * Antes de mover la orden: al enviarla al laboratorio (salir de la etapa inicial), a qué
 * laboratorio va si no tiene y la fecha de entrega que prometió (obligatoria). Para otros
 * movimientos sin laboratorio, solo el laboratorio.
 */
export function LabOrderMoveDialog({ request, onCancel, onConfirm }: LabOrderMoveDialogProps) {
  const t = useTranslations('LabOrdersPage.laboratoryDialog');
  const [laboratory, setLaboratory] = React.useState<Laboratory | null>(null);
  const [dueDate, setDueDate] = React.useState('');

  // Cada pedido arranca vacío; la fecha que ya tenga la orden se ofrece si todavía no pasó.
  React.useEffect(() => {
    setLaboratory(null);
    const saved = request?.order.due_date ?? '';
    setDueDate(saved && saved >= todayKey() ? saved : '');
  }, [request]);

  const needs = request?.needs;
  const isSend = !!needs?.dueDate;
  const pastDue = !!dueDate && dueDate < todayKey();
  const previousDuePassed = !!request?.order.due_date && request.order.due_date < todayKey();
  const ready = !!needs
    && (!needs.laboratory || !!laboratory)
    && (!needs.dueDate || (!!dueDate && !pastDue));

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
        {request && needs && (
          <DialogBody className="space-y-4 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t('movingTo')}</span>
              <LabStageBadge name={request.stage.name} color={request.stage.color} />
            </div>

            {needs.laboratory ? (
              <div className="space-y-1.5">
                <Label>{t('laboratory')}</Label>
                <LabSelector
                  value={laboratory?.id ?? ''}
                  selectedName={laboratory?.name}
                  categoryIds={request.order.lab_category_ids}
                  onValueChange={(_id, lab) => setLaboratory(lab ?? null)}
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
                <DatePickerInput
                  value={dueDate}
                  onChange={setDueDate}
                  // Sin disabledDays: con él, una fecha pasada escrita a mano no llega a onChange
                  // y el modal mandaría la anterior. La validación es pastDue (botón deshabilitado).
                  aria-invalid={pastDue}
                />
                {pastDue ? (
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
          </DialogBody>
        )}
        <DialogFooter>
          <DialogCancelButton>{t('cancel')}</DialogCancelButton>
          <Button
            type="button"
            disabled={!ready}
            onClick={() => { if (ready) onConfirm({ laboratory, dueDate: needs?.dueDate ? dueDate : null }); }}
          >
            {request ? t('confirm', { stage: request.stage.name }) : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
