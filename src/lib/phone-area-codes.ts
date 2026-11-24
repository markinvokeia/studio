import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';

/**
 * Códigos de área de los países que comparten el código internacional con otro ("+1", "+7", "+39",
 * "+44") y se distinguen por ellos. El primero es el que se precarga al elegir el país.
 *
 * Sale de los `leadingDigits` de la metadata de libphonenumber, que vienen como expresiones
 * regulares ("8[024]9") y sin tipos públicos; por eso va escrita a mano. No llevan área los países
 * principales de cada código (EE. UU., Rusia, Italia, Reino Unido) ni los que no se distinguen por
 * una (Canadá, Guernsey, Jersey, Mayotte, San Bartolomé...).
 */
const AREA_CODES: Partial<Record<CountryCode, readonly string[]>> = {
  // +1 (Plan de Numeración de Norteamérica)
  AG: ['268'],
  AI: ['264'],
  AS: ['684'],
  BB: ['246'],
  BM: ['441'],
  BS: ['242'],
  DM: ['767'],
  DO: ['809', '829', '849'],
  GD: ['473'],
  GU: ['671'],
  JM: ['876', '658'],
  KN: ['869'],
  KY: ['345'],
  LC: ['758'],
  MP: ['670'],
  MS: ['664'],
  PR: ['787', '939'],
  SX: ['721'],
  TC: ['649'],
  TT: ['868'],
  VC: ['784'],
  VG: ['284'],
  VI: ['340'],
  // +7
  KZ: ['7'],
  // +39
  VA: ['06698'],
  // +44
  IM: ['1624', '7624', '7524'],
};

const NO_AREA_CODES: readonly string[] = [];

export const getAreaCodes = (country: CountryCode): readonly string[] => AREA_CODES[country] ?? NO_AREA_CODES;

/** Código internacional y de área sin "+", p. ej. "1787" (sólo el primero de cada país). */
export const getDialDigits = (country: CountryCode): string =>
  `${getCountryCallingCode(country)}${getAreaCodes(country)[0] ?? ''}`;

/** Todos los "código internacional + área" conocidos, sin "+": "1787", "1939", "77"... */
const AREA_DIAL_DIGITS = new Set(
  (Object.keys(AREA_CODES) as CountryCode[]).flatMap((country) =>
    getAreaCodes(country).map((area) => `${getCountryCallingCode(country)}${area}`)),
);

/** Si `digits` (sin "+") son justo un código internacional con su código de área. */
export const isAreaDialDigits = (digits: string): boolean => AREA_DIAL_DIGITS.has(digits);
