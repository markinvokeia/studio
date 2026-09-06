'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { StudyOrdersScreen } from '@/components/study-orders/study-orders-screen';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Bandeja de la clínica: todas las órdenes recibidas, de todos los derivadores.
 * Es la misma pantalla que "Mis Órdenes" con `scope="clinic"`.
 */
export default function ClinicStudyOrdersPage() {
    const { hasPermission, isLoading } = usePermissions();
    const t = useTranslations('StudyOrdersPage');

    if (isLoading) {
        return <div className="flex-1 p-4" />;
    }

    // El layout ya deja pasar a quien tenga VIEW_MINE; esta vista en concreto
    // necesita VIEW_ALL, así que se vuelve a chequear acá.
    if (!hasPermission(STUDY_ORDERS_PERMISSIONS.VIEW_ALL)) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
                <p className="text-sm text-muted-foreground">{t('noAccess')}</p>
            </div>
        );
    }

    return <StudyOrdersScreen scope="clinic" />;
}
