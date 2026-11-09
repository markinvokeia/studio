import {
  AsYouType,
  getCountryCallingCode,
  Metadata,
  validatePhoneNumberLength,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js/min';

import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import { getAreaCodes, getDialDigits, isAreaDialDigits } from '@/lib/phone-area-codes';

export interface ParsedPhoneText {
  /** Valor que el campo entrega al formulario: E.164 si se pudo interpretar, si no el texto tal cual ('' si está vacío). */
  value: string;
  /** Número interpretado, si lo hay (puede ser inválido, p. ej. demasiado corto). */
  number?: PhoneNumber;
  /**
   * Otra lectura igual de válida: los dígitos son un número nacional válido del país
   * seleccionado y también un número internacional válido de otro país (sólo con `detectCallingCode`).
   */
  alternative?: PhoneNumber;
}

export interface ParsePhoneTextOptions {
  /**
   * Reconocer un código internacional aunque el texto no empiece con `+` (p. ej. "919876543210").
   * Se usa al pegar y al salir del campo, no tecla a tecla: un número local a medio escribir
   * puede parecer internacional y cambiaría el país bajo los dedos del usuario.
   */
  detectCallingCode?: boolean;
}

/** Lo que muestra y entrega el campo de teléfono tras una edición. */
export interface PhoneEdit {
  /** Texto del input, siempre en formato internacional ("+598 93 098 237"). */
  text: string;
  /** Valor para el formulario: E.164, o '' si sólo está el prefijo. */
  value: string;
  /** País reconocido; `undefined` mientras el prefijo no alcanza para saberlo ("+5"). */
  country?: CountryCode;
  /** El prefijo lo puso el campo: el usuario pudo haber querido escribir otro país. */
  assumed: boolean;
  alternative?: PhoneNumber;
}

/**
 * Desde esta cantidad de dígitos ya no parece un número local a medio escribir, así que se
 * puede pasar a otro país sin esperar a que salga del campo. No alcanza con mirar las
 * longitudes del país: Uruguay, por ejemplo, admite hasta 13 dígitos.
 */
const MIN_DIGITS_TO_SWITCH_COUNTRY_WHILE_TYPING = 10;

/**
 * Hasta acá, si los dígitos no pueden empezar un número del país es que traen otro código. Más
 * adelante ya no: un dígito de más en un celular ("930982371") saltaría a Afganistán (+93).
 */
const MAX_DIGITS_TO_RULE_OUT_LOCAL = 3;

const parseWith = (text: string, country?: CountryCode): PhoneNumber | undefined => {
  const asYouType = new AsYouType(country);
  asYouType.input(text);
  return asYouType.getNumber();
};

/** "+598 93 098 237" → "+59893098237". */
const toCanonical = (text: string): string => text.replace(/[^\d+]/g, '');

const callingCodeOf = (canonical: string): string | undefined => {
  const asYouType = new AsYouType();
  asYouType.input(canonical);
  return asYouType.getCallingCode();
};

/** Vacío, un "+" o sólo el prefijo (con o sin código de área): todavía no hay un teléfono que guardar. */
export const isBarePhoneText = (text: string): boolean => {
  const canonical = toCanonical(text);
  if (!canonical || canonical === '+') return true;
  if (!canonical.startsWith('+')) return false;
  const digits = canonical.slice(1);
  return callingCodeOf(canonical) === digits || isAreaDialDigits(digits);
};

/**
 * Lo que se precarga en el campo: "+598", o con el código de área si el código internacional lo
 * comparten varios países ("+1 787" para Puerto Rico), para que se escriba sólo el número local.
 */
export const getPhonePrefix = (country: CountryCode): string => new AsYouType().input(`+${getDialDigits(country)}`);

const describeCanonical = (canonical: string, fallback?: CountryCode): Omit<PhoneEdit, 'assumed'> => {
  const asYouType = new AsYouType();
  const text = asYouType.input(canonical);
  const callingCode = asYouType.getCallingCode();
  // "+1" o "+7" los comparten varios países: se conserva el elegido hasta que los dígitos digan otro.
  const country = asYouType.getCountry()
    ?? (fallback && callingCode === getCountryCallingCode(fallback) ? fallback : undefined);
  const number = asYouType.getNumber();
  const value = isBarePhoneText(canonical) ? '' : number ? number.format('E.164') : canonical;
  return { text, value, country };
};

/**
 * Interpreta lo que el usuario escribió/pegó en el campo de teléfono con el país seleccionado.
 * Nunca devuelve '' para un texto no vacío: si no se puede interpretar se devuelve el texto
 * crudo, para que la validación lo marque inválido en vez de perder el dato.
 */
export const parsePhoneText = (
  text: string,
  country: CountryCode | undefined,
  { detectCallingCode = false }: ParsePhoneTextOptions = {},
): ParsedPhoneText => {
  const trimmed = text.trim();
  if (!trimmed) return { value: '' };

  let number = parseWith(trimmed, country);
  let alternative: PhoneNumber | undefined;

  // Ningún código de país empieza con 0: "+0…" es un "+" antepuesto a un número nacional
  // con 0 troncal (p. ej. "+099 123 456"), así que se interpreta como nacional.
  if (!number && /^\+\s*0/.test(trimmed)) {
    number = parseWith(trimmed.replace(/^\+/, ''), country);
  }

  // Sólo dígitos (con separadores) y sin 0 troncal: puede ser un internacional sin el "+".
  if (detectCallingCode && /^[1-9][\d\s().-]*$/.test(trimmed)) {
    const international = parseWith(`+${trimmed.replace(/\D/g, '')}`);
    if (international?.isValid()) {
      if (!number?.isValid()) {
        number = international;
      } else if (international.number !== number.number) {
        alternative = international;
      }
    }
  }

  return number ? { value: number.format('E.164'), number, alternative } : { value: trimmed };
};

/**
 * Quita el 0 troncal sólo donde corresponde: lo decide la metadata de cada país porque "+598 093…"
 * es "+598 93…", pero en Italia el 0 es parte del número ("+39 06…").
 */
const dropTrunkPrefix = (national: string, country?: CountryCode): string => {
  if (!national.startsWith('0') || !country) return national;
  return parseWith(national, country)?.nationalNumber ?? national;
};

export interface PhoneEditContext {
  /** País con el que leer los dígitos que no traen código. */
  country: CountryCode;
  /** Texto que había antes de esta edición. */
  previousText: string;
  /** Si el prefijo actual lo puso el campo (ver `PhoneEdit.assumed`). */
  assumed: boolean;
  /** El país se eligió a mano: los dígitos son de ese país aunque parezcan de otro. */
  countryPicked?: boolean;
}

/** Si `digits` puede ser el comienzo de un número nacional del país, según su metadata. */
const canStartNationalNumber = (digits: string, country: CountryCode): boolean => {
  const metadata = new Metadata();
  metadata.selectNumberingPlan(country);
  // `nationalNumberPattern` existe en la metadata, pero los tipos de la librería no lo declaran.
  const plan = metadata.numberingPlan as unknown as {
    possibleLengths(): number[];
    nationalNumberPattern(): string;
  } | undefined;
  if (!plan) return true;
  const pattern = new RegExp(`^(?:${plan.nationalNumberPattern()})$`);
  // El patrón sólo valida números completos: se prueba completando con dos dígitos distintos,
  // que alcanza para los rangos ("9[1-9]") con los que empiezan los patrones.
  return plan.possibleLengths().some((length) => {
    const missing = length - digits.length;
    if (missing < 0) return false;
    if (missing === 0) return pattern.test(digits);
    for (let next = 0; next <= 9; next += 1) {
      for (let rest = 0; rest <= 9; rest += 1) {
        if (pattern.test(`${digits}${next}${String(rest).repeat(missing - 1)}`)) return true;
      }
    }
    return false;
  });
};

/** Convierte lo que quedó en el input tras una tecla en el texto a mostrar y el valor a entregar. */
export const applyPhoneEdit = (
  text: string,
  { country, previousText, assumed, countryPicked = false }: PhoneEditContext,
): PhoneEdit => {
  const previous = toCanonical(previousText);
  let chars = toCanonical(text);
  if (!chars) return { text: '', value: '', country, assumed: true };

  // Un "+" escrito después del prefijo empieza otro país; en medio de un número no significa nada.
  const lastPlus = chars.lastIndexOf('+');
  if (lastPlus > 0) {
    chars = isBarePhoneText(previous) ? chars.slice(lastPlus) : `+${chars.replace(/\+/g, '')}`;
  }

  let isAssumed = assumed;
  let canonical: string;
  if (chars.startsWith('+') && !chars.startsWith('+0')) {
    canonical = chars;
    if (lastPlus > 0 || !previous.startsWith('+')) isAssumed = false;
  } else {
    const digits = chars.replace(/\+/g, '');
    // Sólo se borró el "+" de lo que ya estaba: esos dígitos ya traen su código.
    if (`+${digits}` === previous) {
      canonical = previous;
    } else {
      canonical = `${toCanonical(getPhonePrefix(country))}${digits}`;
      isAssumed = !countryPicked;
    }
  }

  const callingCode = callingCodeOf(canonical);
  if (!callingCode) return { ...describeCanonical(canonical, country), assumed: isAssumed };

  const described = describeCanonical(canonical, country);
  const national = canonical.slice(callingCode.length + 1);
  const withoutTrunk = dropTrunkPrefix(national, described.country);
  if (withoutTrunk !== national) {
    // Con el 0 local es un número nacional seguro: ya no hay otro país posible.
    return { ...describeCanonical(`+${callingCode}${withoutTrunk}`, country), assumed: false };
  }

  // Sólo al agregar dígitos: borrando no se está escribiendo otro código.
  if (
    isAssumed
    && canonical.length > previous.length
    && national.length <= MAX_DIGITS_TO_RULE_OUT_LOCAL
    && /^[1-9]/.test(national)
    && !canStartNationalNumber(national, described.country ?? country)
  ) {
    return { ...describeCanonical(`+${national}`, country), assumed: false };
  }

  if (isAssumed && national.length >= MIN_DIGITS_TO_SWITCH_COUNTRY_WHILE_TYPING) {
    const international = parseWith(`+${national}`);
    if (international?.isValid() && !parseWith(canonical)?.isValid()) {
      return { ...describeCanonical(`+${national}`, country), assumed: false };
    }
  }

  return { ...described, assumed: isAssumed };
};

/** Pegar sobre un campo vacío o con todo seleccionado: se lee lo pegado solo, aunque no traiga "+". */
export const applyPhonePaste = (pasted: string, country: CountryCode): PhoneEdit | null => {
  // "00" es la salida internacional habitual; depender del país elegido leería mal "00598…" desde Cuba.
  const chars = toCanonical(pasted).replace(/^00(?=[1-9])/, '+');
  if (!chars.replace(/\+/g, '')) return null;

  let parsed = parsePhoneText(chars, country, { detectCallingCode: true });
  // Un número local sin área ("123 4567" con Puerto Rico elegido): se le pone la del país.
  if (!parsed.number?.isValid() && !chars.startsWith('+') && getAreaCodes(country).length) {
    const withArea = parsePhoneText(`+${getDialDigits(country)}${chars}`, country);
    if (withArea.number?.isValid()) parsed = withArea;
  }
  if (!parsed.number) return applyPhoneEdit(chars, { country, previousText: '', assumed: !chars.startsWith('+') });

  return {
    ...describeCanonical(parsed.number.format('E.164'), country),
    assumed: false,
    alternative: parsed.alternative,
  };
};

/**
 * Al salir del campo: si el prefijo lo puso el campo, los dígitos pueden ser un internacional
 * escrito sin "+" (se cambia de país) o admitir las dos lecturas (se avisa, no se decide).
 */
export const finishPhoneEdit = (text: string, country: CountryCode | undefined, assumed: boolean): PhoneEdit => {
  const canonical = toCanonical(text);
  const callingCode = callingCodeOf(canonical);
  if (assumed && callingCode && country) {
    const parsed = parsePhoneText(canonical.slice(callingCode.length + 1), country, { detectCallingCode: true });
    if (parsed.number) {
      return {
        ...describeCanonical(parsed.number.format('E.164'), country),
        assumed: false,
        alternative: parsed.alternative,
      };
    }
  }
  return { ...describeCanonical(canonical, country), assumed: false };
};

/** El número local sin el código de área de `country`, si empieza con uno de ellos. */
const stripAreaCode = (national: string, country: CountryCode | undefined): string => {
  const area = country && getAreaCodes(country).find((code) => national.startsWith(code));
  return area ? national.slice(area.length) : national;
};

/**
 * Reinterpreta el número al elegir otro país a mano. Si los dígitos nacionales empiezan con el
 * código del país elegido y así forman un número válido, ese código ya estaba en lo pegado
 * ("98562848" leído como UY → Irán es +98 562848, no +98 98562848); si no, se le antepone.
 *
 * Si el país elegido tiene código de área, se cambia el del país anterior por el suyo
 * ("+1 787 123 4567" de Puerto Rico → "+1 809 123 4567" al elegir República Dominicana) o se le
 * antepone al número local, salvo que así quede demasiado largo.
 */
export const reinterpretForCountry = (text: string, from: CountryCode | undefined, to: CountryCode): PhoneEdit => {
  const national = parsePhoneText(text, from).number?.nationalNumber ?? '';
  const callingCode = getCountryCallingCode(to);
  const local = stripAreaCode(national, from);
  const withArea = `+${getDialDigits(to)}${local}`;
  const embedded = national.startsWith(callingCode) ? parseWith(`+${national}`) : undefined;
  let canonical: string;
  if (embedded?.isValid() && embedded.countryCallingCode === callingCode) canonical = `+${national}`;
  else if (getAreaCodes(to).length && (!local || validatePhoneNumberLength(withArea) !== 'TOO_LONG')) canonical = withArea;
  // Sólo estaba el área del país anterior: no es parte del número.
  else if (!local) canonical = `+${callingCode}`;
  else canonical = `+${callingCode}${national}`;
  // El país lo eligió el usuario: manda aunque el prefijo lo compartan varios ("+1").
  return { ...describeCanonical(canonical, to), country: to, assumed: false };
};

/** Lectura de un valor guardado, que puede no tener "+" ni código ("59895009988", "099 123 456"). */
const parseStoredPhone = (value: string, fallback: CountryCode): PhoneNumber | undefined => {
  const trimmed = value.trim();
  // "SIN_TELEFONO1" y similares: sacarle los dígitos inventaría un número.
  if (!trimmed || /[^\d\s().+-]/.test(trimmed)) return undefined;
  const number = parseWith(trimmed, fallback);
  if (trimmed.startsWith('+') || number?.isValid()) return number;
  if (/^[1-9]/.test(trimmed)) {
    const international = parseWith(`+${toCanonical(trimmed)}`);
    if (international?.isValid()) return international;
  }
  return undefined;
};

/** Texto a mostrar y país para un valor que llega de afuera (carga o reset del formulario). */
export const formatPhoneForDisplay = (
  value: string,
  fallback: CountryCode = DEFAULT_PHONE_COUNTRY,
): { text: string; country?: CountryCode } => {
  const number = parseStoredPhone(value, fallback);
  return number ? { text: number.formatInternational(), country: number.country } : { text: value };
};

/** Teléfono en pantallas de sólo lectura: "+598 93 098 237". Lo que no es un teléfono queda como está. */
export const formatPhoneNumber = (value: string | null | undefined): string =>
  value ? formatPhoneForDisplay(value).text : '';
