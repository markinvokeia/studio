
'use client';

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider } from '@/hooks/use-sidebar';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { FloatingActionsWrapper } from '@/components/floating-actions-wrapper';
import { useLocale } from 'next-intl';

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  const isPublicPage = pathname === `/${locale}/login` || pathname.startsWith(`/${locale}/reset-password`) || pathname.startsWith(`/${locale}/set-first-password`);

  React.useEffect(() => {
    if (!isLoading) {
      if (!user && !isPublicPage) {
        router.replace(`/${locale}/login`);
      } else if (user && isPublicPage && !pathname.startsWith(`/${locale}/reset-password`) && !pathname.startsWith(`/${locale}/set-first-password`)) { // Allow authenticated users on reset/set password
        router.replace(`/${locale}`);
      }
    }
  }, [user, isLoading, isPublicPage, pathname, router, locale]);

  if (isLoading && !isPublicPage) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user && !isPublicPage) {
    return null; // or a loading spinner, since the redirect is happening
  }

  if (user && isPublicPage && !pathname.startsWith(`/${locale}/reset-password`) && !pathname.startsWith(`/${locale}/set-first-password`)) {
     return null;
  }

  if (isPublicPage) {
    return <>{children}</>;
  }
  
  if (user) {
    return (
      <SidebarProvider>
        <div className="grid min-h-screen w-full md:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr]">
          <Sidebar />
          <div className="flex flex-col bg-gradient-to-b from-gray-300 to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
        <FloatingActionsWrapper />
      </SidebarProvider>
    );
  }

  return null;
}
