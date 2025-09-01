import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { FloatingActions } from '@/components/floating-actions';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarProvider } from '@/hooks/use-sidebar';

export const metadata: Metadata = {
  title: 'InvokeAI Command Center',
  description: 'AI-powered command center for your business data.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
        <SidebarProvider>
          <div className="grid min-h-screen w-full md:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr]">
              <Sidebar />
              <div className="flex flex-col">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                  {children}
                </main>
              </div>
          </div>
          <Toaster />
          <FloatingActions />
        </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
