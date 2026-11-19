import { expect, test } from '@playwright/test';

import { inventedNumbers, isWeightyCommand, parseVoice, shouldAskAiFirst, spokenNumbers, voiceCommandsToPhrase, type VoiceCommand } from '@/lib/perio/voice';
import { sanitizePerioAiResult } from '@/lib/voice/commands/perio';

/**
 * Lógica del dictado del periodontograma con IA, sin navegador: lo que la IA devuelve se revalida,
 * los números que no se dijeron se detectan y lo entendido se lee como frase del mismo lenguaje.
 */
test.describe('Periodontograma — voz con IA (lógica)', () => {
  test('números dichos: en cifras, en palabras, pegados y pieza dígito por dígito', () => {
    const said = spokenNumbers('en el treinta y ocho por lingual tengo tres, dos y cuatro');
    expect([...said]).toEqual(expect.arrayContaining([38, 3, 2, 4]));
    expect(spokenNumbers('324').has(3)).toBe(true);
    expect(spokenNumbers('pieza 2 3').has(23)).toBe(true);
    expect(spokenNumbers('menos 2').has(2)).toBe(true);
  });

  test('un número que no se dijo se marca (la pieza por su nombre, un valor inventado)', () => {
    const fromName: VoiceCommand[] = [{ kind: 'goto', tooth: 36, side: 'v' }, { kind: 'values', values: [4, 3, 5] }];
    expect(inventedNumbers(fromName, 'the lower left first molar buccal is four three five')).toEqual([36]);
    const ok: VoiceCommand[] = [{ kind: 'goto', tooth: 38, side: 'i' }, { kind: 'values', values: [3, 2, 4] }, { kind: 'flag', flag: 'bop', on: true, sites: [0] }];
    expect(inventedNumbers(ok, 'en el treinta y ocho por lingual tengo tres, dos y cuatro y le sangra el distal')).toEqual([]);
    expect(inventedNumbers([{ kind: 'values', values: [5] }], 'ahí tengo tres')).toEqual([5]);
    expect(inventedNumbers([{ kind: 'values', values: [-2] }], 'menos dos')).toEqual([]);
  });

  test('entendida a medias: va primero a la IA si lo que sobra nombra una pieza o un lugar', () => {
    expect(shouldAskAiFirst(parseVoice('primer molar inferior izquierdo por vestibular cuatro tres cinco'))).toBe(true);
    expect(shouldAskAiFirst(parseVoice('en el de al lado por palatino tengo tres dos cuatro'))).toBe(true);
    expect(shouldAskAiFirst(parseVoice('bueno 3 2 4'))).toBe(false);
    expect(shouldAskAiFirst(parseVoice('3 2 4 sangra mesial perfecto'))).toBe(false);
    expect(shouldAskAiFirst(parseVoice('confirmar todo eso que dije'))).toBe(false);
    expect(shouldAskAiFirst(parseVoice('cualquier cosa rara'))).toBe(false);
  });

  test('la frase legible vuelve a dar los mismos comandos', () => {
    const commands: VoiceCommand[] = [
      { kind: 'goto', tooth: 38, side: 'i' },
      { kind: 'values', values: [3, 2, 4] },
      { kind: 'flag', flag: 'bop', on: true, tooth: 16, side: 'v', sites: [2] },
      { kind: 'pass', pass: 'mg' },
      { kind: 'mobility', tooth: 46, value: 1 },
    ];
    const phrase = voiceCommandsToPhrase(commands, 'es');
    expect(phrase).toBe('diente 38 lingual, 3 2 4, sangra 16 vestibular mesial, margen gingival, 46 movilidad 1');
    expect(parseVoice(phrase).commands).toEqual(commands);
    expect(voiceCommandsToPhrase([{ kind: 'goto', tooth: 23, line: 'bop' }], 'es')).toBe('SS 23');
    expect(voiceCommandsToPhrase([{ kind: 'goto', tooth: 16, side: 'i' }], 'es')).toBe('diente 16 palatino');
    expect(voiceCommandsToPhrase([{ kind: 'values', values: [-2, 1] }], 'en')).toBe('minus 2 1');
  });

  test('estado de pieza, copiar del examen anterior y preguntas', () => {
    expect(parseVoice('18 ausente').commands).toEqual([{ kind: 'status', tooth: 18, status: 'missing' }]);
    expect(parseVoice('el 46 es un implante').commands).toEqual([{ kind: 'status', tooth: 46, status: 'implant' }]);
    expect(parseVoice('falta el 28').commands).toEqual([{ kind: 'status', tooth: 28, status: 'missing' }]);
    expect(parseVoice('diente 15 póntico').commands).toEqual([{ kind: 'status', tooth: 15, status: 'pontic' }]);
    expect(parseVoice('copiar del examen anterior').commands).toEqual([{ kind: 'copy', what: 'all' }]);
    expect(parseVoice('copiar el margen del examen anterior').commands).toEqual([{ kind: 'copy', what: 'mg' }]);
    expect(parseVoice('copy the depths from the previous exam').commands).toEqual([{ kind: 'copy', what: 'ps' }]);
    expect(parseVoice('¿cuánto tenía el 16?').commands).toEqual([{ kind: 'query', what: 'previous', tooth: 16 }]);
    expect(parseVoice('leeme el 16').commands).toEqual([{ kind: 'query', what: 'current', tooth: 16 }]);
    expect(parseVoice('¿qué me falta?').commands).toEqual([{ kind: 'query', what: 'missing' }]);
    expect(parseVoice('what was 16 before?')).toEqual({ commands: [{ kind: 'query', what: 'previous', tooth: 16 }], unknown: [] });
    expect(parseVoice('read 16').commands).toEqual([{ kind: 'query', what: 'current', tooth: 16 }]);
    expect(parseVoice('what is missing?').commands).toEqual([{ kind: 'query', what: 'missing' }]);
    expect(parseVoice('18 missing').commands).toEqual([{ kind: 'status', tooth: 18, status: 'missing' }]);
    expect(parseVoice('¿cómo está el 16?').commands).toEqual([{ kind: 'query', what: 'current', tooth: 16 }]);
    // Lo de siempre no cambia
    expect(parseVoice('16 vestibular 3 2 4').commands).toEqual([{ kind: 'goto', tooth: 16, side: 'v' }, { kind: 'values', values: [3, 2, 4] }]);
    // La frase legible vuelve a dar lo mismo
    const weighty: VoiceCommand[] = [{ kind: 'status', tooth: 18, status: 'missing' }];
    expect(parseVoice(voiceCommandsToPhrase(weighty, 'es')).commands).toEqual(weighty);
    expect(isWeightyCommand({ kind: 'copy', what: 'all' })).toBe(true);
    expect(isWeightyCommand({ kind: 'query', what: 'missing' })).toBe(false);
  });

  test('lo que devuelve la IA se revalida: fuera de rango, piezas inválidas y confirmar/descartar afuera', () => {
    const { commands } = sanitizePerioAiResult({
      commands: [
        { kind: 'goto', tooth: 38, side: 'i', extra: 'x' },
        { kind: 'values', values: [3, 2, 99, '4', 1.5] },
        { kind: 'confirm' },
        { kind: 'discard' },
        { kind: 'stop' },
        { kind: 'goto', tooth: 19 },
        { kind: 'flag', flag: 'bop', sites: [0, 7] },
        { kind: 'mobility', value: 4 },
        { kind: 'furcation', tooth: 36, entry: 'zz', grade: 2 },
        { kind: 'status', tooth: 18, status: 'missing' },
        { kind: 'status', tooth: 19, status: 'missing' },
        { kind: 'copy', what: 'zz' },
        { kind: 'query', what: 'previous', tooth: 16 },
        'basura',
      ],
    });
    expect(commands).toEqual([
      { kind: 'goto', tooth: 38, side: 'i' },
      { kind: 'values', values: [3, 2, 4] },
      { kind: 'flag', flag: 'bop', on: true, sites: [0] },
      { kind: 'furcation', tooth: 36, grade: 2 },
      { kind: 'status', tooth: 18, status: 'missing' },
      { kind: 'query', what: 'previous', tooth: 16 },
    ]);
    expect(sanitizePerioAiResult(null).commands).toEqual([]);
  });
});
