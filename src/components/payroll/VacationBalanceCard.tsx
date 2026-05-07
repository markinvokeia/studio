'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { VacationBalance } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Palmtree } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  balance?: VacationBalance | null;
  loading?: boolean;
}

function fmt(n?: number): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('es-UY', { maximumFractionDigits: 1 });
}

export function VacationBalanceCard({ balance, loading }: Props) {
  const t = useTranslations('PayrollPage.legajo.licencias');

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  const saldo = balance?.saldo ?? 0;

  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="header-icon-circle">
            <Palmtree className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('vacationBalance')}</p>
            <p className="text-xs text-muted-foreground">
              {t('seniority', { years: balance?.antiguedad_anios ?? 0 })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">{t('generated')}</p>
            <p className="text-base font-semibold">{fmt(balance?.generados)}</p>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">{t('taken')}</p>
            <p className="text-base font-semibold">{fmt(balance?.tomados)}</p>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">{t('balance')}</p>
            <p className={cn(
              'text-base font-bold',
              saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              {fmt(saldo)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
