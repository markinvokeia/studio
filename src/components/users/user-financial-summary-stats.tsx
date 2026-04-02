'use client';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { UserFinancial } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface UserFinancialSummaryStatsProps {
  financialData?: UserFinancial | null;
  isOpen: boolean;
  onToggle: () => void;
  onPrint: () => void;
}

export function UserFinancialSummaryStats({
  financialData,
  isOpen,
  onToggle,
  onPrint,
}: UserFinancialSummaryStatsProps) {
  const t = useTranslations('UsersPage');

  const formatCurrency = (value: unknown, currency: 'USD' | 'UYU') => {
    const symbol = currency === 'USD' ? 'U$S' : '$U';
    const numericValue = Number(value) || 0;
    const formattedValue = new Intl.NumberFormat('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);

    return `${symbol} ${formattedValue}`;
  };

  const renderStatValue = (value: { USD?: number; UYU?: number }, valueColor: string) => (
    <div className="flex flex-col leading-tight">
      <span className={cn('text-sm font-bold tracking-tight', valueColor)}>
        {formatCurrency(value.UYU ?? 0, 'UYU')}
      </span>
      <span className="text-[11px] font-medium opacity-70">
        {formatCurrency(value.USD ?? 0, 'USD')}
      </span>
    </div>
  );

  const stats = [
    {
      title: t('stats.totalInvoiced'),
      value: {
        USD: financialData?.financial_data?.USD?.total_invoiced ?? 0,
        UYU: financialData?.financial_data?.UYU?.total_invoiced ?? 0,
      },
      valueColor: 'text-blue-700 dark:text-blue-300',
      cardClass: 'bg-blue-50 dark:bg-blue-950/60 border-blue-100 dark:border-blue-900',
    },
    {
      title: t('stats.totalPaid'),
      value: {
        USD: financialData?.financial_data?.USD?.total_paid ?? 0,
        UYU: financialData?.financial_data?.UYU?.total_paid ?? 0,
      },
      valueColor: 'text-emerald-700 dark:text-emerald-300',
      cardClass: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-900',
    },
    {
      title: t('stats.currentDebt'),
      value: {
        USD: financialData?.financial_data?.USD?.current_debt ?? 0,
        UYU: financialData?.financial_data?.UYU?.current_debt ?? 0,
      },
      valueColor: 'text-rose-700 dark:text-rose-300',
      cardClass: 'bg-rose-50 dark:bg-rose-950/60 border-rose-100 dark:border-rose-900',
    },
    {
      title: t('stats.availableBalance'),
      value: {
        USD: financialData?.financial_data?.USD?.available_balance ?? 0,
        UYU: financialData?.financial_data?.UYU?.available_balance ?? 0,
      },
      valueColor: 'text-violet-700 dark:text-violet-300',
      cardClass: 'bg-violet-50 dark:bg-violet-950/60 border-violet-100 dark:border-violet-900',
    },
  ];

  return (
    <Collapsible open={isOpen} className="mb-2">
      <div className="flex items-center justify-between pt-2 pb-1">
        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
          {t('stats.title')}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            onClick={onToggle}
          >
            {isOpen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {isOpen ? t('stats.hideStats') : t('stats.showStats')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            onClick={onPrint}
          >
            <Printer className="h-3 w-3" />
            {t('stats.printFinancialSummary')}
          </Button>
        </div>
      </div>
      <CollapsibleContent className="transition-all">
        <div className="grid grid-cols-2 gap-2 pb-2 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className={cn(
                'rounded-lg border px-3 py-2 flex flex-col gap-1 overflow-hidden shadow-none',
                stat.cardClass
              )}
            >
              <span className="text-[9px] uppercase font-bold tracking-tight truncate opacity-60">
                {stat.title}
              </span>
              <div className="mt-0.5">
                {renderStatValue(stat.value, stat.valueColor)}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
      <div className="mt-1 border-t border-border" />
    </Collapsible>
  );
}
