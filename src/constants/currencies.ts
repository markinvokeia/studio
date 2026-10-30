/**
 * Catálogo de monedas de la aplicación.
 *
 * Es deliberadamente estático y vive en el frontend: el único dato que se
 * persiste es `clinic.currency` (un código ISO 4217 de 3 letras, que ya existe
 * en la BD). No hay tabla `currencies` ni endpoint que devuelva este listado,
 * porque el conjunto de monedas del mundo no cambia con la frecuencia que
 * justificaría administrarlo.
 *
 * El `code` es lo único que viaja al backend; el resto de campos son
 * exclusivamente de presentación y de arqueo de caja.
 */

export interface CurrencyDef {
  /** ISO 4217, 3 letras mayúsculas. Es lo que se manda y se guarda. */
  code: string;
  /** Nombre en español, para el selector de configuración. */
  name: string;
  /** Símbolo corto para importes. */
  symbol: string;
  /** Decimales con los que se muestran los importes. */
  decimals: number;
  /** Locale de `Intl.NumberFormat` (separadores de miles y decimales). */
  locale: string;
  /** Billetes en circulación, de mayor a menor. Para el arqueo de caja. */
  denominations?: number[];
  /** Monedas en circulación, de mayor a menor. Para el arqueo de caja. */
  coins?: number[];
  /**
   * Imágenes de billetes/monedas para el conteo físico. Solo las tienen UYU y
   * USD, que son las que traen SVGs en `public/billetes`. El resto cuenta sin
   * imagen.
   */
  imageMap?: Record<number, string>;
}

/** Imágenes de billetes y monedas uruguayos (`public/billetes`). */
const UYU_IMAGES: Record<number, string> = {
  2000: '/billetes/billete_2000.svg',
  1000: '/billetes/billete_1000.svg',
  500: '/billetes/billete_500.svg',
  200: '/billetes/billete_200.svg',
  100: '/billetes/billete_100.svg',
  50: '/billetes/billete_50.svg',
  20: '/billetes/billete_20.svg',
  10: '/billetes/moneda_10.svg',
  5: '/billetes/moneda_5.svg',
  2: '/billetes/moneda_2.svg',
  1: '/billetes/moneda_1.svg',
};

/** Imágenes de billetes estadounidenses (`public/billetes/usd`). */
const USD_IMAGES: Record<number, string> = {
  100: '/billetes/usd/USD_billete_100.svg',
  50: '/billetes/usd/USD_billete_50.svg',
  20: '/billetes/usd/USD_billete_20.svg',
  10: '/billetes/usd/USD_billete_10.svg',
  5: '/billetes/usd/USD_billete_5.svg',
  1: '/billetes/usd/USD_billete_1.svg',
};

