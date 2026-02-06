
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { locales } from '@/i18n';
import { AuthProvider } from '@/context/AuthContext';
import { AlertNotificationsProvider } from '@/context/alert-notifications-context';
import { PrivateRoute } from '@/components/auth/PrivateRoute';


export const metadata: Metadata = {
  title: 'InvokeAI Command Center',
  description: 'AI-powered command center for your business data.',
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();

  const messages = await getMessages();

return (
    <AuthProvider>
      <AlertNotificationsProvider>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PrivateRoute>
            {children}
          </PrivateRoute>
        </NextIntlClientProvider>
        <Toaster />
      </AlertNotificationsProvider>
    </AuthProvider>
  );
}
