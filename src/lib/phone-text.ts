import { AsYouType, getCountryCallingCode, type CountryCode, type PhoneNumber } from 'libphonenumber-js/min';

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

const parseWith = (text: string, country?: CountryCode): PhoneNumber | undefined => {
  const asYouType = new AsYouType(country);
  asYouType.input(text);
  return asYouType.getNumber();
};

/**
 * Interpreta lo que el usuario escribió/pegó en el campo de teléfono con el país seleccionado.
 * Nunca devuelve '' para un texto no vacío: si no se puede interpretar se devuelve el texto
 * crudo, para que la validación lo marque inválido en vez de perder el dato.
 */
export const parsePhoneText = (
  text: string,
  country: CountryCode,
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
 * Reinterpreta el número al elegir otro país a mano. Si los dígitos nacionales empiezan con el
 * código del país elegido y así forman un número válido, ese código ya estaba en lo pegado
 * ("98562848" leído como UY → Irán es +98 562848, no +98 98562848); si no, se le antepone.
 */
export const reinterpretForCountry = (text: string, from: CountryCode, to: CountryCode): ParsedPhoneText => {
  const national = parsePhoneText(text, from).number?.nationalNumber ?? text.replace(/^\+\d+\s/, '').trim();
  if (!national) return parsePhoneText('', to);

  const callingCode = getCountryCallingCode(to);
  if (national.startsWith(callingCode)) {
    const embedded = parsePhoneText(`+${national}`, to);
    if (embedded.number?.isValid() && embedded.number.countryCallingCode === callingCode) return embedded;
  }
  return parsePhoneText(`+${callingCode} ${national}`, to);
};

/** Texto a mostrar y país para un valor que llega de afuera (carga o reset del formulario). */
export const formatPhoneForDisplay = (value: string): { text: string; country?: CountryCode } => {
  const number = parseWith(value);
  if (number?.country) {
    return { text: number.formatNational(), country: number.country };
  }
  return { text: value };
};
