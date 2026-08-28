import type { DashboardCurrency } from '@/lib/types';

import { formatDate } from '@/lib/utils';

/**
 * Convierte una fecha `yyyy-MM-dd` del backend en un `Date` local, para poder formatear
 * nombres de mes con date-fns. Se construye desde los componentes y no con `parseISO`,
 * que aplicaría el offset de zona y podría correr el día — el mismo criterio que usa
 * `formatDisplayDateWithWeekday` en `@/lib/utils`.
 */
export function parseDateOnly(date: string | null | undefined): Date | null {
  const datePart = formatDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const SYMBOLS: Record<DashboardCurrency, string> = { UYU: '$', USD: 'US$' };

const amountFmt = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });
const countFmt = new Intl.NumberFormat('es-UY');

/** Marcador de "sin dato de origen". Distinto de un cero real, que sí se imprime. */
export const EMPTY = '—';

/**
 * Formatea un monto del panel. `null` no es 0: significa que no hay dato cargado y se
 * devuelve el guion, para no leer un `$ 0` como "no hubo movimiento".
 */
export function formatAmount(value: number | null | undefined, currency: DashboardCurrency): string {
  if (value === null || value === undefined) return EMPTY;
  return `${SYMBOLS[currency]} ${amountFmt.format(value)}`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  return countFmt.format(value);
}

/** Variación porcentual con signo, como `+10,8%`. `null` cuando no hay base de comparación. */
export function formatVariation(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${countFmt.format(pct)}%`;
}

/** Variación en unidades absolutas, para conteos donde el porcentaje engaña con bases chicas. */
export function formatVariationAbs(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${value > 0 ? '+' : ''}${countFmt.format(value)}`;
}

export type VariationTone = 'positive' | 'negative' | 'neutral';

export function variationTone(pct: number | null | undefined): VariationTone {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || pct === 0) return 'neutral';
  return pct > 0 ? 'positive' : 'negative';
}
