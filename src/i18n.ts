
import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';

export const locales = ['en', 'es'];

export default getRequestConfig(async ({locale}) => {
  if (!locales.includes(locale as any)) notFound();

  return {
    locale, // Explicitly return the locale
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
