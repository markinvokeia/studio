'use client';

import { PAYROLL_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import * as React from 'react';

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { hasPermission } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!user) return null;

  if (!hasPermission(PAYROLL_PERMISSIONS.VIEW_MENU)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Acceso Denegado</h2>
          <p className="text-muted-foreground mt-2">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
