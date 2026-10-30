import { API_ROUTES } from '@/constants/routes';
import type { PatientAiQueryResponse } from '@/lib/types';
import { api } from '@/services/api';

export interface PatientAiQueryPayload {
  /** Se manda por conveniencia, pero el backend usa el `sub` del JWT — nunca este valor. */
  patient_id: string;
  query: string;
  channel?: 'voice' | 'text';
  session_id?: string;
  has_existing_session?: boolean;
}

/** Asistente virtual del portal del paciente. Contrato: docs/patient-portal.md §2.5 */
export async function queryPatientAi(payload: PatientAiQueryPayload): Promise<PatientAiQueryResponse> {
  const data = await api.post(API_ROUTES.AI.PATIENT_QUERY, payload);
  const result = Array.isArray(data) ? (data[0]?.json ?? data[0]) : data;
  return (result ?? {}) as PatientAiQueryResponse;
}