export const CURRENCIES: readonly CurrencyDef[] = [
  {
    code: 'USD',
    name: 'Dólar estadounidense',
    symbol: 'US$',
    decimals: 2,
    locale: 'en-US',
    denominations: [100, 50, 20, 10, 5, 1],
    coins: [],
    imageMap: USD_IMAGES,
  },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    decimals: 2,
    locale: 'es-ES',
    denominations: [500, 200, 100, 50, 20, 10, 5],
    coins: [2, 1],
  },
  {
    code: 'UYU',
    name: 'Peso uruguayo',
    symbol: '$U',
    decimals: 2,
    locale: 'es-UY',
    denominations: [2000, 1000, 500, 200, 100, 50, 20],
    coins: [10, 5, 2, 1],
    imageMap: UYU_IMAGES,
  },
  {
    code: 'ARS',
    name: 'Peso argentino',
    symbol: '$',
    decimals: 2,
    locale: 'es-AR',
    denominations: [20000, 10000, 2000, 1000, 500, 200, 100],
    coins: [50, 10],
  },
  {
    code: 'BOB',
    name: 'Boliviano',
    symbol: 'Bs',
    decimals: 2,
    locale: 'es-BO',
    denominations: [200, 100, 50, 20, 10],
    coins: [5, 2, 1],
  },
  {
    code: 'BRL',
    name: 'Real brasileño',
    symbol: 'R$',
    decimals: 2,
    locale: 'pt-BR',
    denominations: [200, 100, 50, 20, 10, 5, 2],
    coins: [1],
  },
  {
    code: 'CLP',
    name: 'Peso chileno',
    symbol: '$',
    decimals: 0,
    locale: 'es-CL',
    denominations: [20000, 10000, 5000, 2000, 1000],
    coins: [500, 100, 50, 10],
  },
  {
    code: 'COP',
    name: 'Peso colombiano',
    symbol: '$',
    decimals: 0,
    locale: 'es-CO',
    denominations: [100000, 50000, 20000, 10000, 5000, 2000],
    coins: [1000, 500, 200, 100, 50],
  },
  {
    code: 'CRC',
    name: 'Colón costarricense',
    symbol: '₡',
    decimals: 2,
    locale: 'es-CR',
    denominations: [20000, 10000, 5000, 2000, 1000],
    coins: [500, 100, 50, 25, 10, 5],
  },
  {
    code: 'CUP',
    name: 'Peso cubano',
    symbol: '$',
    decimals: 2,
    locale: 'es-CU',
    denominations: [1000, 500, 200, 100, 50, 20, 10, 5, 3, 1],
    coins: [5, 3, 1],
  },
  {
    code: 'DOP',
    name: 'Peso dominicano',
    symbol: 'RD$',
    decimals: 2,
    locale: 'es-DO',
    denominations: [2000, 1000, 500, 200, 100, 50],
    coins: [25, 10, 5, 1],
  },
  {
    code: 'GTQ',
    name: 'Quetzal guatemalteco',
    symbol: 'Q',
    decimals: 2,
    locale: 'es-GT',
    denominations: [200, 100, 50, 20, 10, 5, 1],
    coins: [1],
  },
  {
    code: 'HNL',
    name: 'Lempira hondureño',
    symbol: 'L',
    decimals: 2,
    locale: 'es-HN',
    denominations: [500, 200, 100, 50, 20, 10, 5, 2, 1],
    coins: [1],
  },
  {
    code: 'MXN',
    name: 'Peso mexicano',
    symbol: '$',
    decimals: 2,
    locale: 'es-MX',
    denominations: [1000, 500, 200, 100, 50, 20],
    coins: [20, 10, 5, 2, 1],
  },
  {
    code: 'NIO',
    name: 'Córdoba nicaragüense',
    symbol: 'C$',
    decimals: 2,
    locale: 'es-NI',
    denominations: [1000, 500, 200, 100, 50, 20, 10],
    coins: [5, 1],
  },
  {
    code: 'PAB',
    name: 'Balboa panameño',
    symbol: 'B/.',
    decimals: 2,
    locale: 'es-PA',
    denominations: [100, 50, 20, 10, 5, 1],
    coins: [1],
  },
  {
    code: 'PEN',
    name: 'Sol peruano',
    symbol: 'S/',
    decimals: 2,
    locale: 'es-PE',
    denominations: [200, 100, 50, 20, 10],
    coins: [5, 2, 1],
  },
  {
    code: 'PYG',
    name: 'Guaraní paraguayo',
    symbol: '₲',
    decimals: 0,
    locale: 'es-PY',
    denominations: [100000, 50000, 20000, 10000, 5000, 2000],
    coins: [1000, 500, 100, 50],
  },
  {
    code: 'VES',
    name: 'Bolívar venezolano',
    symbol: 'Bs.',
    decimals: 2,
    locale: 'es-VE',
    denominations: [500, 200, 100, 50, 20, 10, 5],
    coins: [1],
  },
  {
    code: 'GBP',
    name: 'Libra esterlina',
    symbol: '£',
    decimals: 2,
    locale: 'en-GB',
    denominations: [50, 20, 10, 5],
    coins: [2, 1],
  },
  {
    code: 'CHF',
    name: 'Franco suizo',
    symbol: 'CHF',
    decimals: 2,
    locale: 'de-CH',
    denominations: [1000, 200, 100, 50, 20, 10],
    coins: [5, 2, 1],
  },
  {
    code: 'CAD',
    name: 'Dólar canadiense',
    symbol: 'CA$',
    decimals: 2,
    locale: 'en-CA',
    denominations: [100, 50, 20, 10, 5],
    coins: [2, 1],
  },
  {
    code: 'AUD',
    name: 'Dólar australiano',
    symbol: 'A$',
    decimals: 2,
    locale: 'en-AU',
    denominations: [100, 50, 20, 10, 5],
    coins: [2, 1],
  },
  {
    code: 'JPY',
    name: 'Yen japonés',
    symbol: '¥',
    decimals: 0,
    locale: 'ja-JP',
    denominations: [10000, 5000, 2000, 1000],
    coins: [500, 100, 50, 10, 5, 1],
  },
  {
    code: 'CNY',
    name: 'Yuan chino',
    symbol: '¥',
    decimals: 2,
    locale: 'zh-CN',
    denominations: [100, 50, 20, 10, 5, 1],
    coins: [1],
  },
  {
    code: 'INR',
    name: 'Rupia india',
    symbol: '₹',
    decimals: 2,
    locale: 'en-IN',
    denominations: [500, 200, 100, 50, 20, 10],
    coins: [20, 10, 5, 2, 1],
  },
  {
    code: 'ZAR',
    name: 'Rand sudafricano',
    symbol: 'R',
    decimals: 2,
    locale: 'en-ZA',
    denominations: [200, 100, 50, 20, 10],
    coins: [5, 2, 1],
  },
  {
    code: 'MAD',
    name: 'Dírham marroquí',
    symbol: 'DH',
    decimals: 2,
    locale: 'fr-MA',
    denominations: [200, 100, 50, 20],
    coins: [10, 5, 2, 1],
  },
  {
    code: 'AED',
    name: 'Dírham de los Emiratos',
    symbol: 'AED',
    decimals: 2,
    locale: 'ar-AE',
    denominations: [1000, 500, 200, 100, 50, 20, 10, 5],
    coins: [1],
  },
  {
    code: 'TRY',
    name: 'Lira turca',
    symbol: '₺',
    decimals: 2,
    locale: 'tr-TR',
    denominations: [200, 100, 50, 20, 10, 5],
    coins: [1],
  },
  {
    code: 'RUB',
    name: 'Rublo ruso',
    symbol: '₽',
    decimals: 2,
    locale: 'ru-RU',
    denominations: [5000, 2000, 1000, 500, 200, 100, 50],
    coins: [10, 5, 2, 1],
  },
  {
    code: 'PLN',
    name: 'Esloti polaco',
    symbol: 'zł',
    decimals: 2,
    locale: 'pl-PL',
    denominations: [500, 200, 100, 50, 20, 10],
    coins: [5, 2, 1],
  },
  {
    code: 'SEK',
    name: 'Corona sueca',
    symbol: 'kr',
    decimals: 2,
    locale: 'sv-SE',
    denominations: [1000, 500, 200, 100, 50],
    coins: [10, 5, 2, 1],
  },
  {
    code: 'NOK',
    name: 'Corona noruega',
    symbol: 'kr',
    decimals: 2,
    locale: 'nb-NO',
    denominations: [1000, 500, 200, 100, 50],
    coins: [20, 10, 5, 1],
  },
  {
    code: 'DKK',
    name: 'Corona danesa',
    symbol: 'kr',
    decimals: 2,
    locale: 'da-DK',
    denominations: [1000, 500, 200, 100, 50],
    coins: [20, 10, 5, 2, 1],
  },
] as const;

