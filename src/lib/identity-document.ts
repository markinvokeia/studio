import type { IdentityDocumentType } from '@/lib/types';

/**
 * Validación del documento de identidad del paciente. El usuario elige el
 * tipo explícitamente (no se intenta adivinar el formato a partir del valor):
 * la cédula uruguaya y el DNI/NIE españoles tienen un algoritmo de
 * verificación real y público; el resto se valida solo por forma.
 */

export const IDENTITY_DOCUMENT_TYPES: IdentityDocumentType[] = [
  'cedula_uy',
  'cedula_ext',
  'pasaporte_uy',
  'pasaporte_ext',
  'dni',
  'nie',
];

/**
 * Dígito verificador de la Cédula de Identidad uruguaya (módulo 10).
 * Coeficientes oficiales [2,9,8,7,6,3,4] aplicados a los 7 primeros dígitos
 * (con ceros a la izquierda si hace falta). Caso de prueba de referencia:
 * base 1234567 -> dígito verificador 2 -> CI completa 12345672.
 */
export function computeCedulaUyCheckDigit(sevenDigits: string): number {
  const coefficients = [2, 9, 8, 7, 6, 3, 4];
  const padded = sevenDigits.padStart(7, '0');
  const sum = coefficients.reduce((acc, coef, i) => acc + coef * Number(padded[i]), 0);
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

export function isValidCedulaUy(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 8) return false;
  const checkDigit = Number(digits[digits.length - 1]);
  const base = digits.slice(0, digits.length - 1);
  return computeCedulaUyCheckDigit(base) === checkDigit;
}

/** Pasaporte uruguayo: una letra + hasta 7 dígitos (formato, sin checksum público). */
export function isValidPasaporteUy(value: string): boolean {
  return /^[A-Za-z]\d{5,7}$/.test(value.trim());
}

/**
 * Letra de control del DNI/NIE español: resto de dividir el número entre 23,
 * indexado en esta tabla oficial. Caso de prueba: 12345678 -> Z (12345678Z).
 */
const DNI_CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

function normalizeSpanishDocument(value: string): string {
  return value.replace(/[\s.-]/g, '').toUpperCase();
}

/** DNI español: 8 dígitos + letra de control (se aceptan espacios, puntos y guiones). */
export function isValidDni(value: string): boolean {
  const match = /^(\d{8})([A-Z])$/.exec(normalizeSpanishDocument(value));
  if (!match) return false;
  return DNI_CONTROL_LETTERS[Number(match[1]) % 23] === match[2];
}

/**
 * NIE español: X/Y/Z + 7 dígitos + letra de control. La letra inicial se
 * sustituye por 0/1/2 y se aplica el mismo cálculo que al DNI.
 * Caso de prueba: X1234567L.
 */
export function isValidNie(value: string): boolean {
  const match = /^([XYZ])(\d{7})([A-Z])$/.exec(normalizeSpanishDocument(value));
  if (!match) return false;
  const number = Number('XYZ'.indexOf(match[1]) + match[2]);
  return DNI_CONTROL_LETTERS[number % 23] === match[3];
}

/** Cédula/pasaporte extranjero: genérico, sin formato de país conocido. */
export function isValidGenericForeignDocument(value: string): boolean {
  return /^[A-Za-z0-9]{5,20}$/.test(value.trim());
}

export function isValidIdentityDocument(value: string, type: IdentityDocumentType): boolean {
  switch (type) {
    case 'cedula_uy':
      return isValidCedulaUy(value);
    case 'pasaporte_uy':
      return isValidPasaporteUy(value);
    case 'dni':
      return isValidDni(value);
    case 'nie':
      return isValidNie(value);
    case 'cedula_ext':
    case 'pasaporte_ext':
      return isValidGenericForeignDocument(value);
    default:
      return false;
  }
}
