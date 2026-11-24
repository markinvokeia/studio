import { format, startOfToday } from 'date-fns';

import { getVoiceDomain } from '@/lib/voice/registry';
import { interpretVoice } from '@/services/voice';

import type { VoiceCommandContext, VoiceInterpretation } from '@/lib/types';

export interface VoiceInterpretOptions {
  locale: string;
  signal?: AbortSignal;
  /** Lo que la IA necesita saber (nunca datos de pacientes). */
  context: Record<string, unknown>;
}

/**
 * Pregunta a la IA (POST voice/interpret) qué se pidió, con el prompt del módulo `domainId`, y
 * revalida la respuesta con el `sanitize` del módulo. Lo usan la sesión de comandos (con
 * interpretWithAi) y el dictado continuo del periodontograma, que pasa su propio contexto.
 */
export async function requestInterpretation<R>(domainId: string, text: string, { locale, signal, context }: VoiceInterpretOptions): Promise<VoiceInterpretation<R>> {
  const domain = getVoiceDomain(domainId);
  if (!domain?.ai) throw new Error(`Voice domain without AI: ${domainId}`);
  const today = startOfToday();
  const raw = await interpretVoice({
    domain: domainId,
    text,
    locale,
    today: format(today, 'yyyy-MM-dd'),
    weekday: format(today, 'EEEE'),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    route: typeof window !== 'undefined' ? window.location.pathname.replace(/^\/(es-ES|es|en)(?=\/|$)/, '') || '/' : '/',
    context,
  }, signal);
  return { domain: domainId, confidence: raw.confidence, result: domain.ai.sanitize(raw.result, context) as R };
}

/**
 * Lo mismo desde un comando de voz: el contexto lo arma el módulo (etapas, laboratorios) y
 * `extra` agrega lo del momento (la orden abierta).
 */
export async function interpretWithAi<R>(
  domainId: string,
  text: string,
  ctx: VoiceCommandContext,
  extra?: Record<string, unknown>,
): Promise<VoiceInterpretation<R>> {
  const base = await (getVoiceDomain(domainId)?.ai?.context?.(ctx) ?? Promise.resolve({})).catch(() => ({}));
  return requestInterpretation<R>(domainId, text, { locale: ctx.locale, signal: ctx.signal, context: { ...base, ...extra } });
}
