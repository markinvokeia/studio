'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';

import { emitLabOrderChanged } from '@/lib/lab-orders-events';
import { useVoiceLabOrderDraft, voiceDraftEvents } from '@/lib/voice/lab-order-draft-bridge';

/** El asistente de alta que abre "creá una orden…" por voz, en cualquier pantalla. */
export function VoiceLabOrderDialogHost() {
  const t = useTranslations('VoiceCommands.labOrders');
  const { key, draft, open, submitSignal } = useVoiceLabOrderDraft();
  if (!draft) return null;
  return (
    <LabOrderFormDialog
      key={key}
      open={open}
      onOpenChange={(next) => { if (!next) voiceDraftEvents.closed(); }}
      draft={draft}
      description={t('createDescription')}
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
