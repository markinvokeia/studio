'use client';

import * as React from 'react';
import { FlaskConical, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { Can } from '@/components/auth/Can';
import { LabOrderDetailSheet } from '@/components/lab-orders/lab-order-detail-sheet';
import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';
import { LabOrderDaysInStage, LabStageBadge, labOrderWork, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';

import { useLabOrdersLive } from '@/hooks/use-lab-orders-live';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { searchLabOrders } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrder, LabStage } from '@/lib/types';

interface PatientLabOrdersTabProps {
  patientId: string;
  patientName: string;
  readOnly?: boolean;
}

/** Ficha del paciente → Clínica → Laboratorio: sus órdenes y la etapa de cada una. */
export function PatientLabOrdersTab({ patientId, patientName, readOnly = false }: PatientLabOrdersTabProps) {
  const t = useTranslations('LabOrdersPage');
  const { toast } = useToast();
  const errorText = useLabOrderErrorText();
  const [orders, setOrders] = React.useState<LabOrder[] | null>(null);
  const [stages, setStages] = React.useState<LabStage[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [showFinished, setShowFinished] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchLabStages({ signal: controller.signal })
      .then((data) => setStages(data.filter((s) => s.is_active)))
      .catch(() => { /* sin etapas solo falta "Mover a…"; la lista igual se muestra */ });
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    searchLabOrders({ patient_id: patientId, pending_only: !showFinished, limit: 200 }, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setOrders(result.items); })
      .catch((error) => { if (!isAbortError(error)) setLoadError(errorText(error)); });
    return () => controller.abort();
  }, [patientId, showFinished, reloadKey, errorText]);

  const reload = () => setReloadKey((k) => k + 1);

  // Otro usuario creó, movió o editó una orden: se relee (la lista es corta).
  useLabOrdersLive(reload);

  return (
    <div data-help-id="patients.section.lab-orders" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={showFinished} onCheckedChange={setShowFinished} />
          {t('patientTab.showFinished')}
        </label>
        {!readOnly && (
          <Can permission={LAB_ORDERS_PERMISSIONS.CREATE}>
            <Button data-help-id="patients.btn.new-lab-order" size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Button>
          </Can>
        )}
      </div>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={reload}>{t('retry')}</Button>
        </div>
      )}

      {orders === null && !loadError && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}

      {orders !== null && orders.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          <FlaskConical className="h-6 w-6" />
          {showFinished ? t('patientTab.empty') : t('patientTab.emptyPending')}
        </div>
      )}

      {orders !== null && orders.length > 0 && (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => setSelectedId(order.id)}
                className={cn(
                  'w-full rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                  order.is_overdue ? 'border-destructive/40' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{labOrderWork(order)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[order.laboratory_name, order.teeth.length > 0 ? t('teethShort', { teeth: order.teeth.join(', ') }) : null]
                        .filter(Boolean).join(' · ') || (order.due_date ? null : '—')}
                      {order.due_date && (
                        <span className={cn(order.is_past_due && 'font-semibold text-destructive')}>
                          {order.laboratory_name || order.teeth.length > 0 ? ' · ' : ''}
                          {t('dueShort', { date: formatDisplayDate(order.due_date) })}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">#{order.id}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <LabStageBadge name={order.stage_name} color={order.stage_color} />
                  {order.is_pending && <LabOrderDaysInStage order={order} />}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

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
        onClose={() => setSelectedId(null)}
        onChanged={() => reload()}
      />
    </div>
  );
}
