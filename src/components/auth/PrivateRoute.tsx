
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

  const isLoginPage = pathname === `/${locale}/login`;

  React.useEffect(() => {
    if (!isLoading) {
      if (!user && !isLoginPage) {
        router.replace(`/${locale}/login`);
      } else if (user && isLoginPage) {
        router.replace(`/${locale}`);
      }
    }
  }, [user, isLoading, isLoginPage, router, locale]);

  if (isLoading && !isLoginPage) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user && !isLoginPage) {
    return null; // or a loading spinner, since the redirect is happening
  }

  if (user && isLoginPage) {
     return null;
  }

  if (isLoginPage) {
    return <>{children}</>;
  }
  
  if (user) {
    return (
      <SidebarProvider>
        <div className="grid min-h-screen w-full md:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr]">
          <Sidebar />
          <div className="flex flex-col bg-gradient-to-b from-gray-300 to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
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
