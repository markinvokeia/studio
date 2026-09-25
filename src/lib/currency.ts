import { z } from 'zod';

import { DEFAULT_CURRENCY, getCurrency, normalizeCurrencyCode } from '@/constants/currencies';

/**
 * Formateo de importes. Única fuente de verdad: antes de este módulo había
 * ~40 `new Intl.NumberFormat('es-UY', …)` repartidos por reportes, plantillas
 * de impresión y pasos del wizard de cobro, cada uno con su propio locale y su
 * propio mapa de símbolos. Aquí el locale y los decimales salen de la
 * definición de la moneda, no de un literal.
 *
 * Todas las funciones aceptan un `currency` opcional: cuando no se pasa, se
 * usa `DEFAULT_CURRENCY`. Los componentes deben pasar la moneda de la clínica
 * que obtienen de `useCurrencySettings()`.
 */

/** Los formatters de `Intl` son caros de construir; se reutilizan por clave. */
const _formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${locale}|${minimumFractionDigits}|${maximumFractionDigits}`;
  const cached = _formatterCache.get(key);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits, maximumFractionDigits });
  _formatterCache.set(key, formatter);
  return formatter;
}

export interface FormatMoneyOptions {
  /** `false` imprime solo el número, sin símbolo ni código. */
  showSymbol?: boolean;
  /** Fuerza los decimales en vez de usar los de la moneda. */
  decimals?: number;
  /** Añade el código ISO entre paréntesis, como `1.234 (USD)`. */
  showCode?: boolean;
}

/**
 * Importe con símbolo, en el formato de la moneda: `US$ 1,234.50`, `1.234,50 €`.
 *
 * El símbolo va delante salvo en las monedas europeas que lo posponen; se
 * decide por el locale de la definición, no caso a caso.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency?: string | null,
  options: FormatMoneyOptions = {},
): string {
  const def = getCurrency(currency);
  const value = Number(amount ?? 0);
  const safeValue = Number.isFinite(value) ? value : 0;
  const decimals = options.decimals ?? def.decimals;

  const formatted = getFormatter(def.locale, decimals, decimals).format(safeValue);

  let result = formatted;
  if (options.showSymbol !== false) {
    result = isSuffixSymbolLocale(def.locale) ? `${formatted} ${def.symbol}` : `${def.symbol} ${formatted}`;
  }
  if (options.showCode) {
    result = `${result} (${def.code})`;
  }
  return result;
}

/**
 * Importe sin decimales, para KPIs, gráficos y tablas de reportes donde los
 * centavos son ruido. Sustituye a los `maximumFractionDigits: 0` sueltos.
 */
export function formatMoneyCompact(
  amount: number | string | null | undefined,
  currency?: string | null,
  options: Omit<FormatMoneyOptions, 'decimals'> = {},
): string {
  return formatMoney(amount, currency, { ...options, decimals: 0 });
}

/** Solo el número, con los decimales de la moneda y sin símbolo. */
export function formatAmountOnly(amount: number | string | null | undefined, currency?: string | null): string {
  return formatMoney(amount, currency, { showSymbol: false });
}

/** Símbolo de la moneda (`€`, `US$`, `$U`). */
export function currencySymbol(code?: string | null): string {
  return getCurrency(code).symbol;
}

/** Decimales con los que se muestra la moneda. */
export function currencyDecimals(code?: string | null): number {
  return getCurrency(code).decimals;
}

/**
 * Locales que posponen el símbolo (`1.234,50 €`). El resto lo antepone.
 *
 * Se listan de forma explícita en vez de derivarlo del idioma porque el
 * español se comporta de las dos maneras: España pospone, toda Latinoamérica
 * antepone. Lo mismo el portugués (Portugal pospone, Brasil antepone).
 */
const SUFFIX_SYMBOL_LOCALES = new Set([
  'es-ES',
  'fr-MA',
  'de-CH',
  'pl-PL',
  'sv-SE',
  'nb-NO',
  'da-DK',
  'tr-TR',
  'ru-RU',
]);

function isSuffixSymbolLocale(locale: string): boolean {
  return SUFFIX_SYMBOL_LOCALES.has(locale);
}

/**
 * Esquema Zod para un código de moneda. Sustituye a los `z.enum(['UYU','USD'])`
 * repartidos por los formularios: el valor válido es cualquier ISO de 3
 * letras, y el que la clínica puede elegir lo acota la UI, no el schema.
 */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'Código de moneda inválido');

/**
 * Normaliza lo que venga del backend a un código usable, cayendo al de la
 * clínica. Pensado para los `?? 'UYU'` que había repartidos por la app.
 */
export function resolveCurrency(value: unknown, fallback: string = DEFAULT_CURRENCY): string {
  return normalizeCurrencyCode(typeof value === 'string' ? value : undefined) ?? fallback;
}

/**
 * Códigos de moneda presentes en una lista de filas con campo `currency`,
 * sin repetir y en orden de aparición. Sustituye a los `['UYU','USD']` fijos
 * que había en las plantillas de impresión de caja.
 */
export function sessionCurrencyCodes(rows: Array<{ currency?: string | null }> | null | undefined): string[] {
  const codes = (rows ?? [])
    .map((row) => normalizeCurrencyCode(row?.currency))
    .filter((code): code is string => !!code);
  return [...new Set(codes)];
}

/**
 * Convierte un importe entre las dos monedas de la clínica.
 *
 * `rate` (el `exchange_rate` que ya viaja en presupuestos, facturas y cobros)
 * son unidades de la moneda **principal** por cada unidad de la secundaria.
 * De ahí que pasar de secundaria a principal sea multiplicar, y al revés,
 * dividir. Antes esta decisión estaba escrita a mano en ~20 sitios como
 * `if (from === 'USD' && to === 'UYU')`.
 *
 * Si alguna de las dos monedas no es la principal ni interviene en el par, el
 * importe se devuelve sin tocar: es preferible a inventar una conversión.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rate: number,
  primaryCurrency: string,
): number {
  const value = Number(amount) || 0;
  if (!from || !to || from === to) return value;
  const safeRate = Number(rate) || 1;
  if (to === primaryCurrency) return value * safeRate;
  if (from === primaryCurrency) return value / safeRate;
  return value;
}

/**
 * Suma de importes en varias monedas, como `1.234 (USD) / 890 (EUR)`. Las
 * monedas con saldo cero se omiten; sin ninguna, devuelve un guion.
 */
export function formatMultiCurrency(amounts: Record<string, number>): string {
  const entries = Object.entries(amounts)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '—';
  return entries.map(([code, value]) => formatMoneyCompact(value, code, { showSymbol: false, showCode: true })).join(' / ');
}
