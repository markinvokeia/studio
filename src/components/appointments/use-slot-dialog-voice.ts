'use client';

import React from 'react';

import type { SlotDialogVoiceControl, SlotDialogVoiceStatus } from '@/lib/voice/dialog-voice';

/**
 * Voz en los diálogos "Bloquear / Habilitar horario": aplica los pedidos numerados (horas,
 * motivo) una sola vez, aprieta Confirmar cuando el diálogo terminó de revisar y el botón está
 * habilitado, y avisa el estado en cada cambio para que la voz sepa qué decir.
 */
export function useSlotDialogVoice(
  control: SlotDialogVoiceControl | null | undefined,
  status: SlotDialogVoiceStatus | null,
  { apply, submit, onStatus }: {
    apply: (control: SlotDialogVoiceControl) => void;
    submit: () => void;
    onStatus?: (status: SlotDialogVoiceStatus | null) => void;
  },
) {
  const lastSeq = React.useRef(0);
  const pendingSubmit = React.useRef(false);

  React.useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);

  React.useEffect(() => () => onStatus?.(null), [onStatus]);

  React.useEffect(() => {
    if (!control || control.seq === lastSeq.current) return;
    lastSeq.current = control.seq;
    apply(control);
    if (control.submit) pendingSubmit.current = true;
  }, [control, apply]);

  // Confirmar espera a que se revisen las citas de la franja (el botón también lo hace).
  React.useEffect(() => {
    if (!pendingSubmit.current || !status || status.checking || status.saving) return;
    pendingSubmit.current = false;
    if (status.canSubmit) submit();
  }, [control, status, submit]);
}
