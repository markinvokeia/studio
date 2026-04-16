
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
                                    "h-auto py-1.5 px-3 flex items-center gap-3",
                                    "border-none bg-emerald-600 text-[var(--nav-foreground)]",
                                    "hover:bg-emerald-700",
                                    "transition-all duration-200 shadow-sm rounded-lg"
                                )}
                            >
                                <Banknote className="h-4 w-4" />
                                
                                <div className="flex flex-col items-end text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{uyuAmount.toFixed(2)}</span>
                                        <span className='opacity-90 text-[10px]'>UYU</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{usdAmount.toFixed(2)}</span>
                                        <span className='opacity-90 text-[10px]'>USD</span>
                                    </div>
                                </div>

                                <div className="pl-1 border-l border-current/20">
                                    <ArrowRight className="h-4 w-4" />
                                </div>
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
                                "h-auto py-1 px-2 border-none bg-orange-500 text-[var(--nav-foreground)]",
                                "hover:bg-orange-600 shadow-sm rounded-lg",
                                "transition-all max-w-[72px] w-[72px]"
                            )}
                        >
                            <div className="flex flex-col items-center gap-0.5 w-full">
                                <Box className="h-4 w-4 flex-none" />
                                <span className="text-[9px] font-semibold leading-tight text-center whitespace-normal break-words w-full">{t('button')}</span>
                            </div>
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
