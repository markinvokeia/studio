import { API_ROUTES } from '@/constants/routes';
import type { LabStage, LabStageAlertConfig, LabStageAlerts, LabStageKind, LabStageSaveItem, LabStagesSaveErrorCode } from '@/lib/types';
import { api, type ApiRequestOptions } from '@/services/api';

/**
 * Configuración → Etapas de laboratorio (flujo n8n "Lab Stages", script 147).
 * La configuración se guarda siempre completa y en una sola transacción: así
 * "exactamente una inicial" y "al menos una final" se validan sobre el resultado.
 */

const KINDS: LabStageKind[] = ['initial', 'intermediate', 'final'];

function unwrapRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data.map((row) => (row as any)?.json ?? row);
  const wrapped = (data as any)?.data ?? (data as any)?.json ?? data;
  return Array.isArray(wrapped) ? wrapped : wrapped ? [wrapped] : [];
}

function toAlert(raw: any): LabStageAlertConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const ids = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    repeat_every_days: raw.repeat_every_days != null ? Number(raw.repeat_every_days) : null,
    recipient_role_ids: ids(raw.recipient_role_ids).map(Number),
    recipient_user_ids: ids(raw.recipient_user_ids).map(String),
    notify_order_doctor: raw.notify_order_doctor === true,
    notify_order_creator: raw.notify_order_creator === true,
    channel_in_app: raw.channel_in_app === true,
    channel_email: raw.channel_email === true,
    channel_whatsapp: raw.channel_whatsapp === true,
    email_template_id: raw.email_template_id != null ? Number(raw.email_template_id) : null,
    whatsapp_template_id: raw.whatsapp_template_id != null ? Number(raw.whatsapp_template_id) : null,
  };
}

function toAlerts(raw: any): LabStageAlerts {
  return { enter: toAlert(raw?.enter), dwell: toAlert(raw?.dwell) };
}

function toStage(raw: any): LabStage | null {
  // alwaysOutputData: sin etapas n8n responde [{}].
  if (!raw || raw.id == null || typeof raw.name !== 'string') return null;
  return {
    id: Number(raw.id),
    name: raw.name,
    color: raw.color || '#64748b',
    sort_order: Number(raw.sort_order) || 0,
    kind: KINDS.includes(raw.kind) ? raw.kind : 'intermediate',
    overdue_days: raw.overdue_days != null ? Number(raw.overdue_days) : null,
    is_active: raw.is_active !== false,
    orders_count: Number(raw.orders_count) || 0,
    in_use: raw.in_use === true,
    alerts: toAlerts(raw.alerts),
  };
}

function toStages(data: unknown): LabStage[] {
  return unwrapRows(data)
    .map(toStage)
    .filter((stage): stage is LabStage => stage !== null);
}

/** Error de validación de lab_stages_save, con el código para traducirlo. */
export class LabStagesSaveError extends Error {
  code: LabStagesSaveErrorCode;
  /** Nombre de la etapa involucrada, cuando aplica. */
  detail: string | null;

  constructor(code: LabStagesSaveErrorCode, detail: string | null, message: string) {
    super(message);
    this.name = 'LabStagesSaveError';
    this.code = code;
    this.detail = detail;
  }
}

/** Todas las etapas: activas primero en su orden, después las desactivadas. */
export async function fetchLabStages(options?: ApiRequestOptions): Promise<LabStage[]> {
  const data = await api.get(API_ROUTES.LAB_STAGES.LIST, undefined, undefined, options);
  return toStages(data);
}

/** Guarda la configuración completa y devuelve las etapas como quedaron. */
export async function saveLabStages(stages: LabStageSaveItem[], options?: ApiRequestOptions): Promise<LabStage[]> {
  try {
    const response = await api.post(API_ROUTES.LAB_STAGES.SAVE, { stages }, undefined, undefined, options);
    return toStages(response);
  } catch (error) {
    const data = (error as { data?: any })?.data;
    if (data && typeof data.code === 'string' && data.success === false) {
      throw new LabStagesSaveError(data.code as LabStagesSaveErrorCode, data.detail ?? null, data.message || data.code);
    }
    throw error;
  }
}
