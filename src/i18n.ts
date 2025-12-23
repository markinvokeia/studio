import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es'];

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || 'es';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
