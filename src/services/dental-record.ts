import { API_ROUTES } from '@/constants/routes';
import type { OdontogramSnapshot, OdontogramState } from '@/lib/types';
import { api } from '@/services/api';

// ──── Periodontogram (localStorage mock — unchanged) ────
import type { DentalRecordSession } from '@/lib/types';

const PERIO_STORAGE_KEY = (patientId: string) => `dental_record_${patientId}`;

export function getSessions(patientId: string): DentalRecordSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERIO_STORAGE_KEY(patientId));
    return raw ? (JSON.parse(raw) as DentalRecordSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: DentalRecordSession): void {
  const sessions = getSessions(session.patient_id);
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  localStorage.setItem(PERIO_STORAGE_KEY(session.patient_id), JSON.stringify(sessions));
}

export function createSession(patientId: string, label?: string): DentalRecordSession {
  const prev = getSessions(patientId);
  const last = prev[prev.length - 1];
  return {
    id: `dr_${Date.now()}`,
    patient_id: patientId,
    date: new Date().toISOString().split('T')[0],
    label: label ?? `Evaluación ${prev.length + 1}`,
    odontogram: last?.odontogram ?? [],
    periodontogram: [],
    created_at: new Date().toISOString(),
  };
}

export function deleteSession(patientId: string, sessionId: string): void {
  const sessions = getSessions(patientId).filter((s) => s.id !== sessionId);
  localStorage.setItem(PERIO_STORAGE_KEY(patientId), JSON.stringify(sessions));
}

// ──── Doctors ────

export type DoctorOption = { id: string; name: string };

export async function fetchDoctors(): Promise<DoctorOption[]> {
  try {
    const data = await api.get(API_ROUTES.USERS_DOCTORS);
    const list: any[] = Array.isArray(data) ? data : [];
    return list.map((d: any) => ({ id: String(d.id), name: d.name ?? d.nombre ?? '' }));
  } catch {
    return [];
  }
}

// ──── Odontogram (real API) ────

function mapApiItemToSnapshot(item: any): OdontogramSnapshot {
  let state: OdontogramState = {};
  if (item.estado_odontograma) {
    if (typeof item.estado_odontograma === 'string') {
      try { state = JSON.parse(item.estado_odontograma); } catch { state = {}; }
    } else {
      state = item.estado_odontograma;
    }
  }

  const archivos = Array.isArray(item.archivos_adjuntos)
    ? item.archivos_adjuntos.map((a: any) => ({
        diente_asociado: a.diente_asociado ?? null,
        ruta: a.web_view_link ?? a.ruta ?? '',
        thumbnail: a.thumbnail_link ?? a.thumbnail,
        tipo: a.mime_type ?? a.tipo ?? '',
      }))
    : [];

  return {
    date: item.fecha_sesion ?? new Date().toISOString().split('T')[0],
    description: item.descripcion ?? '',
    state,
    notes: item.notas ?? '',
    doctorId: item.doctor_id != null ? String(item.doctor_id) : (item.medico_id != null ? String(item.medico_id) : undefined),
    doctorName: item.doctor_name ?? item.medico_nombre ?? item.nombre_medico ?? undefined,
    archivosAdjuntos: archivos,
  };
}

export async function fetchOdontograms(patientId: string): Promise<OdontogramSnapshot[]> {
  try {
    const data = await api.get(API_ROUTES.ODONTOGRAM.PATIENT_ODONTOGRAMS, { user_id: patientId });
    const list: any[] = Array.isArray(data) ? data : (data?.data ?? data?.odontogramas ?? []);
    return list.map(mapApiItemToSnapshot);
  } catch {
    return [];
  }
}

export async function createOdontogram(
  patientId: string,
  snapshot: { date: string; description: string; state: OdontogramState; notes: string; doctorId?: string },
  files: File[],
): Promise<void> {
  const formData = new FormData();
  formData.append('paciente_id', patientId);
  formData.append('fecha_sesion', snapshot.date);
  formData.append('descripcion', snapshot.description);
  formData.append('notas', snapshot.notes);
  formData.append('estado_odontograma', JSON.stringify(snapshot.state));
  if (snapshot.doctorId) formData.append('doctor_id', snapshot.doctorId);
  files.forEach((f) => formData.append('images', f));
  await api.post(API_ROUTES.ODONTOGRAM.CREATE_ODONTOGRAMS, formData);
}
