
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export const OpenCashSessionWidget = () => {
    const t = useTranslations('OpenCashSessionWidget');
    const locale = useLocale();
    const { user, activeCashSession, isLoading: isAuthLoading } = useAuth();
    
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
                            <div className="flex items-center gap-4 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 h-auto text-sm font-medium">
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{uyuAmount.toFixed(2)}</span>
                                        <span className='text-muted-foreground'>UYU</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{usdAmount.toFixed(2)}</span>
                                        <span className='text-muted-foreground'>USD</span>
                                    </div>
                                </div>
                            </div>
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
                        <Button variant="outline" size="sm" className="h-9 border-dashed border-yellow-500/50 text-yellow-600 hover:border-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300">
                            <Box className="mr-2 h-4 w-4" />
                            {t('button')}
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
