import { API_ROUTES } from '@/constants/routes';
import type { DoctorAiQueryResponse } from '@/lib/types';
import { api } from '@/services/api';

export interface DoctorAiQueryPayload {
  appointment_id: string;
  query: string;
  channel?: 'voice' | 'text';
  transcript?: string;
  session_id?: string;
}

export async function queryDoctorAi(payload: DoctorAiQueryPayload): Promise<DoctorAiQueryResponse> {
  return api.post(API_ROUTES.AI.DOCTOR_QUERY, payload) as Promise<DoctorAiQueryResponse>;
}
