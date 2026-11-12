'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { LabStageBadge } from '@/components/lab-orders/lab-order-shared';
import { LabSelector } from '@/components/lab-orders/lab-selector';

import type { LabOrder, LabStage, LabStageKind, Laboratory } from '@/lib/types';

/**
 * Sin laboratorio, una orden solo puede ir a una etapa final (entregada, cancelada…).
 * Para cualquier otra hay que decir a qué laboratorio se envía (script 170).
 */
export function labOrderNeedsLaboratory(
  order: Pick<LabOrder, 'laboratory_id'>,
  target: Pick<LabStage, 'kind'> | { kind: LabStageKind } | undefined | null,
): boolean {
  return !order.laboratory_id && !!target && target.kind !== 'final';
}

export interface LabOrderLaboratoryRequest {
  order: Pick<LabOrder, 'id' | 'patient_name' | 'lab_category_ids'>;
  stage: Pick<LabStage, 'id' | 'name' | 'color'>;
}

export interface LabOrderLaboratoryDialogProps {
  /** Pedido abierto; `null` lo cierra. */
  request: LabOrderLaboratoryRequest | null;
  onCancel: () => void;
  /** Laboratorio elegido: quien abrió el modal hace el cambio de etapa con él. */
  onConfirm: (laboratory: Laboratory) => void;
}

/** "¿A qué laboratorio se envía?" al mover a una etapa no final una orden sin laboratorio. */
export function LabOrderLaboratoryDialog({ request, onCancel, onConfirm }: LabOrderLaboratoryDialogProps) {
  const t = useTranslations('LabOrdersPage.laboratoryDialog');
  const [laboratory, setLaboratory] = React.useState<Laboratory | null>(null);

  // Cada pedido arranca vacío.
  React.useEffect(() => { setLaboratory(null); }, [request]);

  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md" data-help-id="lab-orders.section.choose-laboratory">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {request ? t('description', { id: request.order.id, patient: request.order.patient_name }) : ''}
          </DialogDescription>
        </DialogHeader>
        {request && (
          <DialogBody className="space-y-4 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t('movingTo')}</span>
              <LabStageBadge name={request.stage.name} color={request.stage.color} />
            </div>
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
          </DialogBody>
        )}
        <DialogFooter>
          <DialogCancelButton>{t('cancel')}</DialogCancelButton>
          <Button
            type="button"
            disabled={!laboratory}
            onClick={() => { if (laboratory) onConfirm(laboratory); }}
          >
            {request ? t('confirm', { stage: request.stage.name }) : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
