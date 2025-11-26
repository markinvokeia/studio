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
        <div className="flex h-screen bg-background">
            <Sidebar />
            <div className={cn("flex flex-col flex-1 transition-all duration-300", activeParentItem ? 'md:ml-84' : 'md:ml-20')}>
                <Header />
                <main className="flex-1 overflow-auto bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 lg:p-6">
                    {children}
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
