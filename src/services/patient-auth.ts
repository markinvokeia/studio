import { API_ROUTES } from '@/constants/routes';
import type {
  PatientIdentifyResponse,
  PatientRegisterPayload,
  PatientRegisterResponse,
  PatientSendCodeResponse,
  PatientVerifyCodeResponse,
} from '@/lib/types';
import { api } from '@/services/api';

/**
 * Login sin password del portal del paciente: se identifica con email, teléfono
 * o cédula, recibe un código de un solo uso por email y con eso entra.
 *
 * Los cuatro endpoints son públicos (el paciente todavía no tiene token).
 * `verifyPatientCode` devuelve el MISMO JWT que `/api/auth/login`, así que a
 * partir de ahí `api.ts`, `AuthContext` y `usePermissions` funcionan sin cambios.
 *
 * Contrato completo: docs/patient-portal.md
 */

/** n8n devuelve indistintamente `{...}`, `[{...}]` o `[{ json: {...} }]`. */
function unwrap<T>(data: any): T {
  if (Array.isArray(data)) {
    const first = data[0];
    if (!first) return {} as T;
    return (first.json ?? first) as T;
  }
  return (data?.json ?? data ?? {}) as T;
}

/**
 * Averigua si el identificador corresponde a un paciente registrado.
 * No devuelve datos del paciente — sólo el email enmascarado.
 */
export async function identifyPatient(identifier: string): Promise<PatientIdentifyResponse> {
  const data = await api.post(API_ROUTES.PATIENT_AUTH.IDENTIFY, { identifier: identifier.trim() });
  const result = unwrap<Partial<PatientIdentifyResponse>>(data);

  return {
    found: Boolean(result.found),
    needs_email: Boolean(result.needs_email),
    masked_email: result.masked_email ?? null,
    // Decide si se le pide OTP (tiene citas que consultar) o si va directo a
    // reservar. Ver docs/patient-portal.md §3.
    has_upcoming_appointments: Boolean(result.has_upcoming_appointments),
    user_id: result.user_id ?? null,
    name: result.name ?? null,
  };
}

/**
 * Genera y envía el código de 6 dígitos al email registrado.
 * `email` sólo se manda cuando `identify` respondió `needs_email: true`.
 */
export async function sendPatientCode(identifier: string, email?: string): Promise<PatientSendCodeResponse> {
  const payload: Record<string, string> = { identifier: identifier.trim() };
  if (email?.trim()) payload.email = email.trim();

  const data = await api.post(API_ROUTES.PATIENT_AUTH.SEND_CODE, payload);
  const result = unwrap<Partial<PatientSendCodeResponse>>(data);

  return {
    sent: result.sent !== false,
    masked_email: result.masked_email ?? null,
    expires_in: result.expires_in ?? 600,
  };
}

/** Valida el código y devuelve el JWT. Lanza si el código es inválido, venció o se agotaron los intentos. */
export async function verifyPatientCode(identifier: string, code: string): Promise<PatientVerifyCodeResponse> {
  const data = await api.post(API_ROUTES.PATIENT_AUTH.VERIFY_CODE, {
    identifier: identifier.trim(),
    code: code.trim(),
  });
  const result = unwrap<Partial<PatientVerifyCodeResponse>>(data);

  if (!result.token) {
    throw new Error('El servidor no devolvió un token de acceso.');
  }

  return {
    token: result.token,
    user: result.user as PatientVerifyCodeResponse['user'],
    is_new: Boolean(result.is_new),
  };
}

/**
 * Auto-registro del paciente que no está en el sistema. Crea la fila en `users`
 * (con `is_sales: true`, igual que `upsertUser()`).
 *
 * **No envía OTP**: el paciente nuevo pasa directo a reservar su primera cita.
 * El correo se valida a posteriori — si rebota, el flujo `patient-email-bounce`
 * marca `users.email_bounced` y recepción revisa esa cita.
 *
 * Ante conflictos de email/teléfono/cédula el backend responde 409 con
 * `{ error: { code: 'unique_conflict', conflictedFields: [...] } }` — el mismo
 * formato que ya maneja `patient-info-tab.tsx`.
 */
export async function registerPatient(payload: PatientRegisterPayload): Promise<PatientRegisterResponse> {
  const body: Record<string, string> = {
    name: payload.name.trim(),
    email: payload.email.trim(),
  };
  if (payload.phone?.trim()) body.phone = payload.phone.trim();
  if (payload.identity_document?.trim()) body.identity_document = payload.identity_document.trim();
  if (payload.birth_date?.trim()) body.birth_date = payload.birth_date.trim();
  if (payload.address?.trim()) body.address = payload.address.trim();

  const data = await api.post(API_ROUTES.PATIENT_AUTH.REGISTER, body);
  const result = unwrap<Partial<PatientRegisterResponse>>(data);

  return {
    created: result.created !== false,
    user_id: result.user_id ?? '',
    name: result.name ?? body.name,
    email: result.email ?? body.email,
    sent: result.sent !== false,
    masked_email: result.masked_email ?? null,
    expires_in: result.expires_in ?? 600,
  };
}
