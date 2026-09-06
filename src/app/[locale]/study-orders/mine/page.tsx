'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { StudyOrdersScreen } from '@/components/study-orders/study-orders-screen';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Mis Órdenes: lo que derivó el doctor logueado. El filtro por doctor lo aplica
 * el backend contra el sujeto del token, no un parámetro de esta pantalla.
 */
export default function MyStudyOrdersPage() {
    const { hasPermission, isLoading } = usePermissions();
    const t = useTranslations('StudyOrdersPage');

    if (isLoading) {
        return <div className="flex-1 p-4" />;
    }

    if (!hasPermission(STUDY_ORDERS_PERMISSIONS.VIEW_MINE)) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
                <p className="text-sm text-muted-foreground">{t('noAccess')}</p>
            </div>
        );
    }

    return <StudyOrdersScreen scope="mine" />;
}
