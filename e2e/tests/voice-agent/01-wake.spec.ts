import { expect, test } from '@playwright/test';

import { extractWake, isCancelPhrase, isResumePhrase } from '@/lib/voice/wake';

/** VZ-WAKE: la palabra de activación tal como la transcribe el reconocedor (es y en). */
test.describe('VZ-WAKE · palabra de activación', () => {
  const woke: Array<[string, string]> = [
    ['Invoke, andá al jueves', 'anda al jueves'],
    ['invoke anda al jueves', 'anda al jueves'],
    ['Inbox IA andá al jueves', 'anda al jueves'],
    ['Inbox andá al jueves', 'anda al jueves'],
    ['imbox zoom', 'zoom'],
    ['in voke vista semana', 'vista semana'],
    ['in box vista semana', 'vista semana'],
    ['Invoque, ¿qué tengo mañana?', 'que tengo manana'],
    ['invoca hoy', 'hoy'],
    ['Envoke today', 'today'],
    ['hey invoke go to Thursday', 'go to thursday'],
    ['oye Invoke, actualizá', 'actualiza'],
    ['ok inbook refresh', 'refresh'],
    ['Invoke', ''],
  ];
  for (const [said, rest] of woke) {
    test(`despierta: «${said}»`, () => {
      const w = extractWake(said);
      expect(w.woke).toBe(true);
      expect(w.rest).toBe(rest);
    });
  }
  const asleep = ['invoice Juan Pérez', 'pasá, sentate', 'importante llamar al laboratorio', 'y vos qué opinás', 'en la sala de espera', 'impresionante', 'bueno, invoke después lo vemos'];
  for (const said of asleep) {
    test(`no despierta: «${said}»`, () => {
      expect(extractWake(said).woke).toBe(false);
    });
  }
  test('restRaw conserva tildes: «Inbox IA, nota: Ana trae estudios»', () => {
    expect(extractWake('Inbox IA, nota: Ana trae estudios').restRaw).toBe('nota: Ana trae estudios');
  });
  test('retomar y cancelar', () => {
    for (const s of ['sigamos', 'continuemos', 'en que estabamos', 'vamos a continuar con lo que estabamos', 'continue', 'lets continue', 'where were we']) expect(isResumePhrase(s), s).toBe(true);
    for (const s of ['cancela', 'olvidalo', 'deja eso', 'stop', 'never mind', 'cancel that']) expect(isCancelPhrase(s), s).toBe(true);
    expect(isCancelPhrase('cancela la cita de ana')).toBe(false);
  });
});
