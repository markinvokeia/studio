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

export const OpenCashSessionWidget = () => {
    const t = useTranslations('OpenCashSessionWidget');
    const locale = useLocale();
    const { activeCashSession, isLoading: isAuthLoading } = useAuth();
    
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
                                    "border-green-500/50 bg-green-50/50 text-green-700",
                                    "hover:bg-green-100 hover:border-green-600 hover:text-green-800",
                                    "dark:bg-green-900/10 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30"
                                )}
                            >
                                {/* Icono de dinero para contexto */}
                                <Banknote className="h-4 w-4 opacity-70" />
                                
                                {/* Información de Balances */}
                                <div className="flex flex-col items-end text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{uyuAmount.toFixed(2)}</span>
                                        <span className='opacity-80 text-[10px]'>UYU</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{usdAmount.toFixed(2)}</span>
                                        <span className='opacity-80 text-[10px]'>USD</span>
                                    </div>
                                </div>

                                {/* Icono de flecha para indicar acción de "Ir a" */}
                                <div className="pl-1 border-l border-green-600/20">
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
                            size="sm" 
                            className={cn(
                                "h-9 border-dashed",
                                "border-yellow-500/60 text-yellow-600 bg-yellow-50/30",
                                "hover:border-yellow-500 hover:bg-yellow-50 hover:text-yellow-700",
                                "dark:text-yellow-400 dark:hover:text-yellow-300 dark:bg-transparent"
                            )}
                        >
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