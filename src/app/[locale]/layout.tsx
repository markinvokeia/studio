
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { locales } from '@/i18n';
import { AuthProvider } from '@/context/AuthContext';
import { AlertNotificationsProvider } from '@/context/alert-notifications-context';
import { TVDisplayProvider } from '@/context/tv-display-context';
import { PrivateRoute } from '@/components/auth/PrivateRoute';
import { NotificationsProvider } from '@/context/notifications-context';
import { ClinicPreferencesInitializer } from '@/components/clinic/ClinicPreferencesInitializer';
import { LicenseInitializer } from '@/components/license/LicenseInitializer';
import type { RuntimeConfig } from '@/lib/runtime-config';


export const metadata: Metadata = {
  title: 'InvokeAI Command Center',
  description: 'AI-powered command center for your business data.',
};

function serializeRuntimeConfig(config: RuntimeConfig): string {
  return JSON.stringify(config).replace(/</g, '\\u003c');
}

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
  const runtimeConfig: RuntimeConfig = {
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
    licenseKey: process.env.NEXT_PUBLIC_LICENSE_KEY ?? '',
    masterSec: process.env.NEXT_PUBLIC_MASTER_SEC ?? '',
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID ?? '',
    eventPusherKey: process.env.NEXT_PUBLIC_EVENT_PUSHER_KEY ?? '',
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__INVOKEIA_RUNTIME_CONFIG__=${serializeRuntimeConfig(runtimeConfig)};`,
        }}
      />
      <AuthProvider>
        <AlertNotificationsProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                const observerError = 'ResizeObserver loop completed with undelivered notifications.';
                window.addEventListener('error', (event) => {
                  if (event.message === observerError || event.message === 'ResizeObserver loop limit exceeded') {
                    event.stopImmediatePropagation();
                  }
                });
              `,
            }}
          />
          <TVDisplayProvider>
            <NotificationsProvider>
              <PrivateRoute>
                <LicenseInitializer />
                <ClinicPreferencesInitializer />
                {children}
              </PrivateRoute>
            </NotificationsProvider>
          </TVDisplayProvider>
          </NextIntlClientProvider>
          <Toaster />
        </AlertNotificationsProvider>
      </AuthProvider>
    </>
  );
}
