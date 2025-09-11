
'use client';

import * as React from 'react';
import { Pie, PieChart, Cell, Legend } from 'recharts';
import { useTranslations } from 'next-intl';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { InvoiceStatusData } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { DocumentCheckIcon } from '../icons/document-check-icon';

const chartConfig = {
  value: {
    label: 'Invoices',
  },
  Paid: {
    label: 'Paid',
    color: 'hsl(var(--chart-1))',
  },
  Overdue: {
    label: 'Overdue',
    color: 'hsl(var(--destructive))',
  },
  Draft: {
    label: 'Draft',
    color: 'hsl(var(--muted-foreground))',
  },
  Sent: {
    label: 'Sent',
    color: 'hsl(var(--chart-2))',
  },
  Pending: {
    label: 'Pending',
    color: 'hsl(var(--chart-2))',
  },
};

interface InvoiceStatusChartProps {
    chartData: InvoiceStatusData[];
    isLoading?: boolean;
}

export function InvoiceStatusChart({ chartData, isLoading }: InvoiceStatusChartProps) {
  const t = useTranslations('InvoiceStatusChart');
  const totalValue = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);
  
  if (isLoading) {
    return (
        <Card className="flex h-full flex-col lg:col-span-1">
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0 flex items-center justify-center">
                 <Skeleton className="h-[200px] w-[200px] rounded-full" />
            </CardContent>
            <CardFooter className="flex-col gap-1.5 pb-6 pt-4">
                 <Skeleton className="h-4 w-1/2" />
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col lg:col-span-1">
      <CardHeader>
        <div className="flex items-center gap-2">
          <DocumentCheckIcon className="h-6 w-6 text-emerald-500" />
          <CardTitle>{t('title')}</CardTitle>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              strokeWidth={5}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-1.5 pb-6 pt-4">
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          {t('totalInvoices', {total: totalValue})}
        </div>
      </CardFooter>
    </Card>
  );
}
