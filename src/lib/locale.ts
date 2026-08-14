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
