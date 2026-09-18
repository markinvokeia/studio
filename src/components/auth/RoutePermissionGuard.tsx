'use client';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface RoutePermissionGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
}

/**
 * Gate for a specific route, used from a leaf `layout.tsx` (one permission
 * per actual page, e.g. SALES_PERMISSIONS.QUOTES_VIEW_MENU) rather than the
 * group-level "any permission in this section" checks that let a user with
 * access to just one sibling page load every other page in the section.
 */
export function RoutePermissionGuard({
  children,
  requiredPermission,
  requiredAnyPermission,
}: RoutePermissionGuardProps) {
  const { user, isLoading } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const t = useTranslations('Common');

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasAccess =
    (!requiredPermission || hasPermission(requiredPermission)) &&
    (!requiredAnyPermission || hasAnyPermission(requiredAnyPermission));

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{t('accessDenied')}</h2>
          <p className="text-muted-foreground mt-2">{t('noPermission')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
