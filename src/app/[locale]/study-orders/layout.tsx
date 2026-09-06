'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Guard de la sección de órdenes de estudio. Basta con cualquiera de las dos
 * vistas: el derivador entra con VIEW_MINE, la clínica con VIEW_ALL.
 */
export default function StudyOrdersLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const { hasAnyPermission } = usePermissions();
    const t = useTranslations('StudyOrdersPage');

    if (isLoading) {
        return <div className="flex-1 p-4" />;
    }

    if (!user) {
        return null;
    }

    const hasAccess = hasAnyPermission([
        STUDY_ORDERS_PERMISSIONS.VIEW_MINE,
        STUDY_ORDERS_PERMISSIONS.VIEW_ALL,
    ]);

    if (!hasAccess) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">Acceso Denegado</h2>
                    <p className="mt-2 text-muted-foreground">{t('noAccess')}</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
