import { API_ROUTES } from '@/constants/routes';
import type {
  AllergyItem,
  FamilyHistoryItem,
  MedicationItem,
  PatientHabits,
  PersonalHistoryItem,
} from '@/hooks/useClinicHistory';
import type { PatientSession } from '@/lib/types';
import { api } from './api';

// ── Mappers (mirror the normalization in src/hooks/useClinicHistory.ts so the
//    printed history matches exactly what the on-screen viewer shows) ───────────

function mapPersonalHistory(raw: any[]): PersonalHistoryItem[] {
  return raw.map((item): PersonalHistoryItem => ({
    id: Number(item.id ?? item.antecedente_id ?? item.antecedente_personal_id) || undefined,
    padecimiento_id: item.padecimiento_id ? String(item.padecimiento_id) : undefined,
    nombre: item.nombre || 'N/A',
    categoria: item.categoria || 'N/A',
    nivel_alerta: Number(item.nivel_alerta) || 1,
    comentarios: item.comentarios || '',
  }));
}

function mapFamilyHistory(raw: any[]): FamilyHistoryItem[] {
  return raw.map((item): FamilyHistoryItem => ({
    id: Number(item.id) || undefined,
    padecimiento_id: item.padecimiento_id ? String(item.padecimiento_id) : undefined,
    nombre: item.nombre || 'N/A',
    parentesco: item.parentesco || 'N/A',
    comentarios: item.comentarios || '',
  }));
}

function mapAllergies(raw: any[]): AllergyItem[] {
  return raw.map((item): AllergyItem => ({
    id: Number(item.id) || undefined,
    alergeno: item.alergeno || 'N/A',
    reaccion_descrita: item.reaccion_descrita || '',
    snomed_ct_id: item.snomed_ct_id || '',
  }));
}

function mapMedications(raw: any[]): MedicationItem[] {
  return raw.map((item): MedicationItem => ({
    id: Number(item.id) || undefined,
    medicamento_id: item.medicamento_id ? String(item.medicamento_id) : undefined,
    nombre_medicamento: item.medicamento_nombre || item.nombre_medicamento || item.nombre || 'N/A',
    principio_activo: item.principio_activo || '',
    dosis: item.dosis || '',
    frecuencia: item.frecuencia || '',
    motivo: item.motivo || '',
    fecha_inicio: item.fecha_inicio || '',
    fecha_fin: item.fecha_fin || '',
  }));
}

function mapHabits(data: any): PatientHabits | null {
  let habitsData = data?.data || data?.habitos || data;
  if (Array.isArray(habitsData) && habitsData.length > 0) {
    habitsData = habitsData[0];
  }
  if (!habitsData || typeof habitsData !== 'object' || Array.isArray(habitsData)) {
    return null;
  }
  return {
    id: habitsData.id,
    fuma: Boolean(habitsData.fuma),
    alcohol: habitsData.alcohol === 'true' || habitsData.alcohol === true,
    drogas: Boolean(habitsData.drogas),
    cafe: Boolean(habitsData.cafe),
    otros: habitsData.otros || '',
    comentarios: habitsData.comentarios || '',
    tabaquismo: habitsData.tabaquismo || '',
    alcoholismo: habitsData.alcohol || '',
    bruxismo: habitsData.bruxismo || '',
  };
}

function mapSessions(raw: any[]): PatientSession[] {
  return raw
    .map((session): PatientSession => ({
      ...session,
      sesion_id: Number(session.sesion_id),
      tratamientos: Array.isArray(session.tratamientos) ? session.tratamientos : [],
      archivos_adjuntos: Array.isArray(session.archivos_adjuntos) ? session.archivos_adjuntos : [],
    }))
    // Oldest first — the printed history reads as a chronological record.
    .sort((a, b) => {
      const da = a.fecha_sesion ? new Date(a.fecha_sesion).getTime() : 0;
      const db = b.fecha_sesion ? new Date(b.fecha_sesion).getTime() : 0;
      return da - db;
    });
}

// ── Patient demographics ──────────────────────────────────────────────────────

export interface ClinicHistoryPatientInfo {
  name: string;
  identityDocument?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
}

function mapPatientInfo(raw: any, fallbackName?: string): ClinicHistoryPatientInfo {
  if (!raw) return { name: fallbackName || '' };
  return {
    name: raw.name || raw.nombre || fallbackName || '',
    identityDocument: raw.identity_document || raw.identityDocument || raw.document || raw.ci || undefined,
    email: raw.email || undefined,
    phone: raw.phone_number || raw.phone || raw.telefono || undefined,
    birthDate: raw.birth_date || raw.birthDate || raw.fecha_nacimiento || undefined,
  };
}

// ── Aggregate fetch ───────────────────────────────────────────────────────────

export interface ClinicHistoryPrintPayload {
  patient: ClinicHistoryPatientInfo;
  personalHistory: PersonalHistoryItem[];
  familyHistory: FamilyHistoryItem[];
  allergies: AllergyItem[];
  medications: MedicationItem[];
  habits: PatientHabits | null;
  sessions: PatientSession[];
}

async function unwrap(promise: Promise<any>, pick: (data: any) => any[]): Promise<any[]> {
  try {
    const data = await promise;
    if (Array.isArray(data)) return data;
    const picked = pick(data);
    return Array.isArray(picked) ? picked : [];
  } catch {
    return [];
  }
}

/**
 * Fetches everything the printable clinic history needs in one parallel batch:
 * patient demographics, the full anamnesis (personal/family history, allergies,
 * medications, habits) and every clinical session. Mirrors the shapes produced
 * by `useClinicHistory` so the print output matches the on-screen viewer.
 */
export async function fetchClinicHistoryPrintData(
  userId: string,
  fallbackName?: string,
): Promise<ClinicHistoryPrintPayload> {
  const [
    personalRaw,
    familyRaw,
    allergiesRaw,
    medicationsRaw,
    habitsRaw,
    sessionsRaw,
    patientRaw,
  ] = await Promise.all([
    unwrap(
      api.get(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY, { user_id: userId }),
      (d) => d.antecedentes_personales || d.data,
    ),
    unwrap(
      api.get(API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY, { user_id: userId }),
      (d) => d.antecedentes_familiares || d.data,
    ),
    unwrap(
      api.get(API_ROUTES.CLINIC_HISTORY.ALLERGIES, { user_id: userId }),
      (d) => d.antecedentes_alergias || d.data,
    ),
    unwrap(
      api.get(API_ROUTES.CLINIC_HISTORY.MEDICATIONS, { user_id: userId }),
      (d) => d.antecedentes_medicamentos || d.data,
    ),
    api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_HABITS, { user_id: userId }).catch(() => null),
    unwrap(
      api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: userId }),
      (d) => d.patient_sessions || d.data,
    ),
    api
      .get(API_ROUTES.USERS, { search: userId, filter_type: 'PACIENTE' })
      .then((data: any) => {
        const usersData = Array.isArray(data) && data.length > 0 ? data[0].data : data.data || [];
        return Array.isArray(usersData) && usersData.length > 0 ? usersData[0] : null;
      })
      .catch(() => null),
  ]);

  return {
    patient: mapPatientInfo(patientRaw, fallbackName),
    personalHistory: mapPersonalHistory(personalRaw),
    familyHistory: mapFamilyHistory(familyRaw),
    allergies: mapAllergies(allergiesRaw),
    medications: mapMedications(medicationsRaw),
    habits: mapHabits(habitsRaw),
    sessions: mapSessions(sessionsRaw),
  };
}
