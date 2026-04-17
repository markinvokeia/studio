'use client';

import { Header } from '@/components/header';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Sidebar } from '../sidebar';

interface PrivateRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requiredAnyPermission?: string[];
  fallback?: React.ReactNode;
}

export function PrivateRoute({
  children,
  requiredPermission,
  requiredPermissions,
  requiredAnyPermission,
  fallback = null,
}: PrivateRouteProps) {
  const { user, isLoading } = useAuth();
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissions();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  const isPublicPage = pathname === `/${locale}/login` || pathname.startsWith(`/${locale}/reset-password`) || pathname.startsWith(`/${locale}/set-first-password`);
  const isTVScreenPage = pathname === `/${locale}/tv-display/screen`;

  React.useEffect(() => {
    if (!isLoading) {
      if (!user && !isPublicPage) {
        router.replace(`/${locale}/login`);
      } else if (user && isPublicPage && !pathname.startsWith(`/${locale}/reset-password`) && !pathname.startsWith(`/${locale}/set-first-password`)) {
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
    return null;
  }

  if (user && isPublicPage && !pathname.startsWith(`/${locale}/reset-password`) && !pathname.startsWith(`/${locale}/set-first-password`)) {
    return null;
  }

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (user) {
    // TV screen page renders without nav/sidebar layout
    if (isTVScreenPage) {
      return <>{children}</>;
    }

    const hasAccess = !requiredPermission || hasPermission(requiredPermission);
    const hasAllAccess = !requiredPermissions || hasAllPermissions(requiredPermissions);
    const hasAnyAccess = !requiredAnyPermission || hasAnyPermission(requiredAnyPermission);

    if (!hasAccess || !hasAllAccess || !hasAnyAccess) {
      if (fallback) {
        return <>{fallback}</>;
      }
      return (
        <AuthenticatedLayout>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Acceso Denegado</h2>
              <p className="text-muted-foreground mt-2">No tienes permisos para acceder a esta página.</p>
            </div>
          </div>
        </AuthenticatedLayout>
      );
    }

    return (
      <AuthenticatedLayout>
        {children}
      </AuthenticatedLayout>
    );
  }

  return null;
}

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

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar />
      <div className={cn("flex flex-col flex-1 transition-all duration-300 ml-0 sm:ml-20 min-w-0 h-full overflow-hidden")}>
        <Header />
        <main className="flex-1 flex flex-col min-h-0 bg-background px-4 lg:px-6 pb-8 lg:pb-6 pt-0 overflow-hidden relative">
          <div className="flex-1 flex flex-col min-h-0 pt-12 sm:pt-4 lg:pt-6 overflow-hidden relative">
            {children}
          </div>
        </main>
        <footer className="sm:hidden flex-none h-6 flex items-center justify-center bg-[var(--nav-bg)] px-4">
          <p className="text-[10px] text-white/70 select-none">
            © Invoke IA 2025 ·{' '}
            <a
              href="https://www.invokeia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors"
            >
              www.invokeia.com
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
