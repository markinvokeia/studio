import type { useTranslations } from 'next-intl';

export type PrintTranslator = ReturnType<typeof useTranslations>;

/**
 * Translates a status code (e.g. "booked", "not_paid") to its `PrintTemplates.<namespace>`
 * label, falling back to the raw value. The code is normalized first because the API
 * mixes casings and separators for the same status ("Confirmed", "not invoiced").
 */
export function translateStatus(t: PrintTranslator, namespace: string, value: string | undefined | null): string {
  if (!value) return '';
  const code = String(value).trim().toLowerCase().replace(/\s+/g, '_');
  const key = `${namespace}.${code}`;
  return t.has(key) ? t(key) : value;
}
