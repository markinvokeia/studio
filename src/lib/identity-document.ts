import type { IdentityDocumentType } from '@/lib/types';

/**
 * Validación del documento de identidad del paciente. El usuario elige el
 * tipo explícitamente (no se intenta adivinar el formato a partir del valor):
 * solo la cédula uruguaya tiene un algoritmo de verificación real y público;
 * el resto se valida solo por forma.
 */

export const IDENTITY_DOCUMENT_TYPES: IdentityDocumentType[] = [
  'cedula_uy',
  'cedula_ext',
  'pasaporte_uy',
  'pasaporte_ext',
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
    case 'cedula_ext':
    case 'pasaporte_ext':
      return isValidGenericForeignDocument(value);
    default:
      return false;
  }
}
