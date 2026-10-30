
import { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'InvokeAI Command Center',
  description: 'AI-powered command center for your business data.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Necesario para que env(safe-area-inset-*) devuelva valores reales en iPhone.
  viewportFit: 'cover',
};

// The app's root layout, which applies to all locales.
// This is a great place to add metadata, fonts, and other global styles.
// https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates#root-layout-required
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        {/* Apply the saved table density before paint to avoid a flash of the default density. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=localStorage.getItem('table-density');if(d==='comfortable'||d==='compact'){document.documentElement.setAttribute('data-density',d);}}catch(e){}})();`,
          }}
        />
        <meta name="google" content="notranslate" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {/* `light` es el tema Invoke (el violeta corporativo, definido en `:root`).
            Es el que se aplica mientras el usuario no elija otro en el menú: antes el
            default era `system`, así que en un equipo en modo oscuro la app arrancaba
            en Oscuro sin que nadie lo hubiera pedido. `enableSystem` queda apagado
            porque el menú solo ofrece Invoke / Claro / Oscuro, nunca "seguir al
            sistema". Quien ya eligió conserva su tema: next-themes solo escribe en
            localStorage cuando se llama a `setTheme`. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
          themes={['light', 'dark', 'claro']}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
