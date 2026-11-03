import { API_ROUTES } from '@/constants/routes';
import type {
  AestheticBodyFigure,
  AestheticDepth,
  AestheticLayer,
  AestheticMapView,
  AestheticMarkKind,
  AestheticPhoto,
  AestheticPhotoAlignment,
  AestheticPhotoKind,
  AestheticSession,
  AestheticTechnique,
  MeasurementUnit,
  ServiceAestheticConfig,
  ServiceConsentTemplate,
} from '@/lib/types';
import { api } from '@/services/api';

// Flujo n8n "Aesthetic Record" (docs/n8n-flows/flow-aesthetic-record.json) sobre las
// tablas de database/scripts/151 y 154. Las sesiones vienen ya con la forma de
// AestheticSession; las fotos y las firmas se suben aparte, después de guardar la sesión.

/** n8n a veces envuelve la respuesta en un array */
const unwrap = <T>(data: unknown): T => (Array.isArray(data) ? data[0] : data) as T;

const optional = <T extends string>(value: unknown): T | undefined => (value == null || value === '' ? undefined : (value as T));
const numberOrNull = (value: unknown): number | null => (value == null || value === '' ? null : Number(value));

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
      })),
    })),
    photos: raw.photos ?? [],
    consents: (raw.consents ?? []).map((consent) => ({
      ...consent,
      templateUpdatedAt: optional(consent.templateUpdatedAt),
      reusedFromSignatureId: optional(consent.reusedFromSignatureId),
      signatureSource: consent.signatureSource === 'reused' ? 'reused' : 'drawn',
    })),
    photoConsent: raw.photoConsent ?? null,
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
  await api.post(API_ROUTES.MEASUREMENT_UNITS.SAVE, {
    unit: { id: input.id ?? null, code: input.code, name: input.name, symbol: input.symbol, step: input.step, is_active: input.isActive },
  });
}

/** Deletes the unit, or deactivates it when a service or a session uses it */
export async function deleteMeasurementUnit(id: string): Promise<{ deactivated: boolean }> {
  const data = unwrap<{ deactivated?: boolean }>(await api.post(API_ROUTES.MEASUREMENT_UNITS.DELETE, { id: Number(id) }));
  return { deactivated: data?.deactivated === true };
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
  }));
}

export interface ServiceAestheticConfigInput {
  enabled: boolean;
  unitId?: string;
  markingTool: AestheticMarkKind;
  defaultQuantity: number | null;
}

/** Separate call made after the service itself is saved: the service upsert doesn't know about it */
export async function saveServiceAestheticConfig(serviceId: string, input: ServiceAestheticConfigInput): Promise<void> {
  await api.post(API_ROUTES.AESTHETIC_RECORD.SERVICE_CONFIG_SAVE, {
    service_id: Number(serviceId),
    enabled: input.enabled,
    unit_id: input.unitId ? Number(input.unitId) : null,
    marking_tool: input.markingTool,
    default_quantity: input.defaultQuantity,
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

export interface AestheticPhotoUpload {
  /** Local key of the pending photo, reported back when a later step fails */
  key: string;
  file: File;
  kind: AestheticPhotoKind;
  view: AestheticMapView;
  /** Placement behind the map, when it was adjusted before the photo was saved */
  alignment?: AestheticPhotoAlignment;
}

/** Consent of one service as the patient reads it, before it is signed */
export interface AestheticConsentDraft {
  serviceId: string;
  serviceName: string;
  title: string;
  text: string;
  templateUpdatedAt?: string;
}

/**
 * What the patient signs at once: one or more services of the session with the same signature.
 * While the session is edited it waits for the save, since its services must be stored first.
 */
export interface AestheticConsentSigning {
  /** Local key, reported back when a later step of the save fails */
  key: string;
  signerName: string;
  signedAt: string;
  allowsClinicalPhotos: boolean;
  allowsMarketingPhotos: boolean;
  consents: AestheticConsentDraft[];
  /** Drawn signature; also kept on a signing that reuses one of the same edit, in case that one is dropped */
  signature?: File;
  /** A stored signature of the patient, used again */
  reuseSignatureId?: string;
  /** The drawn signature of another signing of this edit, not stored yet */
  reuseKey?: string;
}

/**
 * The session was stored but a photo, a removal or a consent was not. The sheet keeps
 * editing the stored session with what is left, so a retry doesn't create it twice.
 */
export class AestheticPartialSaveError extends Error {
  constructor(
    readonly sessionId: string,
    readonly uploadedPhotoKeys: string[],
    readonly removedPhotoIds: string[],
    readonly savedSigningKeys: string[],
    /** Stored signature of each saved signing, for the ones left that reuse it */
    readonly signatureIdByKey: Record<string, string>,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'AestheticPartialSaveError';
  }
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
      })),
    })),
  };
}

