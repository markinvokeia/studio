'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';

import { emitLabOrderChanged } from '@/lib/lab-orders-events';
import { useVoiceLabOrderDraft, voiceDraftEvents } from '@/lib/voice/lab-order-draft-bridge';

/** El asistente que abre la voz ("creá una orden…" o "editá la orden 45"), en cualquier pantalla. */
export function VoiceLabOrderDialogHost() {
  const t = useTranslations('VoiceCommands.labOrders');
  const { key, draft, order, open, submitSignal } = useVoiceLabOrderDraft();
  if (!draft && !order) return null;
  return (
    <LabOrderFormDialog
      key={key}
      open={open}
      onOpenChange={(next) => { if (!next) voiceDraftEvents.closed(); }}
      order={order}
      draft={order ? null : draft}
      description={order ? undefined : t('createDescription')}
      submitSignal={submitSignal}
      onSubmitFailed={voiceDraftEvents.failed}
      voiceControl={voiceDraftEvents.control}
      onSaved={(order) => {
        emitLabOrderChanged(order);
        voiceDraftEvents.saved(order);
      }}
    />
  );
}
