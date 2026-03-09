'use client';

import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export default function AvailabilityExceptionsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading } = useAuth();
    const { hasPermission } = usePermissions();
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('Common');

    React.useEffect(() => {
        if (!isLoading && user) {
            const hasAccess = hasPermission(BUSINESS_CONFIG_PERMISSIONS.AVAILABILITY_EXCEPTIONS_VIEW);
            if (!hasAccess) {
                router.replace(`/${locale}/`);
            }
        }
    }, [user, isLoading, hasPermission, router, locale]);

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

    const hasAccess = hasPermission(BUSINESS_CONFIG_PERMISSIONS.AVAILABILITY_EXCEPTIONS_VIEW);

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
