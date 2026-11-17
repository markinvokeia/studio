'use client';

import * as React from 'react';
import { FlaskConical, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import type { LabOrderDraft } from '@/components/lab-orders/lab-order-form-dialog';
import { useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';
import { LabSelector } from '@/components/lab-orders/lab-selector';

import { useAsyncAction } from '@/hooks/use-async-action';
import { REQUEST_TIMEOUT_MS, isTimeoutError } from '@/services/api';
import { saveLabOrder, searchLaboratories } from '@/services/lab-orders';

import type { LabOrder } from '@/lib/types';

export interface LabOrderQuickCreateProps {
  /** Borrador propuesto (servicios de la sesión); null cierra la tarjeta. */
  draft: LabOrderDraft | null;
  patient: { id: string; name: string };
  onClose: () => void;
  /** "Editar detalles": sigue en el formulario completo con lo elegido acá. */
  onEdit: (draft: LabOrderDraft) => void;
  onSaved: (order: LabOrder) => void;
}

/**
 * Al guardar una sesión con trabajos de laboratorio: en vez del formulario completo, una
 * confirmación con todo ya cargado (trabajos, piezas, doctor y, si hay uno solo posible, el
 * laboratorio). Un clic crea la orden; "Editar detalles" abre el formulario; "Ahora no" la descarta.
 */
export function LabOrderQuickCreateDialog({ draft, patient, onClose, onEdit, onSaved }: LabOrderQuickCreateProps) {
  const t = useTranslations('LabOrdersPage.quickCreate');
  const tPage = useTranslations('LabOrdersPage');
  const errorText = useLabOrderErrorText();
  const [laboratory, setLaboratory] = React.useState<{ id: string; name: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const touchedRef = React.useRef(false);

  const items = React.useMemo(() => draft?.items ?? [], [draft]);
  const categoryIds = React.useMemo(
    () => Array.from(new Set(items.map((i) => i.lab_category_id).filter((id): id is string => !!id))),
    [items],
  );

  // Cada borrador arranca limpio y, si hay un solo laboratorio posible, ya elegido.
  React.useEffect(() => {
    touchedRef.current = false;
    setLaboratory(draft?.laboratory ?? null);
    setError(null);
    if (!draft || draft.laboratory || categoryIds.length > 1) return;
    const controller = new AbortController();
    searchLaboratories({ categoryId: categoryIds[0] ?? null, limit: 2 }, { signal: controller.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation })
      .then((labs) => {
        if (!controller.signal.aborted && !touchedRef.current && labs.length === 1) setLaboratory({ id: labs[0].id, name: labs[0].name });
      })
      .catch(() => { /* sin sugerencia */ });
    return () => controller.abort();
  }, [draft, categoryIds]);

  const save = useAsyncAction(
    () => saveLabOrder({
      patient_id: patient.id,
      doctor_id: draft?.doctor?.id || null,
      laboratory_id: laboratory?.id ?? null,
      work_description: null,
      teeth: [],
      notes: draft?.notes?.trim() || null,
      is_urgent: false,
      items: items.map((item) => ({
        service_id: Number(item.service_id),
        quantity: Math.min(99, Math.max(1, Math.round(item.quantity) || 1)),
        teeth: item.teeth,
        notes: null,
      })),
    }, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
    {
      onSuccess: (order) => {
        onSaved(order);
        onClose();
      },
      onError: (err) => setError(isTimeoutError(err) ? tPage('form.timeoutMaybeSaved') : errorText(err)),
      showErrorToast: false,
    },
  );

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-help-id="workspace.section.lab-order-quick">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description', { patient: patient.name })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 px-6 py-4">
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.service_id} className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <p className="break-words font-medium">
                    {item.service_name}
                    {item.quantity > 1 && <span className="font-normal text-muted-foreground"> ×{item.quantity}</span>}
                  </p>
                  {item.teeth.length > 0 && (
                    <p className="text-xs text-muted-foreground">{tPage('teethShort', { teeth: item.teeth.join(', ') })}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {draft?.doctor?.name && (
            <p className="text-sm">
              <span className="text-muted-foreground">{tPage('form.doctor')}: </span>
              <span className="font-medium">{draft.doctor.name}</span>
            </p>
          )}

          <div className="space-y-1.5" data-help-id="workspace.field.lab-order-laboratory">
            <Label>{tPage('form.laboratory')}</Label>
            <LabSelector
              value={laboratory?.id ?? ''}
              selectedName={laboratory?.name}
              categoryIds={categoryIds}
              clearable
              onValueChange={(id, lab) => {
                touchedRef.current = true;
                setLaboratory(id && lab ? { id, name: lab.name } : null);
              }}
              triggerText={t('labLater')}
              disabled={save.isPending}
            />
            <p className="text-xs text-muted-foreground">{t('labHint')}</p>
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" data-help-id="workspace.btn.lab-order-skip" onClick={onClose} disabled={save.isPending}>
            {t('skip')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            data-help-id="workspace.btn.lab-order-edit"
            disabled={save.isPending || !draft}
            onClick={() => { if (draft) onEdit({ ...draft, laboratory }); }}
          >
            <Pencil className="h-4 w-4" />
            {t('edit')}
          </Button>
          <Button type="button" data-help-id="workspace.btn.lab-order-create" loading={save.isPending} disabled={items.length === 0} onClick={() => void save.run()}>
            {t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
