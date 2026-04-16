
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Box, ArrowRight, Banknote } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CASHIER_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

export const OpenCashSessionWidget = () => {
    const t = useTranslations('OpenCashSessionWidget');
    const locale = useLocale();
    const { activeCashSession, isLoading: isAuthLoading } = useAuth();
    const { hasPermission } = usePermissions();
    
    const canViewWidget = hasPermission(CASHIER_PERMISSIONS.VIEW_WIDGET);
    
    if (!canViewWidget) {
        return null;
    }
    
    if (isAuthLoading) {
        return (
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
            </div>
        );
    }

    if (activeCashSession && activeCashSession.data?.current_balances) {
        const balances = activeCashSession.data.current_balances || [];
        const uyuAmount = balances.find((a: any) => a.currency === 'UYU')?.cash_on_hand || 0;
        const usdAmount = balances.find((a: any) => a.currency === 'USD')?.cash_on_hand || 0;

        return (
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Link href={`/${locale}/cashier`} passHref>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-7 px-2 gap-1.5 sm:h-9 sm:px-3 sm:gap-2",
                                    "border-none bg-emerald-600 text-[var(--nav-foreground)]",
                                    "hover:bg-emerald-700",
                                    "transition-all duration-200 shadow-sm rounded-lg whitespace-nowrap"
                                )}
                            >
                                <Banknote className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                                <div className="flex items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
                                    <div className="flex items-center gap-0.5 sm:gap-1">
                                        <span className="font-bold">{uyuAmount.toFixed(2)}</span>
                                        <span className="opacity-90 text-[9px] sm:text-[10px]">UYU</span>
                                    </div>
                                    <span className="opacity-40">·</span>
                                    <div className="flex items-center gap-0.5 sm:gap-1">
                                        <span className="font-bold">{usdAmount.toFixed(2)}</span>
                                        <span className="opacity-90 text-[9px] sm:text-[10px]">USD</span>
                                    </div>
                                </div>
                                <ArrowRight className="h-3 w-3 shrink-0 opacity-70 sm:h-3.5 sm:w-3.5" />
                            </Button>
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('activeSession.tooltip')}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link href={`/${locale}/cashier`} passHref>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-7 px-2 gap-1.5 sm:h-9 sm:px-3 sm:gap-2",
                                "border-none bg-orange-500 text-[var(--nav-foreground)]",
                                "hover:bg-orange-600 shadow-sm rounded-lg",
                                "transition-all whitespace-nowrap"
                            )}
                        >
                            <Box className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                            <span className="text-[11px] font-semibold sm:text-xs">{t('button')}</span>
                        </Button>
                    </Link>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t('tooltip')}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
