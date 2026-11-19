import { API_ROUTES } from '@/constants/routes';
import api, { type ApiRequestOptions } from '@/services/api';

export function extractCreatedUserId(response: unknown): string | null {
  const responseRecord = response as {
    data?: { id?: string | number };
    id?: string | number;
    user_id?: string | number;
  } | null;
  const firstArrayItem = Array.isArray(response)
    ? (response[0] as { data?: { id?: string | number } } | undefined)
    : undefined;
  const userId =
    firstArrayItem?.data?.id ??
    responseRecord?.data?.id ??
    responseRecord?.id ??
    responseRecord?.user_id;

  return userId === undefined || userId === null ? null : String(userId);
}

export async function sendFirstTimePasswordToken(userId: string, options?: ApiRequestOptions): Promise<void> {
  await api.post(API_ROUTES.SYSTEM.API_AUTH_FIRST_TIME_PASSWORD_TOKEN, { user_id: userId }, undefined, undefined, options);
}

export interface PatientMatch {
  id: string;
  name: string;
  phone_number: string;
  /** Doctor de cabecera, si el paciente tiene uno. */
  doctor_id?: string;
}

/** Pacientes que coinciden con un nombre (mismo endpoint que el selector de pacientes). */
export async function searchPatients(search: string, options?: ApiRequestOptions): Promise<PatientMatch[]> {
  const data = await api.get(API_ROUTES.USERS, { filter_type: 'PACIENTE', search: search.trim() }, undefined, options);
  const first = Array.isArray(data) ? data[0] : null;
  const rows: unknown[] = first ? first.json?.data ?? first.data ?? [] : data?.data ?? [];
  return rows.flatMap((row) => {
    const u = row as { id?: string | number; name?: string; phone_number?: string; doctor_id?: string | number | null };
    return u?.id != null && u.name
      ? [{ id: String(u.id), name: u.name, phone_number: u.phone_number ?? '', ...(u.doctor_id != null ? { doctor_id: String(u.doctor_id) } : {}) }]
      : [];
  });
}
