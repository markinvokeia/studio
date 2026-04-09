'use client';

import { useAuth } from '@/context/AuthContext';
import { TV_DISPLAY_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export default function TVDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();
  const locale = useLocale();

  React.useEffect(() => {
    if (!isLoading && user) {
      if (!hasPermission(TV_DISPLAY_PERMISSIONS.VIEW_MENU)) {
        router.replace(`/${locale}/`);
      }
    }
  }, [user, isLoading, hasPermission, router, locale]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!hasPermission(TV_DISPLAY_PERMISSIONS.VIEW_MENU)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Acceso Denegado</h2>
          <p className="text-muted-foreground mt-2">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
