import type {
  AestheticBodyFigure,
  AestheticConsent,
  AestheticMapView,
  AestheticPhoto,
  AestheticPhotoAlignment,
  AestheticPhotoKind,
  AestheticPoint,
  AestheticSession,
} from '@/lib/types';
import { toLocalISOString } from '@/lib/utils';

// ──── Frontend-only mockup ────
// There is no backend for the aesthetic record yet: sessions live in localStorage and
// photos/signatures (binary) in IndexedDB. The functions are async and shaped like the
// future API so the UI won't change when they are swapped for real endpoints.

const SESSIONS_KEY = (patientId: string) => `aesthetic_record_${patientId}`;
const DB_NAME = 'invokeia-aesthetic-record';
const FILES_STORE = 'files';

function newId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

function readSessions(patientId: string): AestheticSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY(patientId));
    return raw ? (JSON.parse(raw) as AestheticSession[]) : [];
  } catch {
    return [];
  }
}

function writeSessions(patientId: string, sessions: AestheticSession[]): void {
  localStorage.setItem(SESSIONS_KEY(patientId), JSON.stringify(sessions));
}

const byDate = (a: AestheticSession, b: AestheticSession) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

// ──── IndexedDB (files) ────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(FILES_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

async function filesTx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, mode);
    const request = run(tx.objectStore(FILES_STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const putFile = (id: string, blob: Blob) => filesTx('readwrite', (store) => store.put(blob, id));
const deleteFile = (id: string) => filesTx('readwrite', (store) => store.delete(id));

const fileUrlCache = new Map<string, string>();

/** Object URL for a stored photo or signature; null when the file is gone (e.g. other browser). */
export async function getAestheticFileUrl(fileId: string): Promise<string | null> {
  const cached = fileUrlCache.get(fileId);
  if (cached) return cached;
  const blob = await filesTx<Blob | undefined>('readonly', (store) => store.get(fileId));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  fileUrlCache.set(fileId, url);
  return url;
}

function forgetFile(fileId: string): void {
  const url = fileUrlCache.get(fileId);
  if (url) URL.revokeObjectURL(url);
  fileUrlCache.delete(fileId);
}

// ──── Sessions ────

export async function fetchAestheticSessions(patientId: string): Promise<AestheticSession[]> {
  return readSessions(patientId).sort(byDate);
}

export interface AestheticSessionInput {
  date: string;
  title: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  notes: string;
  points: AestheticPoint[];
  bodyFigure: AestheticBodyFigure;
}

export interface AestheticPhotoUpload {
  file: File;
  kind: AestheticPhotoKind;
  view: AestheticMapView;
  /** Placement behind the map, when it was adjusted before the photo was saved */
  alignment?: AestheticPhotoAlignment;
}

export type AestheticConsentInput = Omit<AestheticConsent, 'signatureFileId' | 'signedAt'>;

/** Consent signed while the session was being edited, saved together with it */
export interface AestheticConsentUpload {
  input: AestheticConsentInput;
  signature: File;
  signedAt: string;
}

/** Creates the session (no `sessionId`) or replaces its fields, adding/removing photos and attaching a new consent. */
export async function upsertAestheticSession(
  patientId: string,
  input: AestheticSessionInput,
  newPhotos: AestheticPhotoUpload[],
  removedPhotoIds: string[],
  sessionId?: string,
  newConsent?: AestheticConsentUpload,
): Promise<AestheticSession> {
  const sessions = readSessions(patientId);
  const existing = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
  if (sessionId && !existing) throw new Error('Aesthetic session not found');

  const now = toLocalISOString(new Date());
  let consent = existing?.consent ?? null;
  if (newConsent) {
    const signatureFileId = newId('signature');
    await putFile(signatureFileId, newConsent.signature);
    consent = { ...newConsent.input, signatureFileId, signedAt: newConsent.signedAt };
  }
  const uploaded: AestheticPhoto[] = [];
  for (const upload of newPhotos) {
    const id = newId('photo');
    await putFile(id, upload.file);
    uploaded.push({
      id,
      kind: upload.kind,
      view: upload.view,
      fileName: upload.file.name,
      mimeType: upload.file.type,
      createdAt: now,
      ...(upload.alignment && { alignment: upload.alignment }),
    });
  }

  const keptPhotos = (existing?.photos ?? []).filter((p) => !removedPhotoIds.includes(p.id));
  const session: AestheticSession = {
    id: existing?.id ?? newId('aes'),
    patientId,
    ...input,
    photos: [...keptPhotos, ...uploaded],
    consent,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  writeSessions(patientId, existing ? sessions.map((s) => (s.id === session.id ? session : s)) : [...sessions, session]);

  // Files are dropped only after the session no longer points at them
  const replacedSignature = newConsent ? existing?.consent?.signatureFileId : undefined;
  await dropFiles(replacedSignature ? [...removedPhotoIds, replacedSignature] : removedPhotoIds);
  return session;
}

async function dropFiles(fileIds: string[]): Promise<void> {
  for (const id of fileIds) {
    forgetFile(id);
    await deleteFile(id).catch(() => undefined);
  }
}

/** Deletes the session with its photos and consent signature */
export async function deleteAestheticSession(patientId: string, sessionId: string): Promise<void> {
  const sessions = readSessions(patientId);
  const existing = sessions.find((s) => s.id === sessionId);
  if (!existing) throw new Error('Aesthetic session not found');

  writeSessions(patientId, sessions.filter((s) => s.id !== sessionId));
  const fileIds = existing.photos.map((p) => p.id);
  if (existing.consent) fileIds.push(existing.consent.signatureFileId);
  await dropFiles(fileIds);
}

export async function signAestheticConsent(
  patientId: string,
  sessionId: string,
  input: AestheticConsentInput,
  signature: File,
): Promise<AestheticSession> {
  const sessions = readSessions(patientId);
  const existing = sessions.find((s) => s.id === sessionId);
  if (!existing) throw new Error('Aesthetic session not found');

  const signatureFileId = newId('signature');
  await putFile(signatureFileId, signature);
  const session: AestheticSession = {
    ...existing,
    consent: { ...input, signatureFileId, signedAt: toLocalISOString(new Date()) },
    updatedAt: toLocalISOString(new Date()),
  };
  writeSessions(patientId, sessions.map((s) => (s.id === sessionId ? session : s)));

  if (existing.consent) await dropFiles([existing.consent.signatureFileId]);
  return session;
}

/** Stores (or clears, with `null`) how a photo sits behind the map; it is not part of the session edit */
export async function saveAestheticPhotoAlignment(
  patientId: string,
  photoId: string,
  alignment: AestheticPhotoAlignment | null,
): Promise<AestheticSession> {
  const sessions = readSessions(patientId);
  const existing = sessions.find((s) => s.photos.some((p) => p.id === photoId));
  if (!existing) throw new Error('Aesthetic photo not found');

  const session: AestheticSession = {
    ...existing,
    // An undefined alignment is dropped when serialized
    photos: existing.photos.map((p) => (p.id === photoId ? { ...p, alignment: alignment ?? undefined } : p)),
  };
  writeSessions(patientId, sessions.map((s) => (s.id === session.id ? session : s)));
  return session;
}

export const newAestheticPointId = () => newId('pt');
