import { API_ROUTES } from '@/constants/routes';
import type {
  AestheticBodyFigure,
  AestheticPhotoSource,
  AestheticSessionStatus,
  AestheticDepth,
  AestheticLayer,
  AestheticMapView,
  AestheticMarkKind,
  AestheticPhoto,
  AestheticPhotoAlignment,
  AestheticSession,
  AestheticTechnique,
  MeasurementUnit,
  ServiceAestheticConfig,
  ServiceConsentTemplate,
} from '@/lib/types';
import { api } from '@/services/api';

// Flujo n8n "Aesthetic Record" (docs/n8n-flows/flow-aesthetic-record.json) sobre las
// tablas de database/scripts/151, 154 y 155. Las sesiones vienen ya con la forma de
// AestheticSession. La sesión guiada se autoguarda: capas y marcas con cada cambio, y
// firmas, fotos y notas en el momento, cada una con su endpoint.

/** n8n a veces envuelve la respuesta en un array */
const unwrap = <T>(data: unknown): T => (Array.isArray(data) ? data[0] : data) as T;

const optional = <T extends string>(value: unknown): T | undefined => (value == null || value === '' ? undefined : (value as T));
const numberOrNull = (value: unknown): number | null => (value == null || value === '' ? null : Number(value));
const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

const STATUSES: AestheticSessionStatus[] = ['draft', 'consented', 'in_treatment', 'ready_to_close', 'closed', 'void'];

