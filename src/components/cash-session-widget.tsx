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
                                    "border-green-500/50 bg-green-500/10 text-green-400",
                                    "hover:bg-green-500/20 hover:border-green-400 hover:text-green-300",
                                    "transition-all duration-200"
                                )}
                            >
                                <Banknote className="h-4 w-4 opacity-70" />
                                
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
                                "border-yellow-500/60 text-yellow-400 bg-yellow-500/10",
                                "hover:border-yellow-500 hover:bg-yellow-500/20 hover:text-yellow-300",
                                "transition-all"
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