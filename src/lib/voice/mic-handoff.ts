import { isVoiceListeningAlways, startAlwaysOn, stopAlwaysOn } from '@/lib/voice/session';
import { useVoiceCommand } from '@/stores/voice-command-store';

/**
 * Un solo micrófono a la vez. El navegador escucha con un reconocedor por vez: si un dictado
 * propio (el del periodontograma) arranca mientras el botón Voz está prendido, le pide prestado el
 * micrófono a la voz general y lo devuelve al terminar. Y si la voz general se prende durante el
 * dictado propio, el dictado se apaga (lo dicho le llega igual por el botón único).
 */

/** Toma el micrófono de la voz general; devuelve con qué devolverlo (vuelve a prenderla si estaba). */
export function borrowMicrophone(): () => void {
  if (!isVoiceListeningAlways()) return () => {};
  stopAlwaysOn();
  let returned = false;
  return () => {
    if (returned) return;
    returned = true;
    startAlwaysOn();
  };
}

/** Avisa cuando se prende la voz general (para soltar un dictado propio). Devuelve cómo dejar de mirar. */
export function onGlobalVoiceOn(callback: () => void): () => void {
  return useVoiceCommand.subscribe((state, prev) => {
    if (state.alwaysOn && !prev.alwaysOn) callback();
  });
}
