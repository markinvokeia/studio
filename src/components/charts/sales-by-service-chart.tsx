'use client';

import { SalesByServiceChartData } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { TagIcon } from '../icons/tag-icon';
import { useTranslations } from 'next-intl';

interface SalesByServiceChartProps {
    chartData: SalesByServiceChartData[];
    isLoading?: boolean;
}

export function SalesByServiceChart({ chartData, isLoading }: SalesByServiceChartProps) {
  const t = useTranslations('SalesByServiceChart');
  if (isLoading) {
    return (
        <Card className='lg:col-span-1'>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className='lg:col-span-1'>
      <CardHeader>
        <div className="flex items-center gap-3">
            <div className="header-icon-circle">
                <TagIcon className="h-6 w-6" />
            </div>
            <CardTitle>{t('title')}</CardTitle>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {chartData.length > 0 ? chartData.map((service) => (
            <div key={service.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-foreground/80">{service.name}</span>
                    <span>{service.percentage.toFixed(0)}%</span>
                </div>
                <Progress value={service.percentage} className="h-2 bg-muted" style={{
                    '--progress-color': service.color
                } as React.CSSProperties} />
            </div>
        )) : (
            <div className="flex items-center justify-center h-full text-muted-foreground py-10">
                {t('noData')}
            </div>
        )}
      </CardContent>
    </Card>
  );
}

// Custom CSS for progress bar color, to be used with style prop
const progressStyle = `
  @property --progress-color {
    syntax: '<color>';
    inherits: true;
    initial-value: hsl(var(--primary));
  }
  .progress-bar-dynamic > div {
    background-color: var(--progress-color);
  }
`;

if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = progressStyle;
  document.head.appendChild(styleSheet);
}
