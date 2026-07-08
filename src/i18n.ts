import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es'];

/**
 * Recursively merge a partial `override` object onto `base`. Only the keys
 * present in `override` are replaced; everything else falls back to `base`.
 * Used to layer per-client message overrides on top of the shared base
 * translations (see `src/messages/overrides/<clientId>/<locale>.json`).
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(out[key] ?? {}, value)
        : value;
  }
  return out as T;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || 'es';
  const base = (await import(`./messages/${locale}.json`)).default;

  // Optional per-client override: only needs to contain the keys that differ
  // from the base; anything missing is taken from `base`. Selected by the
  // deployment's NEXT_PUBLIC_CLIENT_ID (read server-side at request time).
  const client = process.env.NEXT_PUBLIC_CLIENT_ID?.trim();
  let messages = base;
  if (client) {
    try {
      const override = (await import(`./messages/overrides/${client}/${locale}.json`)).default;
      messages = deepMerge(base, override);
    } catch {
      // No override file for this client/locale — use the base as-is.
    }
  }

  return { locale, messages };
});
