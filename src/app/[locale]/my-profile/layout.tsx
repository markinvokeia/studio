'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { PATIENT_PORTAL_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function MyProfileLayout({ children }: { children: React.ReactNode }) {
    const t = useTranslations('PatientPortal');
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

    if (!hasPermission(PATIENT_PORTAL_PERMISSIONS.ACCESS)) {
        return (
            <div className="flex h-full items-center justify-center p-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">{t('accessDenied.title')}</h2>
                    <p className="mt-2 text-muted-foreground">{t('accessDenied.description')}</p>
                </div>
            </div>
        );
    }

    return <React.Suspense>{children}</React.Suspense>;
}
