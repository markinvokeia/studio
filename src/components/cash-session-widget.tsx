
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Box, Banknote, ArrowRight } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { CASHIER_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

export const OpenCashSessionWidget = () => {
    const t = useTranslations('OpenCashSessionWidget');
    const locale = useLocale();
    const { activeCashSession, isLoading: isAuthLoading } = useAuth();
    const { hasPermission } = usePermissions();

    const canViewWidget = hasPermission(CASHIER_PERMISSIONS.VIEW_WIDGET);

    if (!canViewWidget) return null;

    if (isAuthLoading) {
        return <Skeleton className="h-10 w-10 rounded-xl" />;
    }

    const isOpen = !!(activeCashSession && activeCashSession.data?.current_balances);

    if (isOpen) {
        const balances = activeCashSession!.data.current_balances || [];
        const uyuAmount = balances.find((a: any) => a.currency === 'UYU')?.cash_on_hand || 0;
        const usdAmount = balances.find((a: any) => a.currency === 'USD')?.cash_on_hand || 0;

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative rounded-xl h-10 w-10 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                        title={t('activeSession.tooltip')}
                    >
                        <Banknote className="h-5 w-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="left" align="center" className="w-52 p-3 rounded-xl">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        {t('activeSession.button')}
                    </p>
                    <div className="flex flex-col gap-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">UYU</span>
                            <span className="font-semibold">{uyuAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">USD</span>
                            <span className="font-semibold">{usdAmount.toFixed(2)}</span>
                        </div>
                    </div>
                    <Link href={`/${locale}/cashier`} passHref>
                        <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs rounded-lg">
                            {t('activeSession.tooltip')} <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    </Link>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'relative rounded-xl h-10 w-10 bg-orange-500/15 text-orange-600 hover:bg-orange-500/25',
                        'animate-pulse-slow',
                    )}
                    title={t('tooltip')}
                >
                    <Box className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent side="left" align="center" className="w-48 p-3 rounded-xl">
                <p className="text-xs text-muted-foreground mb-2">{t('tooltip')}</p>
                <Link href={`/${locale}/cashier`} passHref>
                    <Button size="sm" className="w-full h-7 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white">
                        {t('button')} <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                </Link>
            </PopoverContent>
        </Popover>
    );
};
