'use client';

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { FloatingActionsWrapper } from '@/components/floating-actions-wrapper';
import { useLocale } from 'next-intl';
import { Sidebar } from '../sidebar';
import { cn } from '@/lib/utils';
import { navItems } from '@/config/nav';

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();

  const getEffectivePathname = (p: string, l: string) => {
    const localePrefix = `/${l}`;
    if (p.startsWith(localePrefix)) {
      return p.substring(localePrefix.length) || '/';
    }
    return p;
  };

  const effectivePathname = getEffectivePathname(pathname, locale);
  const activeParentItem = navItems.find(item => item.href !== '/' && effectivePathname.startsWith(item.href) && item.items);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar />
      <div className={cn("flex flex-col flex-1 transition-all duration-300 ml-20 min-w-0 h-full overflow-hidden")}>
        <Header />
        <main className="flex-1 flex flex-col min-h-0 bg-background px-4 lg:px-6 pb-4 lg:pb-6 pt-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 pt-4 lg:pt-6 overflow-hidden relative">
            {children}
          </div>
        </main>
      </div>
      <FloatingActionsWrapper />
    </div>
  );
}

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
      <AuthenticatedLayout>
        {children}
      </AuthenticatedLayout>
    );
  }

  return null;
}