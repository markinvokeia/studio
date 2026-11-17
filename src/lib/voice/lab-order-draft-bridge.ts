'use client';

import { create } from 'zustand';

import type { LabOrderDraft } from '@/components/lab-orders/lab-order-form-dialog';
import type { LabOrder } from '@/lib/types';

/**
 * Puente entre el comando "creá una orden…" (un módulo, sin React) y el asistente de alta
 * (LabOrderFormDialog, montado por VoiceLabOrderDialogHost). El comando abre el asistente
 * completo en Revisar y, si se confirma por voz, pulsa "Crear" y espera el resultado.
 */

export class VoiceDraftSubmitError extends Error {
  /** null: faltan datos del formulario (se ven marcados en el asistente). */
  constructor(readonly serverMessage: string | null) {
    super(serverMessage ?? 'invalid form');
    this.name = 'VoiceDraftSubmitError';
  }
}

interface PendingSubmit {
  resolve: (order: LabOrder) => void;
  reject: (error: unknown) => void;
}

interface VoiceLabOrderDraftState {
  /** Cambia en cada apertura, así el diálogo se vuelve a inicializar. */
  key: number;
  draft: LabOrderDraft | null;
  open: boolean;
  submitSignal: number;
}

export const useVoiceLabOrderDraft = create<VoiceLabOrderDraftState>(() => ({ key: 0, draft: null, open: false, submitSignal: 0 }));

let pending: PendingSubmit | null = null;
/** Quién espera saber si la persona cerró el asistente a mano. */
let onClosed: (() => void) | null = null;

/** Abre el asistente con lo dictado. `whenClosed` corre si la persona lo cierra o lo crea a mano. */
export function openVoiceLabOrderDraft(draft: LabOrderDraft, whenClosed?: () => void) {
  pending?.reject(new DOMException('Replaced', 'AbortError'));
  pending = null;
  onClosed = whenClosed ?? null;
  useVoiceLabOrderDraft.setState((s) => ({ key: s.key + 1, draft, open: true }));
}

/** Deja de avisar el cierre (el comando terminó y el asistente queda en manos de la persona). */
export function releaseVoiceLabOrderDraft() {
  onClosed = null;
}

/** "Sí" por voz: pulsa Crear y espera la orden guardada (o el error). */
export function submitVoiceLabOrderDraft(): Promise<LabOrder> {
  if (!useVoiceLabOrderDraft.getState().open) return Promise.reject(new DOMException('Closed', 'AbortError'));
  return new Promise<LabOrder>((resolve, reject) => {
    pending = { resolve, reject };
    useVoiceLabOrderDraft.setState((s) => ({ submitSignal: s.submitSignal + 1 }));
  });
}

/** Lo llama el host. */
export const voiceDraftEvents = {
  saved(order: LabOrder) {
    const waiting = pending;
    const notify = onClosed;
    pending = null;
    onClosed = null;
    useVoiceLabOrderDraft.setState({ open: false });
    // Creada con el botón mientras el comando todavía preguntaba: el comando ya no tiene nada que hacer.
    if (waiting) waiting.resolve(order);
    else notify?.();
  },
  failed(message: string | null) {
    const waiting = pending;
    pending = null;
    waiting?.reject(new VoiceDraftSubmitError(message));
  },
  closed() {
    useVoiceLabOrderDraft.setState({ open: false });
    const waiting = pending;
    pending = null;
    waiting?.reject(new DOMException('Closed', 'AbortError'));
    const notify = onClosed;
    onClosed = null;
    notify?.();
  },
};
