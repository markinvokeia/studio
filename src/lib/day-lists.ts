import { formatDate } from '@/lib/utils';

/**
 * Lista desde lo que devuelva la API para una columna array: un array JSON, el
 * literal de Postgres (`{1,3}`) si el driver no lo parsea, o el valor escalar
 * de la columna previa a los scripts 138/139 (`day_of_week`, `date`, …).
 */
function toList(value: unknown, fallback: unknown): string[] {
  const source = value ?? fallback;
  if (source == null || source === '') return [];
  if (Array.isArray(source)) return source.filter((v) => v != null && v !== '').map(String);
  const text = String(source);
  if (text.startsWith('{') && text.endsWith('}')) {
    return text.slice(1, -1).split(',').map((v) => v.replace(/"/g, '').trim()).filter((v) => v && v !== 'NULL');
  }
  return [text];
}

/** Enteros únicos y ordenados (días de la semana o del mes). */
export function parseNumberList(value: unknown, fallback?: unknown): number[] {
  const nums = toList(value, fallback).map(Number).filter((n) => Number.isInteger(n));
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

/** Fechas `yyyy-MM-dd` únicas y ordenadas. */
export function parseDateList(value: unknown, fallback?: unknown): string[] {
  return Array.from(new Set(toList(value, fallback).map((d) => formatDate(d)))).sort();
}
