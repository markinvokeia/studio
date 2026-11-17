import { format, startOfToday } from 'date-fns';

import { listVoiceAiCommands } from '@/lib/voice/registry';
import { interpretVoiceCommand } from '@/services/voice';

import type { VoiceAiContext, VoiceAiResult, VoiceCommandContext } from '@/lib/types';

/**
 * Pregunta a la IA qué se pidió. El contexto lo arman los comandos (etapas, laboratorios):
 * nunca se manda la lista de pacientes, solo la frase tal como se dijo.
 */
export async function interpretWithAi(text: string, ctx: VoiceCommandContext): Promise<VoiceAiResult> {
  // Varios comandos pueden compartir el mismo armado de contexto: se pide una vez.
  const builders = Array.from(new Set(listVoiceAiCommands().flatMap((command) => (command.ai?.context ? [command.ai.context] : []))));
  const parts = await Promise.all(builders.map((build) => build(ctx).catch(() => ({}))));
  const context: Partial<VoiceAiContext> = Object.assign({}, ...parts);
  const today = startOfToday();
  return interpretVoiceCommand({
    text,
    locale: ctx.locale,
    today: format(today, 'yyyy-MM-dd'),
    weekday: format(today, 'EEEE'),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    route: typeof window !== 'undefined' ? window.location.pathname.replace(/^\/(es-ES|es|en)(?=\/|$)/, '') || '/' : '/',
    context,
  }, ctx.signal);
}
