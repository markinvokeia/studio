import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { locales } from './i18n';
import { LOCALE_COOKIE } from './lib/locale';

const handleI18nRouting = createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when the device language is not one of `locales` (p. ej. pt-BR => es)
  defaultLocale: 'es',

  // Always show the locale in the URL
  localePrefix: 'always',

  // Orden de resolución: prefijo de la URL > cookie NEXT_LOCALE (elección
  // explícita en el menú) > idioma del dispositivo (Accept-Language) > defaultLocale.
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  // next-intl reescribe NEXT_LOCALE con un año de vigencia cada vez que se visita
  // una URL con prefijo, así que entrar una sola vez a /en/... (un enlace
  // compartido, un bookmark) dejaba al usuario en inglés para siempre aunque su
  // equipo estuviera en español. La cookie se sigue LEYENDO —para que la elección
  // del menú gane sobre el idioma del dispositivo— pero acá se descarta la
  // escritura automática: la única que la fija es `rememberLocale`
  // (`src/lib/locale.ts`), que llama el selector de idioma.
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const withoutLocaleCookie = setCookies.filter((cookie) => !cookie.startsWith(`${LOCALE_COOKIE}=`));

  if (withoutLocaleCookie.length !== setCookies.length) {
    response.headers.delete('set-cookie');
    withoutLocaleCookie.forEach((cookie) => response.headers.append('set-cookie', cookie));
  }

  return response;
}

export const config = {
  // Skip all paths that should not be internationalized
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
