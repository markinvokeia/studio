import { enUS, es } from 'date-fns/locale';
import type { Locale } from 'date-fns';

/** Cookie donde vive el idioma elegido a mano. Es el nombre que usa next-intl. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Guarda el idioma que el usuario eligió en el menú.
 *
 * Es la ÚNICA forma de fijar la preferencia: el middleware ya no escribe la
 * cookie al navegar (ver `src/middleware.ts`), justamente para que abrir una URL
 * con otro prefijo no cambie el idioma para siempre. Sin cookie, cada entrada se
 * resuelve por el idioma del dispositivo.
 */
export function rememberLocale(locale: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
}

/**
 * date-fns no tiene una variante regional separada para castellano (`es-ES`)
 * vs. español latinoamericano (`es`): ambos usan el mismo `Locale` `es`. Este
 * helper centraliza el mapeo locale de next-intl -> `Locale` de date-fns para
 * no repetir `locale === 'es' ? es : enUS` (que trataría cualquier locale
 * nuevo como inglés) en cada componente que formatea fechas.
 */
export function getDateFnsLocale(locale: string): Locale {
  switch (locale) {
    case 'es':
    case 'es-ES':
      return es;
    default:
      return enUS;
  }
}
