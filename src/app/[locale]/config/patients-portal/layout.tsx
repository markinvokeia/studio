'use client';

import * as React from 'react';

import { PATIENT_PORTAL_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function PatientsPortalConfigLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const { hasPermission } = usePermissions();

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    if (!hasPermission(PATIENT_PORTAL_CONFIG_PERMISSIONS.VIEW)) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">Acceso Denegado</h2>
                    <p className="mt-2 text-muted-foreground">No tienes permisos para acceder a esta página.</p>
                </div>
            </div>
        );
    }

    return <React.Suspense>{children}</React.Suspense>;
}