let localIdSeq = 0;
/** Id of something not saved yet (a mark, a pending photo); the backend assigns the real one */
export function newLocalId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${++localIdSeq}`;
  return `${prefix}_${random}`;
}

export const newAestheticMarkId = () => newLocalId('mark');

function normalizeSession(raw: AestheticSession): AestheticSession {
  return {
    ...raw,
    doctorId: optional(raw.doctorId),
    doctorName: optional(raw.doctorName),
    appointmentId: optional(raw.appointmentId),
    bodyFigure: optional<AestheticBodyFigure>(raw.bodyFigure),
    layers: (raw.layers ?? []).map((layer) => ({
      ...layer,
      serviceId: optional(layer.serviceId),
      unitId: optional(layer.unitId),
      unitStep: Number(layer.unitStep) || 1,
      lot: optional(layer.lot),
      lotExpiry: optional(layer.lotExpiry),
      depth: optional<AestheticDepth>(layer.depth),
      technique: optional<AestheticTechnique>(layer.technique),
      notes: optional(layer.notes),
      marks: (layer.marks ?? []).map((mark) => ({
        ...mark,
        x: Number(mark.x),
        y: Number(mark.y),
        zone: mark.zone ?? null,
        quantity: numberOrNull(mark.quantity),
        createdAt: optional(mark.createdAt),
        createdBy: optional(mark.createdBy),
      })),
    })),
    photos: (raw.photos ?? []).map((photo) => ({ ...photo, source: optional<AestheticPhotoSource>(photo.source), takenAt: optional(photo.takenAt) })),
    consents: (raw.consents ?? []).map((consent) => ({
      ...consent,
      templateUpdatedAt: optional(consent.templateUpdatedAt),
      reusedFromSignatureId: optional(consent.reusedFromSignatureId),
      signatureSource: consent.signatureSource === 'reused' ? 'reused' : 'drawn',
      contentSha256: optional(consent.contentSha256),
    })),
    photoConsent: raw.photoConsent ?? null,
    // 155 stores both (and closes the sessions recorded before it). A backend without 155 sends
    // neither: taking that as "closed" would lock a session right after its first autosave
    status: STATUSES.includes(raw.status) ? raw.status : 'draft',
    completeness: Number(raw.completeness) || 0,
    flowVersion: Number(raw.flowVersion) || 1,
    closedAt: optional(raw.closedAt),
    closedByName: optional(raw.closedByName),
    voidedAt: optional(raw.voidedAt),
    voidReason: optional(raw.voidReason),
    sessionNotes: raw.sessionNotes ?? [],
    events: (raw.events ?? []).map((event) => ({ ...event, payload: event.payload ?? {} })),
  };
}

// ──── Files ────

const fileUrlCache = new Map<string, Promise<string | null>>();

/** Object URL for a stored photo or signature; null when it is gone */
export function getAestheticFileUrl(fileId: string): Promise<string | null> {
  let cached = fileUrlCache.get(fileId);
  if (!cached) {
    cached = api
      .getBlob(API_ROUTES.AESTHETIC_RECORD.FILE, { id: fileId })
      .then((blob: Blob | null) => (blob && blob.size > 0 ? URL.createObjectURL(blob) : null))
      .catch(() => {
        // A failed download is retried the next time the file is asked for
        fileUrlCache.delete(fileId);
        return null;
      });
    fileUrlCache.set(fileId, cached);
  }
  return cached;
}

function forgetFile(fileId: string): void {
  fileUrlCache.get(fileId)?.then((url) => url && URL.revokeObjectURL(url));
  fileUrlCache.delete(fileId);
}

// ──── Catalog ────

export async function fetchMeasurementUnits(): Promise<MeasurementUnit[]> {
  const data = unwrap<{ units?: Record<string, unknown>[] }>(await api.get(API_ROUTES.MEASUREMENT_UNITS.LIST));
  return (data?.units ?? []).map((u) => ({
    id: String(u.id),
    code: String(u.code ?? ''),
    name: String(u.name ?? ''),
    symbol: String(u.symbol ?? ''),
    step: Number(u.step) || 1,
    isActive: u.is_active !== false,
    sortOrder: Number(u.sort_order) || 0,
    inUse: u.in_use === true,
  }));
}

export interface MeasurementUnitInput {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  step: number;
  isActive: boolean;
}

export async function saveMeasurementUnit(input: MeasurementUnitInput): Promise<void> {
  const data = unwrap<{ unit?: { id?: unknown } }>(await api.post(API_ROUTES.MEASUREMENT_UNITS.SAVE, {
    unit: { id: input.id ?? null, code: input.code, name: input.name, symbol: input.symbol, step: input.step, is_active: input.isActive },
  }));
  // A 200 without the saved row means nothing was saved (the flow before its 2026-11-04 fix answers this way on errors)
  if (data?.unit?.id == null) throw new Error('The measurement unit was not saved');
}

/** Deletes the unit, or deactivates it when a service or a session uses it */
export async function deleteMeasurementUnit(id: string): Promise<{ deactivated: boolean }> {
  const data = unwrap<{ deactivated?: boolean }>(await api.post(API_ROUTES.MEASUREMENT_UNITS.DELETE, { id: Number(id) }));
  return { deactivated: data?.deactivated === true };
}

/** Unit of measure of every service that has one, by service id */
export async function fetchServiceUnits(): Promise<Map<string, string>> {
  const data = unwrap<{ units?: Record<string, unknown>[] }>(await api.get(API_ROUTES.MEASUREMENT_UNITS.SERVICE_UNITS));
  return new Map((data?.units ?? []).filter((u) => u.unit_id != null).map((u) => [String(u.service_id), String(u.unit_id)]));
}

/** Sets (or clears, with `null`) the service's unit; separate from the service upsert, which doesn't carry it */
export async function saveServiceUnit(serviceId: string, unitId: string | null): Promise<void> {
  await api.post(API_ROUTES.MEASUREMENT_UNITS.SERVICE_UNIT_SAVE, { service_id: Number(serviceId), unit_id: unitId ? Number(unitId) : null });
}

export async function fetchServiceAestheticConfigs(): Promise<ServiceAestheticConfig[]> {
  const data = unwrap<{ configs?: Record<string, unknown>[] }>(await api.get(API_ROUTES.AESTHETIC_RECORD.SERVICE_CONFIGS));
  return (data?.configs ?? []).map((c) => ({
    serviceId: String(c.service_id),
    serviceName: String(c.service_name ?? ''),
    serviceColor: (c.service_color as string | null) || null,
    isActive: c.is_active !== false,
    unitId: String(c.unit_id),
    unitSymbol: String(c.unit_symbol ?? ''),
    unitStep: Number(c.unit_step) || 1,
    markingTool: c.marking_tool === 'area' || c.marking_tool === 'line' ? c.marking_tool : 'point',
    defaultQuantity: numberOrNull(c.default_quantity),
    defaultDepth: optional<AestheticDepth>(c.default_depth),
    defaultTechnique: optional<AestheticTechnique>(c.default_technique),
    price: numberOrNull(c.service_price),
    maxPerSession: numberOrNull(c.max_per_session),
    minIntervalDays: numberOrNull(c.min_interval_days),
    followUpDays: numberOrNull(c.follow_up_days),
    followUpLabel: textOrNull(c.follow_up_label),
    aftercare: textOrNull(c.aftercare),
  }));
}

export interface ServiceAestheticConfigInput {
  enabled: boolean;
  unitId?: string;
  markingTool: AestheticMarkKind;
  defaultQuantity: number | null;
  maxPerSession: number | null;
  minIntervalDays: number | null;
  followUpDays: number | null;
  followUpLabel: string;
  aftercare: string;
}

/** Separate call made after the service itself is saved: the service upsert doesn't know about it */
export async function saveServiceAestheticConfig(serviceId: string, input: ServiceAestheticConfigInput): Promise<void> {
  await api.post(API_ROUTES.AESTHETIC_RECORD.SERVICE_CONFIG_SAVE, {
    service_id: Number(serviceId),
    enabled: input.enabled,
    unit_id: input.unitId ? Number(input.unitId) : null,
    marking_tool: input.markingTool,
    default_quantity: input.defaultQuantity,
    max_per_session: input.maxPerSession,
    min_interval_days: input.minIntervalDays,
    follow_up_days: input.followUpDays,
    follow_up_label: input.followUpLabel,
    aftercare: input.aftercare,
  });
}

export async function fetchServiceConsentTemplates(): Promise<ServiceConsentTemplate[]> {
  const data = unwrap<{ templates?: Record<string, unknown>[] }>(await api.get(API_ROUTES.AESTHETIC_RECORD.CONSENT_TEMPLATES));
  return (data?.templates ?? []).map((tpl) => ({
    serviceId: String(tpl.service_id),
    title: String(tpl.title ?? ''),
    body: String(tpl.body ?? ''),
    updatedAt: String(tpl.updated_at ?? ''),
  }));
}

/** Stores the service's consent text; an empty body removes it, so the generic text is used again */
export async function saveServiceConsentTemplate(serviceId: string, input: { title: string; body: string }): Promise<ServiceConsentTemplate | null> {
  const data = unwrap<{ template?: Record<string, unknown> }>(
    await api.post(API_ROUTES.AESTHETIC_RECORD.CONSENT_TEMPLATE_SAVE, { service_id: Number(serviceId), title: input.title, body: input.body }),
  );
  const tpl = data?.template;
  if (!tpl || tpl.deleted === true) return null;
  return { serviceId, title: String(tpl.title ?? ''), body: String(tpl.body ?? ''), updatedAt: String(tpl.updated_at ?? '') };
}

// ──── Sessions ────

export async function fetchAestheticSessions(patientId: string): Promise<AestheticSession[]> {
  const data = unwrap<{ sessions?: AestheticSession[] }>(await api.get(API_ROUTES.AESTHETIC_RECORD.SESSIONS, { patient_id: patientId }));
  return (data?.sessions ?? []).map(normalizeSession);
}

export interface AestheticSessionInput {
  date: string;
  title: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  notes: string;
  layers: AestheticLayer[];
  bodyFigure: AestheticBodyFigure;
}

function sessionPayload(patientId: string, input: AestheticSessionInput, sessionId?: string) {
  return {
    id: sessionId ?? null,
    patientId,
    date: input.date,
    title: input.title,
    doctorId: input.doctorId ?? null,
    appointmentId: input.appointmentId ?? null,
    notes: input.notes,
    bodyFigure: input.bodyFigure,
    layers: input.layers.map((layer) => ({
      serviceId: layer.serviceId ?? null,
      serviceName: layer.serviceName,
      productName: layer.productName,
      unitId: layer.unitId ?? null,
      markingTool: layer.markingTool,
      lot: layer.lot ?? null,
      lotExpiry: layer.lotExpiry ?? null,
      depth: layer.depth ?? null,
      technique: layer.technique ?? null,
      notes: layer.notes ?? null,
      marks: layer.marks.map((mark) => ({
        kind: mark.kind,
        view: mark.view,
        x: mark.x,
        y: mark.y,
        polygon: mark.kind !== 'point' ? mark.polygon : null,
        zone: mark.zone,
        quantity: mark.quantity,
        lot: mark.lot ?? null,
        lotExpiry: mark.lotExpiry ?? null,
        depth: mark.depth ?? null,
        technique: mark.technique ?? null,
        notes: mark.notes ?? null,
        createdAt: mark.createdAt ?? null,
        createdBy: mark.createdBy ?? null,
      })),
    })),
  };
}

/**
 * Autosave: creates the session as a draft (no `sessionId`) or replaces its fields, layers and marks.
 * The server recomputes its status and rejects marks of a service without a signed consent.
 */
export async function saveAestheticSession(patientId: string, input: AestheticSessionInput, sessionId?: string): Promise<AestheticSession> {
  const data = unwrap<{ session: AestheticSession }>(
    await api.post(API_ROUTES.AESTHETIC_RECORD.SESSION_SAVE, { session: sessionPayload(patientId, input, sessionId) }),
  );
  return normalizeSession(data.session);
}

/** Deletes the session (soft: its photos and signature stay in the clinic's storage) */
export async function deleteAestheticSession(_patientId: string, sessionId: string): Promise<void> {
  await api.post(API_ROUTES.AESTHETIC_RECORD.SESSION_DELETE, { id: Number(sessionId) });
}

/** Closes a session that is ready to close: it becomes read-only. `notes` is the summary as edited */
export async function closeAestheticSession(sessionId: string, notes: string): Promise<AestheticSession> {
  const data = unwrap<{ session: AestheticSession }>(await api.post(API_ROUTES.AESTHETIC_RECORD.SESSION_CLOSE, { id: Number(sessionId), notes }));
  return normalizeSession(data.session);
}

/** Cancels a session before it is closed, with the reason */
export async function voidAestheticSession(sessionId: string, reason: string): Promise<AestheticSession> {
  const data = unwrap<{ session: AestheticSession }>(await api.post(API_ROUTES.AESTHETIC_RECORD.SESSION_VOID, { id: Number(sessionId), reason }));
  return normalizeSession(data.session);
}

/** Timestamped note while the session is open; an amendment once it is closed */
export async function addAestheticNote(sessionId: string, body: string, kind: 'note' | 'amendment'): Promise<AestheticSession> {
  const data = unwrap<{ session: AestheticSession }>(
    await api.post(API_ROUTES.AESTHETIC_RECORD.NOTE_ADD, { session_id: Number(sessionId), body, kind }),
  );
  return normalizeSession(data.session);
}

// ──── Photos ────

export interface AestheticPhotoUpload {
  file: File;
  view: AestheticMapView;
  source: AestheticPhotoSource;
  alignment?: AestheticPhotoAlignment;
}

/** Uploads a photo of today right away; it is always a "before" (taken before treating) */
export async function uploadAestheticPhoto(sessionId: string, upload: AestheticPhotoUpload): Promise<AestheticPhoto> {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('kind', 'before');
  form.append('view', upload.view);
  form.append('source', upload.source);
  if (upload.alignment) form.append('alignment', JSON.stringify(upload.alignment));
  form.append('data', upload.file, upload.file.name);
  const data = unwrap<{ photo: AestheticPhoto }>(await api.post(API_ROUTES.AESTHETIC_RECORD.PHOTO_UPLOAD, form));
  return { ...data.photo, source: optional<AestheticPhotoSource>(data.photo.source), takenAt: optional(data.photo.takenAt) };
}

export async function deleteAestheticPhoto(photoId: string): Promise<void> {
  await api.post(API_ROUTES.AESTHETIC_RECORD.PHOTO_DELETE, { id: photoId });
  forgetFile(photoId);
}

/** Stores (or clears, with `null`) how a photo sits behind the map */
export async function saveAestheticPhotoAlignment(
  session: AestheticSession,
  photoId: string,
  alignment: AestheticPhotoAlignment | null,
): Promise<AestheticSession> {
  await api.post(API_ROUTES.AESTHETIC_RECORD.PHOTO_ALIGNMENT, { id: photoId, alignment });
  return {
    ...session,
    // An undefined alignment is dropped when serialized
    photos: session.photos.map((p) => (p.id === photoId ? { ...p, alignment: alignment ?? undefined } : p)),
  };
}

// ──── Consents ────

/** Consent of one service as the patient reads it, before it is signed */
export interface AestheticConsentDraft {
  serviceId: string;
  serviceName: string;
  title: string;
  text: string;
  templateUpdatedAt?: string;
}

/** What the patient signs at once: one or more services of the session with the same signature */
export interface AestheticConsentSigning {
  signerName: string;
  signedAt: string;
  allowsClinicalPhotos: boolean;
  allowsMarketingPhotos: boolean;
  consents: AestheticConsentDraft[];
  /** Drawn now */
  signature?: File;
  /** Or a stored signature of the patient, used again (a consent still in force) */
  reuseSignatureId?: string;
}

/** Signs consents of a stored session (its services must be saved first). Returns the whole session */
export async function signAestheticConsents(sessionId: string, signing: AestheticConsentSigning): Promise<AestheticSession> {
  const payload = {
    signerName: signing.signerName,
    signedAt: signing.signedAt,
    allowsClinicalPhotos: signing.allowsClinicalPhotos,
    allowsMarketingPhotos: signing.allowsMarketingPhotos,
    consents: signing.consents,
  };
  let data: { session: AestheticSession };
  if (signing.reuseSignatureId) {
    data = unwrap(await api.post(API_ROUTES.AESTHETIC_RECORD.CONSENTS_REUSE, {
      session_id: Number(sessionId),
      signing: { ...payload, reuseSignatureId: Number(signing.reuseSignatureId) },
    }));
  } else {
    if (!signing.signature) throw new Error('Missing signature');
    const form = new FormData();
    form.append('session_id', sessionId);
    form.append('signing', JSON.stringify(payload));
    form.append('data', signing.signature, signing.signature.name || 'signature.png');
    data = unwrap(await api.post(API_ROUTES.AESTHETIC_RECORD.CONSENTS_SIGN, form));
  }
  return normalizeSession(data.session);
}
