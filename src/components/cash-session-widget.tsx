
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Box, AlertTriangle, ArrowRight } from 'lucide-react';
import type { CajaSesion } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

export const OpenCashSessionWidget = () => {
    const t = useTranslations('OpenCashSessionWidget');
    const locale = useLocale();
    const { user, activeCashSession, isLoading: isAuthLoading } = useAuth();
    
    if (isAuthLoading) {
        return <Skeleton className="h-8 w-64" />;
    }
    
    if (activeCashSession) {
        return (
            <Alert variant="success" className="flex items-center justify-between p-2 h-10 max-w-md">
                <div className="flex items-center">
                    <Box className="h-4 w-4" />
                    <div className="ml-2">
                        <AlertTitle className="font-bold text-sm">{t('activeSession.title')}</AlertTitle>
                    </div>
                </div>
                <Link href={`/${locale}/cashier`} passHref>
                    <Button variant="ghost" size="sm">
                        {t('activeSession.button')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </Alert>
        );
    }

    return (
        <Alert variant="warning" className="flex items-center justify-between p-2 h-10 max-w-md">
            <div className="flex items-center">
                <AlertTriangle className="h-4 w-4" />
                <div className="ml-2">
                    <AlertTitle className="font-bold text-sm">{t('title')}</AlertTitle>
                </div>
            </div>
            <Link href={`/${locale}/cashier`} passHref>
                <Button variant="outline" size="sm" className="text-yellow-900 hover:text-yellow-900 dark:text-yellow-200">
                    {t('button')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
        </Alert>
    );
};

      