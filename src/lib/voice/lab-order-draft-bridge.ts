'use client';

import { create } from 'zustand';

import type { LabOrderDraft, LabOrderDraftControl, LabOrderDraftPatch } from '@/components/lab-orders/lab-order-form-dialog';
import type { LabOrder } from '@/lib/types';

/**
 * Puente entre los comandos "creá una orden…" / "editá la orden 45" (módulos, sin React) y el
 * asistente de órdenes (LabOrderFormDialog, montado por VoiceLabOrderDialogHost). El comando abre
 * el asistente completo en Revisar —vacío de alta con lo dictado, o la orden existente—; mientras
 * pregunta "¿La creo?" / "¿Guardo los cambios?" puede leerlo y corregirlo (lo que se diga en vez de
 * "sí"), y si se confirma pulsa "Crear" o "Guardar cambios" y espera el resultado.
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
  /** Edición: la orden que se abrió (el diálogo arranca con sus datos e ignora `draft`). */
  order: LabOrder | null;
  open: boolean;
  submitSignal: number;
}

export const useVoiceLabOrderDraft = create<VoiceLabOrderDraftState>(() => ({ key: 0, draft: null, order: null, open: false, submitSignal: 0 }));

let pending: PendingSubmit | null = null;
/** El asistente abierto (lo registra el diálogo al montarse). */
let control: LabOrderDraftControl | null = null;
/** Quién quiere enterarse de los cambios del formulario (la tarjeta mientras pregunta). */
const listeners = new Set<() => void>();
let unwatchControl: (() => void) | null = null;
const notifyChange = () => listeners.forEach((listener) => listener());
/** Quién espera saber si la persona cerró el asistente a mano. */
let onClosed: (() => void) | null = null;
/** Quién espera a que el diálogo se monte (para leer la orden que se editó). */
let readyWaiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

function rejectReadyWaiters(reason: string) {
  const waiters = readyWaiters;
  readyWaiters = [];
  waiters.forEach((w) => w.reject(new DOMException(reason, 'AbortError')));
}

function openDialog(draft: LabOrderDraft, order: LabOrder | null, whenClosed?: () => void) {
  pending?.reject(new DOMException('Replaced', 'AbortError'));
  pending = null;
  rejectReadyWaiters('Replaced');
  // El acceso del diálogo anterior ya no vale: se espera el del que se monta ahora.
  unwatchControl?.();
  unwatchControl = null;
  control = null;
  onClosed = whenClosed ?? null;
  useVoiceLabOrderDraft.setState((s) => ({ key: s.key + 1, draft, order, open: true }));
}

/** Abre el asistente de alta con lo dictado. `whenClosed` corre si la persona lo cierra o lo crea a mano. */
export function openVoiceLabOrderDraft(draft: LabOrderDraft, whenClosed?: () => void) {
  openDialog(draft, null, whenClosed);
}

/** Abre la orden existente para editarla (en Revisar). `whenClosed` corre si la persona la cierra o la guarda a mano. */
export function openVoiceLabOrderEdit(order: LabOrder, whenClosed?: () => void) {
  openDialog({}, order, whenClosed);
}

/**
 * Espera a que el diálogo abierto se monte y registre su acceso (en la edición, hasta entonces no
 * se sabe cómo quedó el formulario). Se corta si se cierra o se reemplaza.
 */
export function waitForVoiceLabOrderDialog(signal?: AbortSignal): Promise<void> {
  if (!useVoiceLabOrderDraft.getState().open) return Promise.reject(new DOMException('Closed', 'AbortError'));
  if (control) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const waiter = {
      resolve: () => { signal?.removeEventListener('abort', onAbort); resolve(); },
      reject: (error: unknown) => { signal?.removeEventListener('abort', onAbort); reject(error); },
    };
    function onAbort() {
      readyWaiters = readyWaiters.filter((w) => w !== waiter);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    readyWaiters.push(waiter);
  });
}

/** Deja de avisar el cierre (el comando terminó y el asistente queda en manos de la persona). */
export function releaseVoiceLabOrderDraft() {
  onClosed = null;
}

/** Cómo está el asistente ahora (con lo cambiado a mano), o null si ya no está abierto. */
export function readVoiceLabOrderDraft(): LabOrderDraft | null {
  const { open, draft, order } = useVoiceLabOrderDraft.getState();
  if (!open) return null;
  // Recién abierto, el diálogo todavía no se montó: el alta está tal cual se abrió (la edición
  // no se puede leer todavía: ver waitForVoiceLabOrderDialog).
  if (control) return control.read();
  return order ? null : draft;
}

/** Corrige el asistente abierto; false si ya no está abierto. */
export function applyVoiceLabOrderDraft(patch: LabOrderDraftPatch): boolean {
  if (!useVoiceLabOrderDraft.getState().open || !control) return false;
  control.apply(patch);
  return true;
}

/**
 * Avisa cada cambio del alta abierta (a mano o por voz). Se puede llamar antes de que el diálogo
 * se monte: se engancha cuando se registra. Devuelve cómo dejar de escuchar.
 */
export function watchVoiceLabOrderDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** "Sí" por voz: pulsa Crear / Guardar cambios y espera la orden guardada (o el error). */
export function submitVoiceLabOrderDraft(): Promise<LabOrder> {
  if (!useVoiceLabOrderDraft.getState().open) return Promise.reject(new DOMException('Closed', 'AbortError'));
  return new Promise<LabOrder>((resolve, reject) => {
    pending = { resolve, reject };
    useVoiceLabOrderDraft.setState((s) => ({ submitSignal: s.submitSignal + 1 }));
  });
}

/** Lo llama el host. */
export const voiceDraftEvents = {
  control(next: LabOrderDraftControl | null) {
    unwatchControl?.();
    unwatchControl = null;
    control = next;
    if (!next) return;
    unwatchControl = next.subscribe(notifyChange);
    const waiters = readyWaiters;
    readyWaiters = [];
    waiters.forEach((w) => w.resolve());
    // Al montarse puede haber completado algo solo (el doctor): que se vea.
    notifyChange();
  },
  saved(order: LabOrder) {
    const waiting = pending;
    const notify = onClosed;
    pending = null;
    onClosed = null;
    useVoiceLabOrderDraft.setState({ open: false });
    rejectReadyWaiters('Closed');
    // Creada (o guardada) con el botón mientras el comando todavía preguntaba: el comando ya no tiene nada que hacer.
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
    rejectReadyWaiters('Closed');
    const waiting = pending;
    pending = null;
    waiting?.reject(new DOMException('Closed', 'AbortError'));
    const notify = onClosed;
    onClosed = null;
    notify?.();
  },
};
