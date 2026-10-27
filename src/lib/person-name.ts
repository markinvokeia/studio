/**
 * Validación del nombre de una persona (pacientes).
 *
 * Se aceptan letras de cualquier alfabeto (acentos, ñ, ü, ç…) separadas por un
 * único espacio, guion (María-José), apóstrofo (O'Neill, D’Angelo) o punto de
 * abreviatura ("Ma. José", "Jr."). No se aceptan números ni otros símbolos: en
 * la base hay fichas con el documento o el teléfono metidos en el nombre.
 *
 * No exige nombre y apellido ni corrige mayúsculas: es una decisión de la
 * clínica (por WhatsApp a veces solo se conoce el nombre).
 *
 * La misma regla vive en n8n (`/users/upsert` y el registro del portal); si se
 * cambia acá, hay que cambiarla allá.
 */

export const PERSON_NAME_MAX_LENGTH = 120;

// Con `new RegExp` y no un literal: el target de TypeScript (ES2017) no admite
// escapes de propiedad Unicode (`\p{L}`) en literales.
const PERSON_NAME_PATTERN = new RegExp("^[\\p{L}\\p{M}]+(?:(?:\\. ?|[ '’-])[\\p{L}\\p{M}]+)*\\.?$", 'u');
const LETTER_PATTERN = new RegExp('\\p{L}', 'gu');

export type PersonNameIssue = 'required' | 'invalid' | 'tooShort' | 'tooLong';

/** Quita espacios en los extremos y colapsa los repetidos. No toca mayúsculas. */
export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Motivo por el que el nombre no es válido, o `null` si lo es. */
export function getPersonNameIssue(value: string | null | undefined): PersonNameIssue | null {
  const name = normalizePersonName(value ?? '');
  if (!name) return 'required';
  if (name.length > PERSON_NAME_MAX_LENGTH) return 'tooLong';
  if (!PERSON_NAME_PATTERN.test(name)) return 'invalid';
  if ((name.match(LETTER_PATTERN) ?? []).length < 2) return 'tooShort';
  return null;
}

export function isValidPersonName(value: string | null | undefined): boolean {
  return getPersonNameIssue(value) === null;
}
