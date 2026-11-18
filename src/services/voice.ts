import api from '@/services/api';

import { API_ROUTES } from '@/constants/routes';
import type { VoiceAiContext, VoiceAiDraftEdit, VoiceAiIntent, VoiceAiItem, VoiceAiListFilter, VoiceAiResult } from '@/lib/types';

/** La IA tarda unos segundos; más que esto y se avisa que no se pudo. */
const VOICE_AI_TIMEOUT_MS = 25_000;

const INTENTS: VoiceAiIntent[] = [
  'lab_order.move', 'lab_order.create', 'lab_order.open', 'lab_order.update', 'lab_order.status', 'lab_order.list',
  'lab_order.draft_edit', 'unknown',
];
const MOVE_KINDS = ['send', 'received', 'complete', 'cancel', 'next'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface VoiceInterpretPayload {
  text: string;
  locale: string;
  /** Fecha local ('YYYY-MM-DD') y día de la semana: "ayer", "el viernes" se resuelven con esto. */
  today: string;
  weekday: string;
  timezone: string;
  route: string;
  context: Partial<VoiceAiContext>;
}

const str = (value: unknown, max: number): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
};

/** Piezas FDI válidas (permanentes 11–48, temporales 51–85). */
const teeth = (value: unknown): number[] => (Array.isArray(value) ? value : [])
  .map(Number)
  .filter((n) => Number.isInteger(n) && n % 10 >= 1 && ((n >= 11 && n <= 48 && n % 10 <= 8) || (n >= 51 && n <= 85 && n % 10 <= 5)))
  .filter((n, i, all) => all.indexOf(n) === i)
  .slice(0, 32);

function listFilter(value: unknown): VoiceAiListFilter | null {
  if (!value || typeof value !== 'object') return null;
  const f = value as Record<string, unknown>;
  return {
    overdue: f.overdue === true,
    urgent: f.urgent === true,
    due_today: f.due_today === true,
    view: f.view === 'list' || f.view === 'board' ? f.view : null,
    clear: f.clear === true,
    count: f.count === true,
  };
}

const aiItems = (value: unknown): VoiceAiItem[] => (Array.isArray(value) ? value : []).slice(0, 10).flatMap((item) => {
  const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
  const service = str(it.service, 80);
  if (!service) return [];
  const quantity = Math.min(99, Math.max(1, Math.round(Number(it.quantity)) || 1));
  return [{ service, quantity, teeth: teeth(it.teeth) }];
});

function draftEdit(value: unknown, labIds: Set<string>, date: (v: unknown) => string | null): VoiceAiDraftEdit | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Record<string, unknown>;
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : null);
  return {
    patient: str(d.patient, 80),
    add_items: aiItems(d.add_items),
    remove_items: (Array.isArray(d.remove_items) ? d.remove_items : []).slice(0, 10).flatMap((v) => str(v, 80) ?? []),
    update_items: (Array.isArray(d.update_items) ? d.update_items : []).slice(0, 10).flatMap((item) => {
      const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const quantity = Math.round(Number(it.quantity));
      const q = it.quantity == null || !Number.isFinite(quantity) ? null : Math.min(99, Math.max(1, quantity));
      const tth = Array.isArray(it.teeth) ? teeth(it.teeth) : null;
      if (q === null && tth === null) return [];
      return [{ service: str(it.service, 80), quantity: q, teeth: tth }];
    }),
    work_description: str(d.work_description, 500),
    laboratory_id: typeof d.laboratory_id === 'string' && labIds.has(d.laboratory_id) ? d.laboratory_id : null,
    clear_laboratory: d.clear_laboratory === true,
    send: bool(d.send),
    due_date: date(d.due_date),
    urgent: bool(d.urgent),
    note_add: str(d.note_add, 500),
  };
}

/**
 * Lo que vuelve del flujo ya viene validado contra la lista cerrada, pero se vuelve a validar acá:
 * un id que no está en lo que se mandó, una fecha rara o un intent desconocido quedan en null.
 */
export function sanitizeVoiceAiResult(raw: unknown, context: Partial<VoiceAiContext>): VoiceAiResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const stageIds = new Set((context.stages ?? []).map((s) => s.id));
  const labIds = new Set((context.laboratories ?? []).map((l) => l.id));
  const intent = INTENTS.includes(r.intent as VoiceAiIntent) ? (r.intent as VoiceAiIntent) : 'unknown';
  const orderId = Number(r.order_id);
  const stageId = Number(r.stage_id);
  const date = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) ? v : null);
  const items = aiItems(r.items);
  const confidence = Number(r.confidence);
  return {
    intent,
    order_id: Number.isInteger(orderId) && orderId > 0 ? orderId : null,
    stage_id: stageIds.has(stageId) ? stageId : null,
    move_kind: MOVE_KINDS.includes(r.move_kind as (typeof MOVE_KINDS)[number]) ? (r.move_kind as VoiceAiResult['move_kind']) : null,
    effective_date: date(r.effective_date),
    due_date: date(r.due_date),
    laboratory_id: typeof r.laboratory_id === 'string' && labIds.has(r.laboratory_id) ? r.laboratory_id : null,
    patient: str(r.patient, 80),
    items,
    work_description: str(r.work_description, 500),
    teeth: teeth(r.teeth),
    is_urgent: r.is_urgent === true,
    send: r.send === true,
    notes: str(r.notes, 500),
    urgent_change: typeof r.urgent_change === 'boolean' ? r.urgent_change : null,
    note_add: str(r.note_add, 500),
    filter: listFilter(r.filter),
    draft_edit: intent === 'lab_order.draft_edit' ? draftEdit(r.draft_edit, labIds, date) : null,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
}

/** Le pide a la IA que interprete una frase. No escribe nada: solo devuelve qué se pidió. */
export async function interpretVoiceCommand(payload: VoiceInterpretPayload, signal?: AbortSignal): Promise<VoiceAiResult> {
  const data = await api.post(API_ROUTES.HELP.VOICE_COMMAND, payload, undefined, undefined, { signal, timeoutMs: VOICE_AI_TIMEOUT_MS });
  const row = Array.isArray(data) ? (data[0]?.json ?? data[0]) : data;
  return sanitizeVoiceAiResult(row?.result ?? row, payload.context);
}
