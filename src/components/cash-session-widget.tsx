
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Box, AlertTriangle, ArrowRight, Banknote } from 'lucide-react';
import type { CajaSesion } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

export const OpenCashSessionWidget = () => {
    const t = useTranslations('OpenCashSessionWidget');
    const locale = useLocale();
    const { user, activeCashSession, isLoading: isAuthLoading } = useAuth();
    
    if (isAuthLoading) {
        return <Skeleton className="h-10 w-64" />;
    }
    
    if (activeCashSession) {
        const uyuAmount = activeCashSession.amounts?.find((a: any) => a.currency === 'UYU')?.cash_on_hand || 0;
        const usdAmount = activeCashSession.amounts?.find((a: any) => a.currency === 'USD')?.cash_on_hand || 0;

        return (
            <Alert variant="success" className={cn("flex items-center justify-between p-2 h-auto max-w-md", activeCashSession ? "w-80" : "w-auto")}>
                <div className="flex items-center gap-4">
                    <Banknote className="h-5 w-5" />
                    <div>
                        <AlertTitle className="font-bold text-sm">{t('activeSession.title')}</AlertTitle>
                        <AlertDescription className="text-xs">
                            <div className="font-semibold">UYU: {uyuAmount.toFixed(2)}</div>
                            <div className="font-semibold">USD: {usdAmount.toFixed(2)}</div>
                        </AlertDescription>
                    </div>
                </div>
                <Link href={`/${locale}/cashier`} passHref>
                    <Button variant="ghost" size="sm" className="self-start">
                        <ArrowRight className="h-4 w-4" />
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
