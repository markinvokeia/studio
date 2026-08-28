'use client';

import { Header } from '@/components/header';
import { LicenseExpirationBanner, LicenseExpiredBanner } from '@/components/license/LicenseExpirationBanner';
import { LicenseExpiredScreen } from '@/components/license/LicenseExpiredScreen';
import { PatientPortalLayout } from '@/components/patient-portal/patient-portal-layout';
import { PatientAppointmentsHistorySheet } from '@/components/appointments/PatientAppointmentsHistorySheet';
import { BillingWizardModal } from '@/components/billing-wizard';
import { PatientHistorySheet } from '@/components/clinic-history/PatientHistorySheet';
import { PatientLedgerSheet } from '@/components/financial/PatientLedgerSheet';
import { PatientDocumentsSheet } from '@/components/patients/PatientDocumentsSheet';
import { PatientQuickViewHost } from '@/components/patients/PatientQuickViewHost';
import { PrintDocumentContainer } from '@/components/print-templates';
import { SedeSelectionModal } from '@/components/sede-selection-modal';
import { useAuth } from '@/context/AuthContext';
import { usePatientPortal } from '@/hooks/usePatientPortal';
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
  const { hasPatientRole, isPatientOnly } = usePatientPortal();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  const isPublicPage = pathname === `/${locale}/login` || pathname === `/${locale}/patient-login` || pathname.startsWith(`/${locale}/reset-password`) || pathname.startsWith(`/${locale}/set-first-password`);
  const isTVScreenPage = pathname === `/${locale}/tv-display/screen`;
  const isPatientPortalPage = pathname.startsWith(`/${locale}/my-profile`);

  React.useEffect(() => {
    if (!isLoading) {
      if (!user && !isPublicPage) {
        // Un paciente que pierde la sesión vuelve a SU login, no al del staff.
        router.replace(`/${locale}/${isPatientPortalPage ? 'patient-login' : 'login'}`);
      } else if (user && isPublicPage && !pathname.startsWith(`/${locale}/reset-password`) && !pathname.startsWith(`/${locale}/set-first-password`)) {
        // Quien se autenticó por la landing de pacientes va al portal, aunque
        // además sea staff: es la puerta por la que decidió entrar.
        //
        // Sin este `||` había una carrera: el wizard navega a /my-profile y este
        // efecto, disparado por el mismo cambio de `user`, mandaba a `/`. El
        // ganador era impredecible y por eso el paciente caía en la raíz.
        const cameFromPatientLogin = pathname === `/${locale}/patient-login`;
        router.replace(cameFromPatientLogin || isPatientOnly ? `/${locale}/my-profile` : `/${locale}`);
      } else if (user && isPatientOnly && !isPatientPortalPage) {
        // Confinamiento duro, sólo para quien no tiene ningún rol de staff: no
        // accede a ninguna página del dashboard aunque escriba la URL a mano.
        router.replace(`/${locale}/my-profile`);
      } else if (user && !hasPatientRole && isPatientPortalPage) {
        // Sin rol de paciente no hay perfil que mostrar: vuelve al dashboard.
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
  }, [user, isLoading, isPublicPage, hasPatientRole, isPatientOnly, isPatientPortalPage, pathname, router, locale, hasPermission, hasAnyPermission]);

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

    // Evita el flash de UI mientras corre alguno de los redirects de arriba:
    // el paciente puro fuera del portal, o alguien sin rol de paciente dentro.
    if ((isPatientOnly && !isPatientPortalPage) || (!hasPatientRole && isPatientPortalPage)) {
      return null;
    }

    // Portal del paciente: shell propio (sin sidebar ni header) y modo solo lectura.
    if (isPatientPortalPage) {
      return <PatientPortalLayout>{children}</PatientPortalLayout>;
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

  const isInvokeUser = user?.email?.endsWith('@invokeia.com') ?? false;

  const getEffectivePathname = (p: string, l: string) => {
    const localePrefix = `/${l}`;
    if (p.startsWith(localePrefix)) {
      return p.substring(localePrefix.length) || '/';
    }
    return p;
  };

  const effectivePathname = getEffectivePathname(pathname, locale);

  return (
    <>
    {/* Overlays/sheets del staff, disparados por stores globales desde
        cualquier punto del dashboard. Viven acá — y no en el layout raíz —
        para que nunca se monten en la landing pública ni en el portal del
        paciente: ninguno de los dos los usa, y montarlos ahí disparaba
        llamadas 401 a endpoints protegidos (/clinic, /print-templates) antes
        de que hubiera token. */}
    <BillingWizardModal />
    <PrintDocumentContainer />
    <PatientLedgerSheet />
    <PatientQuickViewHost />
    <PatientHistorySheet />
    <PatientAppointmentsHistorySheet />
    <PatientDocumentsSheet />
    <div className="flex h-[100dvh] print:h-auto print:block bg-background overflow-hidden print:overflow-visible text-foreground">
      <SedeSelectionModal />
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className={cn("widget-content-area flex flex-col flex-1 transition-all duration-300 ml-0 sm:ml-20 print:ml-0 print:block min-w-0 h-full print:h-auto overflow-hidden print:overflow-visible pt-12 sm:pt-4 lg:pt-6 print:pt-0")}>
        <div className="print:hidden">
          <Header />
        </div>
        {isExpired && isInvokeUser && <LicenseExpiredBanner />}
        {isExpiringSoon && !isExpired && (
          <LicenseExpirationBanner daysLeft={daysLeft} />
        )}
        <main className="flex-1 flex flex-col min-h-0 bg-background px-0 sm:px-4 lg:px-6 pb-0 sm:pb-6 lg:pb-6 pt-0 overflow-hidden print:block print:h-auto print:overflow-visible print:px-0 relative">
          <div className="flex-1 flex flex-col min-h-0 print:block print:h-auto overflow-hidden print:overflow-visible relative">
            {children}
            {isExpired && !isInvokeUser && <LicenseExpiredScreen />}
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
    </>
  );
}
