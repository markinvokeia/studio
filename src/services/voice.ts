import api from '@/services/api';

import { API_ROUTES } from '@/constants/routes';

/** La IA tarda unos segundos; más que esto y se avisa que no se pudo. */
const VOICE_AI_TIMEOUT_MS = 25_000;

export interface VoiceInterpretPayload {
  /** Módulo de voz (VoiceDomain.id): el servidor elige el prompt y la validación con esto. */
  domain: string;
  text: string;
  locale: string;
  /** Fecha local ('YYYY-MM-DD') y día de la semana: "ayer", "el viernes" se resuelven con esto. */
  today: string;
  weekday: string;
  timezone: string;
  route: string;
  /** Lo que arma el módulo (VoiceDomain.ai.context): nunca datos de pacientes. */
  context: Record<string, unknown>;
}

/** Respuesta cruda de voice/interpret: el módulo la revalida (VoiceDomain.ai.sanitize). */
export interface VoiceInterpretResponse {
  domain: string;
  confidence: number;
  result: unknown;
}

/** Le pide a la IA que interprete una frase. No escribe nada: solo devuelve qué se pidió. */
export async function interpretVoice(payload: VoiceInterpretPayload, signal?: AbortSignal): Promise<VoiceInterpretResponse> {
  const data = await api.post(API_ROUTES.VOICE.INTERPRET, payload, undefined, undefined, { signal, timeoutMs: VOICE_AI_TIMEOUT_MS });
  const row = (Array.isArray(data) ? (data[0]?.json ?? data[0]) : data) as Record<string, unknown> | null;
  const result = row && typeof row === 'object' && 'result' in row ? row.result : row;
  // La confianza viene en el sobre; si no, la del propio resultado.
  const fromResult = result && typeof result === 'object' ? (result as Record<string, unknown>).confidence : undefined;
  const confidence = Number(row?.confidence ?? fromResult);
  return {
    domain: typeof row?.domain === 'string' ? row.domain : payload.domain,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    result,
  };
}
