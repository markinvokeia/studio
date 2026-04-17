'use client';

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
  variant?: 'patient' | 'provider';
}

export function UserFinancialSummaryStats({
  financialData,
  isOpen,
  onToggle,
  onPrint,
  variant = 'patient',
}: UserFinancialSummaryStatsProps) {
  const tPatient = useTranslations('UsersPage');
  const tProvider = useTranslations('ProvidersPage');
  const t = variant === 'provider' ? tProvider : tPatient;

  const formatCurrency = (value: unknown, currency: 'USD' | 'UYU') => {
    const symbol = currency === 'USD' ? 'U$S' : '$U';
    const numericValue = Number(value) || 0;
    const formattedValue = new Intl.NumberFormat('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);

    return `${symbol} ${formattedValue}`;
  };

  const stats = [
    {
      title: t('stats.totalInvoiced'),
      value: {
        USD: financialData?.financial_data?.USD?.total_invoiced ?? 0,
        UYU: financialData?.financial_data?.UYU?.total_invoiced ?? 0,
      },
      accentColor: '#3B82F6',
    },
    {
      title: t('stats.totalPaid'),
      value: {
        USD: financialData?.financial_data?.USD?.total_paid ?? 0,
        UYU: financialData?.financial_data?.UYU?.total_paid ?? 0,
      },
      accentColor: '#10B981',
    },
    {
      title: t('stats.currentDebt'),
      value: {
        USD: financialData?.financial_data?.USD?.current_debt ?? 0,
        UYU: financialData?.financial_data?.UYU?.current_debt ?? 0,
      },
      accentColor: '#F43F5E',
    },
    {
      title: t('stats.availableBalance'),
      value: {
        USD: financialData?.financial_data?.USD?.available_balance ?? 0,
        UYU: financialData?.financial_data?.UYU?.available_balance ?? 0,
      },
      accentColor: '#8B5CF6',
    },
  ];

  return (
    <Collapsible open={isOpen} className="mb-2">
      <div className="flex items-center justify-between pt-2 pb-1">
        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
          {t('stats.title')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={onToggle}
          >
            {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="text-[9px] font-medium leading-tight">
              {isOpen ? t('stats.hideStats') : t('stats.showStats')}
            </span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={onPrint}
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:block text-[9px] font-medium leading-tight">{t('stats.print')}</span>
          </button>
        </div>
      </div>
      <CollapsibleContent className="transition-all">
        <div className="grid grid-cols-2 gap-2 pb-2 md:grid-cols-4">
          {stats.map((stat) => {
            const uyuValue = Number(stat.value.UYU ?? 0);
            const isBalance = stat.title === t('stats.availableBalance');
            const valueColor = isBalance
              ? uyuValue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
              : undefined;

            return (
              <div
                key={stat.title}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                <div className="h-[3px] w-full" style={{ background: stat.accentColor }} />
                <div className="px-3 py-2.5 flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium truncate">
                    {stat.title}
                  </span>
                  <div className="flex flex-col leading-tight mt-0.5">
                    <span className={cn('text-2xl font-bold tracking-tight', valueColor ?? 'text-foreground')}>
                      {formatCurrency(uyuValue, 'UYU')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(stat.value.USD ?? 0, 'USD')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
      <div className="mt-1 border-t border-border" />
    </Collapsible>
  );
}
