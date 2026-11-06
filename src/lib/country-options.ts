import { CountryCode, getCountryCallingCode } from 'libphonenumber-js/min';

import { countries } from '@/lib/countries';

export interface CountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  /** Nombres ya normalizados por los que se encuentra el país. */
  searchNames: string[];
}

// El país se reconoce también en inglés y en español aunque la interfaz esté en otro idioma:
// quien busca "Spain" con la interfaz en español tiene que encontrar España.
const SEARCH_LOCALES = ['en', 'es'];

/** Sin mayúsculas ni acentos: "Espana" encuentra "España". */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const regionNames = (locale: string): Intl.DisplayNames | null => {
  try {
    return new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' });
  } catch {
    return null;
  }
};

/** Países con el nombre en `locale`, ordenados según ese idioma. */
export const getCountryOptions = (locale: string): CountryOption[] => {
  const display = regionNames(locale);
  const searchDisplays = SEARCH_LOCALES.map(regionNames);

  const collator = new Intl.Collator(locale);
  return countries
    .map(({ value: code, label }) => {
      const names = [display?.of(code), label, ...searchDisplays.map((d) => d?.of(code))];
      return {
        code,
        name: display?.of(code) ?? label,
        callingCode: getCountryCallingCode(code),
        searchNames: [...new Set(names.filter((n): n is string => !!n).map(normalize))],
      };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
};

/**
 * Filtro de cmdk para `CommandItem value={code} keywords={searchNames}`. Devuelve 0 si no coincide.
 *
 * Reemplaza al de cmdk, que acepta subsecuencias: "Spain" también traía "Saint Pierre and Miquelon"
 * y bastaba mover el ratón sobre esa fila para que Enter la eligiera.
 */
export const filterCountry = (code: string, search: string, searchNames: string[] = []): number => {
  const query = normalize(search);
  if (!query) return 1;

  if (/^\+?\d+$/.test(query)) {
    const digits = query.replace('+', '');
    const callingCode = getCountryCallingCode(code as CountryCode);
    if (callingCode === digits) return 1;
    return callingCode.startsWith(digits) ? 0.7 : 0;
  }

  let score = 0;
  for (const name of searchNames) {
    if (name === query) return 1;
    if (name.startsWith(query)) score = Math.max(score, 0.9);
    else if (name.includes(` ${query}`)) score = Math.max(score, 0.8);
    else if (name.includes(query)) score = Math.max(score, 0.6);
  }
  return score;
};
