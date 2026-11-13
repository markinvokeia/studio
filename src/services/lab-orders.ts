import { API_ROUTES } from '@/constants/routes';
import type {
  LabOrder, LabOrderBoardColumn, LabOrderBoardFilters, LabOrderDetail, LabOrderFilters, LabOrderHistoryEntry, LabOrderItem,
  LabCategory, Laboratory, LabOrderLaboratoryInfo, LabOrderSavePayload, LabOrdersErrorCode, LabStageKind,
} from '@/lib/types';
import { api, type ApiRequestOptions } from '@/services/api';

/**
 * Órdenes de laboratorio (flujo n8n "Lab Orders", script 148). El alta entra siempre en la
 * etapa inicial; la etapa solo cambia con changeLabOrderStage, que deja el historial.
 */

/** Error de negocio de las funciones de órdenes, con el código para traducirlo. */
export class LabOrdersError extends Error {
  code: LabOrdersErrorCode;

  constructor(code: LabOrdersErrorCode, message: string) {
    super(message);
    this.name = 'LabOrdersError';
    this.code = code;
  }
}

async function call<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    const data = (error as { data?: any })?.data;
    if (data && data.success === false && typeof data.code === 'string') {
      throw new LabOrdersError(data.code as LabOrdersErrorCode, data.message || data.code);
    }
    throw error;
  }
}

function unwrapRows(data: unknown): any[] {
  if (Array.isArray(data)) return data.map((row) => (row as any)?.json ?? row);
  const wrapped = (data as any)?.data ?? (data as any)?.json ?? data;
  return Array.isArray(wrapped) ? wrapped : wrapped ? [wrapped] : [];
}

/**
 * Los timestamps llegan con Z (columnas) o con +00:00 (dentro de jsonb). Se normalizan a
 * ISO con Z para que formatUtcDateTime los muestre en hora local.
 */
function toUtcIso(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

const KINDS: LabStageKind[] = ['initial', 'intermediate', 'final'];

function toItem(raw: any): LabOrderItem {
  return {
    id: Number(raw.id),
    service_id: Number(raw.service_id),
    service_name: raw.service_name ?? '',
    quantity: Number(raw.quantity) || 1,
    teeth: Array.isArray(raw.teeth) ? raw.teeth.map(Number) : [],
    notes: raw.notes ?? null,
    lab_category_id: raw.lab_category_id ? String(raw.lab_category_id) : null,
  };
}

function toOrder(raw: any): LabOrder | null {
  // alwaysOutputData: sin filas n8n responde [{}].
  if (!raw || raw.id == null) return null;
  return {
    id: Number(raw.id),
    patient_id: String(raw.patient_id),
    patient_name: raw.patient_name ?? '',
    doctor_id: raw.doctor_id ?? null,
    doctor_name: raw.doctor_name ?? null,
    laboratory_id: raw.laboratory_id ?? null,
    laboratory_name: raw.laboratory_name ?? null,
    work_description: raw.work_description || null,
    // Sin el script 167 no hay items ni work_summary: la orden se ve como antes.
    items: Array.isArray(raw.items) ? raw.items.map(toItem) : [],
    work_summary: raw.work_summary || raw.work_description || null,
    teeth: Array.isArray(raw.teeth) ? raw.teeth.map(Number) : [],
    due_date: raw.due_date ? String(raw.due_date).slice(0, 10) : null,
    notes: raw.notes ?? null,
    current_stage_id: Number(raw.current_stage_id),
    stage_name: raw.stage_name ?? '',
    stage_color: raw.stage_color || '#64748b',
    stage_kind: KINDS.includes(raw.stage_kind) ? raw.stage_kind : 'intermediate',
    stage_overdue_days: raw.stage_overdue_days != null ? Number(raw.stage_overdue_days) : null,
    stage_entered_at: toUtcIso(raw.stage_entered_at),
    days_in_stage: Number(raw.days_in_stage) || 0,
    is_pending: raw.is_pending !== false,
    is_overdue: raw.is_overdue === true,
    // Sin el script 169 el atraso es solo por etapa.
    is_stage_overdue: raw.is_stage_overdue != null ? raw.is_stage_overdue === true : raw.is_overdue === true,
    is_past_due: raw.is_past_due === true,
    days_past_due: Number(raw.days_past_due) || 0,
    created_at: toUtcIso(raw.created_at),
    created_by: raw.created_by ?? null,
    created_by_name: raw.created_by_name ?? null,
    // Sin el script 170 no hay categorías: el selector muestra todos los laboratorios.
    lab_category_ids: Array.isArray(raw.lab_category_ids) ? raw.lab_category_ids.filter(Boolean).map(String) : [],
  };
}

/** Texto opcional: vacío → null. */
function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toLaboratoryInfo(raw: any): LabOrderLaboratoryInfo | null {
  if (!raw || raw.id == null) return null;
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    phone_number: optionalText(raw.phone_number),
    alternative_phone: optionalText(raw.alternative_phone),
    email: optionalText(raw.email),
    address: optionalText(raw.address),
    rut: optionalText(raw.rut),
    categories: toCategoryRefs(raw.categories),
  };
}

function toHistory(raw: any): LabOrderHistoryEntry {
  return {
    id: Number(raw.id),
    from_stage_id: raw.from_stage_id != null ? Number(raw.from_stage_id) : null,
    from_stage_name: raw.from_stage_name ?? null,
    from_stage_color: raw.from_stage_color ?? null,
    to_stage_id: Number(raw.to_stage_id),
    to_stage_name: raw.to_stage_name ?? '',
    to_stage_color: raw.to_stage_color || '#64748b',
    changed_by: raw.changed_by ?? null,
    changed_by_name: raw.changed_by_name ?? null,
    changed_at: toUtcIso(raw.changed_at),
    note: raw.note ?? null,
  };
}