/** Moneda con la que arranca la app mientras no se sabe la de la clínica. */
export const DEFAULT_CURRENCY = 'USD';

/**
 * Par para el que existe un feed automático de cotización (BROU). Cuando la
 * clínica configura exactamente este par, la cotización se puede rellenar
 * sola; con cualquier otro par, el tipo de cambio se carga a mano al abrir la
 * caja, que es como ya funcionaba `date_rate`.
 */
export const AUTO_RATE_PAIR = { base: 'UYU', quote: 'USD' } as const;

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/**
 * Definición de una moneda. Tolerante a propósito: un registro histórico puede
 * traer un código que no esté en el catálogo, y en ese caso se devuelve una
 * definición sintética que usa el propio código como símbolo, en vez de
 * romper el renderizado o mentir mostrando otra moneda.
 */
export function getCurrency(code?: string | null): CurrencyDef {
  const normalized = normalizeCurrencyCode(code);
  const found = normalized ? CURRENCY_BY_CODE.get(normalized) : undefined;
  if (found) return found;
  if (normalized) {
    return { code: normalized, name: normalized, symbol: normalized, decimals: 2, locale: 'en-US' };
  }
  return CURRENCY_BY_CODE.get(DEFAULT_CURRENCY)!;
}

/** `true` si el código está en el catálogo. */
export function isKnownCurrency(code?: string | null): boolean {
  const normalized = normalizeCurrencyCode(code);
  return !!normalized && CURRENCY_BY_CODE.has(normalized);
}

/**
 * Lleva el código a la forma canónica (3 letras mayúsculas) o devuelve
 * `undefined` si no lo es. El backend siempre recibe esta forma.
 */
export function normalizeCurrencyCode(code?: string | null): string | undefined {
  if (typeof code !== 'string') return undefined;
  const upper = code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : undefined;
}
