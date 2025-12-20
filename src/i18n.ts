import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es'];

export default getRequestConfig(async () => {
  const locale = 'es'; // Fallback or dynamic logic if needed, but next-intl usually handles this

  return {
    locale,
    messages: (await import(`../src/messages/${locale}.json`)).default,
  };
});
