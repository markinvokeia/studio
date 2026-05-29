'use client';

import { Header } from '@/components/header';
import { LicenseExpirationBanner } from '@/components/license/LicenseExpirationBanner';
import { LicenseExpiredScreen } from '@/components/license/LicenseExpiredScreen';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { navItems, type NavItem } from '@/config/nav';
import { DASHBOARD_PERMISSIONS } from '@/constants/permissions';
import { useLicenseStore } from '@/stores/license-store';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Sidebar } from '../sidebar';

function getFirstAccessibleHref(
  items: NavItem[],
  hasPermission: (code: string) => boolean,
  hasAnyPermission: (codes: string[]) => boolean,
): string | null {
  for (const item of items) {
    if (!item.href || item.isSeparator) continue;
    const ok =
      (!item.requiredPermission || hasPermission(item.requiredPermission)) &&
      (!item.requiredPermissions || item.requiredPermissions.every(p => hasPermission(p))) &&
      (!item.requiredAnyPermission || hasAnyPermission(item.requiredAnyPermission));
    if (ok) return item.href;
  }
  return null;
}

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
      } else if (user && !isPublicPage) {
        const effectivePath = pathname.startsWith(`/${locale}`)
          ? pathname.slice(`/${locale}`.length) || '/'
          : pathname;
        if (effectivePath === '/' && !hasPermission(DASHBOARD_PERMISSIONS.VIEW_MENU)) {
          const firstRoute = getFirstAccessibleHref(navItems, hasPermission, hasAnyPermission);
          if (firstRoute && firstRoute !== '/') {
            router.replace(`/${locale}${firstRoute}`);
          }
        }
      }
    }
  }, [user, isLoading, isPublicPage, pathname, router, locale, hasPermission, hasAnyPermission]);

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

    // Prevent flash: if on root and user has no dashboard access, wait for the redirect
    const effectivePath = pathname.startsWith(`/${locale}`)
      ? pathname.slice(`/${locale}`.length) || '/'
      : pathname;
    if (effectivePath === '/' && !hasPermission(DASHBOARD_PERMISSIONS.VIEW_MENU)) {
      return null;
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
  const { user } = useAuth();
  const { isExpired, isExpiringSoon, daysLeft } = useLicenseStore();

  const isSystemUser = user?.email === 'system@invokeia.com';

  const getEffectivePathname = (p: string, l: string) => {
    const localePrefix = `/${l}`;
    if (p.startsWith(localePrefix)) {
      return p.substring(localePrefix.length) || '/';
    }
    return p;
  };

  const effectivePathname = getEffectivePathname(pathname, locale);

  return (
    <div className="flex h-[100dvh] print:h-auto print:block bg-background overflow-hidden print:overflow-visible text-foreground">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className={cn("widget-content-area flex flex-col flex-1 transition-all duration-300 ml-0 sm:ml-20 print:ml-0 print:block min-w-0 h-full print:h-auto overflow-hidden print:overflow-visible")}>
        <div className="print:hidden">
          <Header />
        </div>
        {isExpiringSoon && !isExpired && (
          <LicenseExpirationBanner daysLeft={daysLeft} />
        )}
        <main className="flex-1 flex flex-col min-h-0 bg-background px-0 sm:px-4 lg:px-6 pb-0 sm:pb-6 lg:pb-6 pt-0 overflow-hidden print:block print:h-auto print:overflow-visible print:px-0 relative">
          <div className="flex-1 flex flex-col min-h-0 pt-12 sm:pt-4 lg:pt-6 print:pt-0 print:block print:h-auto overflow-hidden print:overflow-visible relative">
            {children}
            {isExpired && !isSystemUser && <LicenseExpiredScreen />}
          </div>
        </main>
        <footer className="sm:hidden print:hidden flex-none h-6 flex items-center justify-center bg-[var(--nav-bg)] px-4">
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
