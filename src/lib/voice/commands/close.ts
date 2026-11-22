import { CORE_VOICE_DOMAIN } from '@/lib/voice/commands/core';
import { closeTopOverlay, hasOpenOverlay } from '@/lib/voice/dom-dialog';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { listVoiceBridges } from '@/lib/voice/screen-bridge';

import type { CrudVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * Cerrar lo último que se abrió, en cualquier pantalla: «cerrá», «cerrá esto», «cerrá la
 * ventana», «volvé atrás», «close it». Primero la ventana o el panel lateral de arriba; si no hay,
 * el panel de detalle del registro elegido. «Cerrá todo» cierra todas las capas. En la agenda
 * manda su propio comando (calendar.close, que también cierra sus paneles).
 */

const CLOSE_RE = /^(?:(?:ya |bueno |dale |ok |listo )?(?:cerra\w*|cierra\w*|close|oculta\w*|esconde\w*|hide|saca\w*|quita\w*|dismiss|minimiza\w*|get rid of|take (?:it|that|this) away))(?:\s(?:me|lo|la|los|las|el|the|this|that|este|esta|eso|esto|it|panel|paneles|panels|ventana|ventanas|ventanita|cuadro|cuadrito|popup|pop up|lateral|costado|sidebar|side panel|abierto|abiertos|abierta|open|de la derecha|de la izquierda|de ahi|de aca|de encima|todo|todos|everything|all|por favor|please|ya|window|windows|dialogo|dialog|formulario|form|detalle|details?|ficha))*$/;
const BACK_RE = /^(?:volve\w*|vuelve|anda|ir|go|volvamos|sali\w*|sal)?(?:\s?(?:para |hacia |de )?(?:atras|back|aca|aqui|de aca|out))(?:\s(?:por favor|please))?$|^(?:sali\w*|sal|exit|salir)$/;
const ALL_RE = /\b(?:todo|todos|everything|all|paneles|panels|ventanas|windows)\b/;

interface CloseParsed { all: boolean }

const selected = () => listVoiceBridges<CrudVoiceBridge>('crud').filter((b) => !!b?.selectedId && !!b.deselect);

registerVoiceCommand<CloseParsed>({
  id: 'core.close',
  domain: CORE_VOICE_DOMAIN,
  priority: 30,
  // Cierra él mismo, de a una capa: la sesión no tiene que cerrar nada antes.
  keepsOverlay: true,
  match: (normalized) => {
    if (!CLOSE_RE.test(normalized) && !BACK_RE.test(normalized)) return null;
    if (!hasOpenOverlay() && !selected().length) return null;
    return { all: ALL_RE.test(normalized) };
  },
  run: async ({ all }, ctx: VoiceCommandContext) => {
    const T = (key: string, values?: Record<string, string>) => ctx.t(`VoiceCommands.ui.${key}`, values);
    const closed: string[] = [];
    for (let guard = 0; guard < 6 && hasOpenOverlay(); guard++) {
      const name = closeTopOverlay();
      if (name === null) break;
      closed.push(name || T('window'));
      if (!all) break;
      await new Promise((r) => setTimeout(r, 120));
    }
    if (all || !closed.length) {
      for (const table of selected()) {
        table.deselect!();
        closed.push(T('detail'));
        if (!all) break;
      }
    }
    const message = closed.length ? T('closed', { names: closed.join(', ') }) : T('nothingToClose');
    await ctx.finish({ title: ctx.t('VoiceCommands.label'), message, tone: closed.length ? 'success' : 'info' }, message);
  },
});
