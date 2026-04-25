
import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'InvokeAI Command Center',
  description: 'AI-powered command center for your business data.',
};

// The app's root layout, which applies to all locales.
// This is a great place to add metadata, fonts, and other global styles.
// https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates#root-layout-required
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          themes={['light', 'dark', 'claro']}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
