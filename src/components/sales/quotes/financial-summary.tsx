'use client';

import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface FinancialSummaryProps {
  total: number;
  totalPaid: number;
  balance: number;
  currency: string;
  operationalStatus: string;
  billingStatus: string;
  paymentStatus: string;
  totalLabel?: string;
  paidLabel?: string;
  balanceLabel?: string;
}

export function FinancialSummary({
  total,
  totalPaid,
  balance,
  currency,
  operationalStatus,
  billingStatus,
  paymentStatus,
  totalLabel,
  paidLabel,
  balanceLabel,
}: FinancialSummaryProps) {
  const t = useTranslations('QuotesPage');

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr || 'UYU',
    }).format(amount);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {t('quoteDialog.status')}
        </span>
        <StatusBadge status={operationalStatus} />
      </div>

      <div className="h-10 w-px bg-gray-200 hidden md:block" />

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {totalLabel || t('summary.total')}
        </span>
        <span className="text-xl font-bold text-gray-900">
          {formatCurrency(total, currency)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">
          {paidLabel || t('summary.paid')}
        </span>
        <span className="text-xl font-bold text-green-600">
          {formatCurrency(totalPaid, currency)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
          {balanceLabel || t('summary.balance')}
        </span>
        <span className="text-xl font-bold text-red-600">
          {formatCurrency(balance, currency)}
        </span>
      </div>
    </div>
  );
}