async function uploadPhoto(sessionId: string, upload: AestheticPhotoUpload): Promise<AestheticPhoto> {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('kind', upload.kind);
  form.append('view', upload.view);
  if (upload.alignment) form.append('alignment', JSON.stringify(upload.alignment));
  form.append('data', upload.file, upload.file.name);
  const data = unwrap<{ photo: AestheticPhoto }>(await api.post(API_ROUTES.AESTHETIC_RECORD.PHOTO_UPLOAD, form));
  return data.photo;
}

async function deletePhoto(photoId: string): Promise<void> {
  await api.post(API_ROUTES.AESTHETIC_RECORD.PHOTO_DELETE, { id: photoId });
  forgetFile(photoId);
}

/** Stores a signing: uploads the drawn signature, or points to the reused one. Returns the whole session */
async function storeSigning(sessionId: string, signing: AestheticConsentSigning, reuseSignatureId?: string): Promise<AestheticSession> {
  const payload = {
    signerName: signing.signerName,
    signedAt: signing.signedAt,
    allowsClinicalPhotos: signing.allowsClinicalPhotos,
    allowsMarketingPhotos: signing.allowsMarketingPhotos,
    consents: signing.consents,
  };
  let data: { session: AestheticSession };
  if (reuseSignatureId) {
    data = unwrap(await api.post(API_ROUTES.AESTHETIC_RECORD.CONSENTS_REUSE, {
      session_id: Number(sessionId),
      signing: { ...payload, reuseSignatureId: Number(reuseSignatureId) },
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

/**
 * Creates the session (no `sessionId`) or replaces its fields, layers and marks; then uploads the
 * new photos, removes the dropped ones and stores the consents signed during the edit, in order:
 * one may reuse the signature drawn in an earlier one.
 */
export async function upsertAestheticSession(
  patientId: string,
  input: AestheticSessionInput,
  newPhotos: AestheticPhotoUpload[],
  removedPhotoIds: string[],
  sessionId?: string,
  newSignings: AestheticConsentSigning[] = [],
): Promise<AestheticSession> {
  const saved = unwrap<{ session: AestheticSession }>(
    await api.post(API_ROUTES.AESTHETIC_RECORD.SESSION_SAVE, { session: sessionPayload(patientId, input, sessionId) }),
  );
  let session = normalizeSession(saved.session);

  const uploaded: string[] = [];
  const removed: string[] = [];
  const signed: string[] = [];
  // A service taken out of the session after it was signed has nothing to sign anymore
  const serviceIds = new Set(input.layers.map((l) => l.serviceId).filter(Boolean));
  const signatureIdByKey = new Map<string, string>();
  try {
    for (const upload of newPhotos) {
      session.photos = [...session.photos, await uploadPhoto(session.id, upload)];
      uploaded.push(upload.key);
    }
    for (const id of removedPhotoIds) {
      await deletePhoto(id);
      removed.push(id);
      session.photos = session.photos.filter((p) => p.id !== id);
    }
    for (const signing of newSignings) {
      const consents = signing.consents.filter((c) => serviceIds.has(c.serviceId));
      if (consents.length) {
        // Reusing a signing of this edit that was left with nothing to sign uploads its drawn image instead
        const reuseId = signing.reuseSignatureId ?? (signing.reuseKey ? signatureIdByKey.get(signing.reuseKey) : undefined);
        session = await storeSigning(session.id, { ...signing, consents }, reuseId);
        const id = session.consents.find((c) => c.serviceId === consents[0].serviceId)?.signatureId;
        if (id) signatureIdByKey.set(signing.key, id);
      }
      signed.push(signing.key);
    }
  } catch (error) {
    throw new AestheticPartialSaveError(session.id, uploaded, removed, signed, Object.fromEntries(signatureIdByKey), error);
  }
  return session;
}

/** Deletes the session (soft: its photos and signature stay in the clinic's storage) */
export async function deleteAestheticSession(_patientId: string, sessionId: string): Promise<void> {
  await api.post(API_ROUTES.AESTHETIC_RECORD.SESSION_DELETE, { id: Number(sessionId) });
}

/** Signs consents of a session already stored */
export function signAestheticConsents(session: AestheticSession, signing: AestheticConsentSigning): Promise<AestheticSession> {
  return storeSigning(session.id, signing, signing.reuseSignatureId);
}

/** Stores (or clears, with `null`) how a photo sits behind the map; it is not part of the session edit */
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
