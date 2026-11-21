import { CORE_VOICE_DOMAIN } from '@/lib/voice/commands/core';
import { parseNavigation } from '@/lib/voice/commands/navigation';
import { parseScroll } from '@/lib/voice/commands/core';
import { PERIO_VOICE_DOMAIN } from '@/lib/voice/commands/perio';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';

/**
 * El periodontograma con el botón único: mientras el examen está abierto, lo que se dice con la
 * voz general va a su dictado («3 2 3», «sangrado en la 16», «siguiente diente», «terminé»), como
 * si se hubiera dicho con su propio micrófono. Lo general sigue siendo general: navegar,
 * desplazarse, dejar de escuchar (eso lo toma la sesión antes).
 */
export interface PerioVoiceBridge {
  dictate: (phrase: string) => void;
}

const perio = () => getVoiceBridge<PerioVoiceBridge>('perio');

registerVoiceCommand<{ phrase: string }>({
  id: 'perio.dictate',
  domain: PERIO_VOICE_DOMAIN,
  // Por encima de lo de la página (la ficha del paciente): con el examen abierto se le habla a él.
  priority: 70,
  keepsOverlay: true,
  match: (normalized, raw) => {
    if (!perio() || !normalized) return null;
    if (parseNavigation(normalized, raw) || parseScroll(normalized)) return null;
    return { phrase: raw.trim() || normalized };
  },
  run: async (parsed, ctx) => {
    perio()?.dictate(parsed.phrase);
    // El dictado muestra lo que entendió en su barra: la tarjeta de la voz no dice nada.
    await ctx.finish({ title: ctx.t('VoiceCommands.perio.title'), message: ctx.t('VoiceCommands.perio.sent', { phrase: parsed.phrase }), tone: 'success' }, '');
  },
});

// Que el módulo general se cargue antes (los imports de arriba lo registran).
void CORE_VOICE_DOMAIN;
