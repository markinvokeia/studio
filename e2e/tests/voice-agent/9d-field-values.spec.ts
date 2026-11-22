import { expect, test } from '@playwright/test';

import { spokenColor, spokenNumber, valueForField } from '@/lib/voice/field-values';

/**
 * FV · Lo dicho como lo espera cada campo (src/lib/voice/field-values.ts): horas, fechas, números
 * y colores en los formularios (Configuración, Sistema y cualquier pantalla). Español e inglés.
 */

const input = (type: string, attrs: Record<string, string> = {}) => ({ type, getAttribute: (n: string) => attrs[n] ?? null }) as unknown as HTMLElement;

test.describe('FV-NUM · Números', () => {
  for (const [said, want] of [
    ['veinte', 20], ['veintidós', 22], ['ciento cincuenta', 150], ['mil quinientos', 1500], ['dos mil trescientos cuarenta', 2340],
    ['1.500', 1500], ['1500', 1500], ['3 coma 5', 3.5], ['tres coma cinco', 3.5], ['12,5', 12.5], ['quince por ciento', 15],
    ['twenty five', 25], ['two thousand', 2000], ['one hundred', 100], ['three point five', 3.5],
  ] as const) {
    test(`«${said}» → ${want}`, () => { expect(spokenNumber(said)).toBe(want); });
  }
  test('lo que no es número: null', () => { expect(spokenNumber('mucho')).toBeNull(); });
  test('campo numérico', () => { expect(valueForField(input('number'), 'veinte')).toBe('20'); });
  test('con la unidad: «5 días» → 5, «400 mg» → 400', () => { expect(valueForField(input('number'), '5 días')).toBe('5'); expect(valueForField(input('number'), 'cuatrocientos mg')).toBe('400'); });
  test('campo de texto: tal cual', () => { expect(valueForField(input('text'), 'veinte')).toBe('veinte'); });
});

test.describe('FV-TIME · Horas', () => {
  for (const [said, want] of [['las 9 y media', '09:30'], ['a las 14', '14:00'], ['8:15', '08:15'], ['las 3 de la tarde', '15:00'], ['mediodía', '12:00'], ['nueve y cuarto', '09:15']] as const) {
    test(`«${said}» → ${want}`, () => { expect(valueForField(input('time'), said)).toBe(want); });
  }
});

test.describe('FV-DATE · Fechas', () => {
  test('campo date: yyyy-mm-dd', () => { expect(valueForField(input('date'), 'el 15 de diciembre')).toMatch(/^\d{4}-12-15$/); });
  test('campo de texto dd/mm/aaaa', () => { expect(valueForField(input('text', { placeholder: 'dd/mm/aaaa' }), 'el 15 de diciembre')).toMatch(/^15\/12\/\d{4}$/); });
  test('«mañana»', () => { expect(valueForField(input('date'), 'mañana')).toMatch(/^\d{4}-\d{2}-\d{2}$/); });
});

test.describe('FV-COLOR · Colores', () => {
  for (const [said, want] of [['rojo', '#ef4444'], ['azul oscuro', '#3b82f6'], ['el color verde', '#22c55e'], ['#3366FF', '#3366ff'], ['purple', '#8b5cf6']] as const) {
    test(`«${said}» → ${want}`, () => { expect(spokenColor(said)).toBe(want); });
  }
  test('campo color', () => { expect(valueForField(input('color'), 'naranja')).toBe('#f97316'); });
  test('la caja del código del color (#…): «rojo» → #ef4444', () => {
    const hex = { type: 'text', value: '#000000', getAttribute: () => null } as unknown as HTMLElement;
    expect(valueForField(hex, 'rojo')).toBe('#ef4444');
    expect(valueForField(input('text', { placeholder: '#FFFFFF' }), 'azul')).toBe('#3b82f6');
  });
});
