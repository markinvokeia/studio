
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { FloatingActionsWrapper } from '@/components/floating-actions-wrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarProvider } from '@/hooks/use-sidebar';
import {NextIntlClientProvider, useMessages} from 'next-intl';
import { locales } from '@/i18n';

export const metadata: Metadata = {
  title: 'InvokeAI Command Center',
  description: 'AI-powered command center for your business data.',
};

export default function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(params.locale as any)) notFound();
  
  const messages = useMessages();
  return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
      <NextIntlClientProvider locale={params.locale} messages={messages}>
        <SidebarProvider>
            <div className="grid min-h-screen w-full md:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr]">
                <Sidebar />
                <div className="flex flex-col">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
                    {children}
                </main>
                </div>
            </div>
            <Toaster />
            <FloatingActionsWrapper />
        </SidebarProvider>
      </NextIntlClientProvider>
      </ThemeProvider>
  );
}
