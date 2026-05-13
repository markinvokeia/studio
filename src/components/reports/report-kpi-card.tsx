'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ReportKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: number;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  isLoading?: boolean;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
};

export function ReportKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  isLoading = false,
  className,
}: ReportKPICardProps) {
  if (isLoading) {
    return (
      <Card className={cn('flex-1 min-w-[160px]', className)}>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex-1 min-w-[160px] print:min-w-0 print:w-full', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground leading-tight">{title}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 print:hidden" />}
        </div>
        <p className={cn('mt-1 text-2xl font-semibold tabular-nums print:text-xl print:leading-tight', variantStyles[variant])}>
          {value}
        </p>
        {(subtitle || trend !== undefined) && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {trend !== undefined && (
              trend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )
            )}
            {trend !== undefined && (
              <span className={trend >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