function firstOrder(data: unknown): LabOrder {
  const order = unwrapRows(data).map(toOrder).find((o): o is LabOrder => o !== null);
  if (!order) throw new LabOrdersError('NOT_FOUND', 'Lab order not found');
  return order;
}

export interface LabOrderSearchResult {
  items: LabOrder[];
  total: number;
}

export async function searchLabOrders(filters: LabOrderFilters, options?: ApiRequestOptions): Promise<LabOrderSearchResult> {
  const data = await call(() => api.post(API_ROUTES.LAB_ORDERS.SEARCH, filters, undefined, undefined, options));
  const rows = unwrapRows(data).filter((row) => row?.row_data);
  return {
    items: rows.map((row) => toOrder(row.row_data)).filter((o): o is LabOrder => o !== null),
    total: rows.length > 0 ? Number(rows[0].total_count) || 0 : 0,
  };
}

/** Tablero: una columna por etapa activa, en el orden configurado. */
export async function fetchLabOrdersBoard(filters: LabOrderBoardFilters, options?: ApiRequestOptions): Promise<LabOrderBoardColumn[]> {
  const data = await call(() => api.post(API_ROUTES.LAB_ORDERS.BOARD, filters, undefined, undefined, options));
  return unwrapRows(data)
    .filter((row) => row?.stage_id != null)
    .map((row) => ({
      stage_id: Number(row.stage_id),
      total: Number(row.total) || 0,
      items: (Array.isArray(row.items) ? row.items : []).map(toOrder).filter((o: LabOrder | null): o is LabOrder => o !== null),
    }));
}

export async function fetchLabOrderDetail(id: number, options?: ApiRequestOptions): Promise<LabOrderDetail> {
  const data = await call(() => api.get(API_ROUTES.LAB_ORDERS.DETAIL, { id: String(id) }, undefined, options));
  const raw = unwrapRows(data)[0]?.detail;
  const order = toOrder(raw);
  if (!order) throw new LabOrdersError('NOT_FOUND', 'Lab order not found');
  return {
    ...order,
    history: Array.isArray(raw.history) ? raw.history.map(toHistory) : [],
    laboratory: toLaboratoryInfo(raw.laboratory),
  };
}

export async function saveLabOrder(payload: LabOrderSavePayload, options?: ApiRequestOptions): Promise<LabOrder> {
  return firstOrder(await call(() => api.post(API_ROUTES.LAB_ORDERS.SAVE, payload, undefined, undefined, options)));
}

/**
 * `expectedFromStageId`: la etapa en la que el usuario vio la orden. Si otro la movió
 * mientras tanto el backend responde STAGE_CONFLICT en vez de pisar el cambio.
 * `send`: lo que se fija en el mismo cambio. `laboratoryId`: sin laboratorio, mover a una etapa
 * no final responde LABORATORY_REQUIRED (script 170). `dueDate` ('YYYY-MM-DD'): al enviar la
 * orden (salir de la etapa inicial hacia una no final) es obligatoria — DUE_DATE_REQUIRED, o
 * INVALID_DUE_DATE si es anterior a hoy (script 172).
 */
export async function changeLabOrderStage(
  id: number,
  toStageId: number,
  expectedFromStageId: number | null,
  options?: ApiRequestOptions,
  send?: { laboratoryId?: string | null; dueDate?: string | null },
): Promise<LabOrder> {
  return firstOrder(await call(() => api.post(API_ROUTES.LAB_ORDERS.CHANGE_STAGE, {
    id, to_stage_id: toStageId, expected_from_stage_id: expectedFromStageId,
    ...(send?.laboratoryId ? { laboratory_id: send.laboratoryId } : {}),
    ...(send?.dueDate ? { due_date: send.dueDate } : {}),
  }, undefined, undefined, options)));
}

function toCategoryRefs(value: unknown): { id: string; name: string }[] {
  const list = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
  return Array.isArray(list)
    ? list.filter((c: any) => c?.id != null).map((c: any) => ({ id: String(c.id), name: String(c.name ?? '') }))
    : [];
}

/** Laboratorios (proveedores en una categoría de laboratorio), opcionalmente de una categoría. */
export async function searchLaboratories(
  filters: { search?: string; categoryId?: string | null; limit?: number },
  options?: ApiRequestOptions,
): Promise<Laboratory[]> {
  const params: Record<string, string> = { limit: String(filters.limit ?? 30) };
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.categoryId) params.category_id = filters.categoryId;
  const data = await call(() => api.get(API_ROUTES.LAB_ORDERS.LABORATORIES, params, undefined, options));
  return unwrapRows(data)
    .filter((row) => row?.id != null)
    .map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
      phone_number: row.phone_number ?? null,
      email: row.email ?? null,
      categories: toCategoryRefs(row.categories),
    }));
}

/** Categorías de laboratorio activas. */
export async function fetchLabCategories(options?: ApiRequestOptions): Promise<LabCategory[]> {
  const data = await call(() => api.get(API_ROUTES.LAB_ORDERS.LAB_CATEGORIES, undefined, undefined, options));
  return unwrapRows(data)
    .filter((row) => row?.id != null)
    .map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
      description: row.description ?? null,
      laboratories_count: Number(row.laboratories_count) || 0,
    }));
}

export async function deleteLabOrder(id: number, options?: ApiRequestOptions): Promise<void> {
  await call(() => api.post(API_ROUTES.LAB_ORDERS.DELETE, { id }, undefined, undefined, options));
}
