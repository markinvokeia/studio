import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';

export interface DoctorOption {
  id: string;
  name: string;
}

function normalizeCollectionResponse(data: any): any[] {
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.json && typeof data[0].json === 'object') {
      const nested = data[0].json?.data || data[0].json?.doctors;
      if (Array.isArray(nested)) return nested;
      return data.map((item) => item?.json ?? item).filter(Boolean);
    }

    if (data.length > 0 && data[0]?.data) {
      return Array.isArray(data[0].data) ? data[0].data : [data[0].data];
    }

    return data;
  }

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.doctors)) return data.doctors;
  if (Array.isArray(data?.result)) return data.result;

  return [];
}

function normalizeSingleResponse(data: any): any | null {
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const first = data[0];

    if (first?.json && typeof first.json === 'object') {
      const jsonData = first.json?.data;
      if (Array.isArray(jsonData)) return jsonData[0] ?? null;
      return jsonData ?? first.json ?? null;
    }

    if (first?.data !== undefined) {
      if (Array.isArray(first.data)) return first.data[0] ?? null;
      return first.data ?? null;
    }

    return first ?? null;
  }

  if (Array.isArray(data?.data)) return data.data[0] ?? null;
  if (data?.data && typeof data.data === 'object') return data.data;
  if (Array.isArray(data?.result)) return data.result[0] ?? null;

  return data && typeof data === 'object' ? data : null;
}

function mapDoctorOption(raw: any): DoctorOption | null {
  const id = raw?.id ?? raw?.user_id ?? raw?.doctor_id;
  if (id === undefined || id === null || id === '') return null;

  const name = raw.name ?? raw.nombre ?? raw.full_name ?? raw.fullName ?? '';
  return {
    id: String(id),
    name: String(name || '').trim(),
  };
}

export function normalizeDoctorOptions(data: any): DoctorOption[] {
  return normalizeCollectionResponse(data)
    .map(mapDoctorOption)
    .filter((doctor): doctor is DoctorOption => Boolean(doctor?.id));
}

export async function fetchDoctors(): Promise<DoctorOption[]> {
  try {
    const data = await api.get(API_ROUTES.USERS_DOCTORS);
    return normalizeDoctorOptions(data);
  } catch {
    return [];
  }
}

export async function fetchDoctorById(id: string): Promise<DoctorOption | null> {
  const doctorId = String(id);
  try {
    const data = await api.get(API_ROUTES.USERS_DOCTORS, { search: doctorId });
    const exact = normalizeDoctorOptions(data).find((doctor) => doctor.id === doctorId);
    if (exact) return exact;
  } catch { /* Try the general users endpoint below. */ }

  try {
    const data = await api.get(API_ROUTES.USERS, { id: doctorId, search: doctorId, filter_type: 'DOCTOR' });
    const exact = normalizeDoctorOptions(data).find((doctor) => doctor.id === doctorId);
    if (exact) return exact;
    const doctor = mapDoctorOption(normalizeSingleResponse(data));
    return doctor?.id === doctorId ? doctor : null;
  } catch {
    return null;
  }
}

export async function ensureDoctorOption(
  doctors: DoctorOption[],
  doctorId?: string | null,
  doctorName?: string | null,
): Promise<DoctorOption[]> {
  if (!doctorId) return doctors;
  if (doctors.some((doctor) => doctor.id === String(doctorId))) return doctors;

  const fetchedDoctor = await fetchDoctorById(String(doctorId));
  if (fetchedDoctor?.id === String(doctorId)) {
    return [...doctors, fetchedDoctor];
  }

  if (doctorName?.trim()) {
    return [...doctors, { id: String(doctorId), name: doctorName.trim() }];
  }

  return doctors;
}
