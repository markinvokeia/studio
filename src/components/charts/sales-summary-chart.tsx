'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { SalesChartData } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { ChartBarSquareIcon } from '../icons/chart-bar-square-icon';
import { useTranslations } from 'next-intl';

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary-foreground))',
  },
};

interface SalesSummaryChartProps {
    salesTrend?: number;
    date?: DateRange;
    chartData: SalesChartData[];
    isLoading?: boolean;
}

export function SalesSummaryChart({ salesTrend = 0, date, chartData, isLoading }: SalesSummaryChartProps) {
  const t = useTranslations('SalesSummaryChart');
  const isTrendingUp = salesTrend >= 0;

  const formatDateRange = (dateRange: DateRange | undefined) => {
    if (!dateRange || !dateRange.from) {
      return t('last12Months');
    }
    
    const fromYear = dateRange.from.getFullYear();
    
    if (dateRange.to) {
        const toYear = dateRange.to.getFullYear();
        if (fromYear === toYear) {
             return t('januaryToDecember', { year: fromYear });
        }
        return t('dateRange', { from: format(dateRange.from, 'PPP'), to: format(dateRange.to, 'PPP') });
    }

    return t('from', { from: format(dateRange.from, 'PPP') });
  };

  const footerDateText = formatDateRange(date);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="header-icon-circle">
            <ChartBarSquareIcon className="h-6 w-6" />
          </div>
          <CardTitle>{t('title')}</CardTitle>
        </div>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="h-[250px] w-full flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <LineChart
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 10,
                bottom: 10
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 3)}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Line
                dataKey="revenue"
                type="monotone"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="bg-muted/5 py-4">
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-1">
            <div className={cn("flex items-center gap-2 font-bold leading-none", isTrendingUp ? "text-green-500" : "text-red-500")}>
              {t(isTrendingUp ? 'trendingUp' : 'trendingDown', { trend: Math.abs(salesTrend).toFixed(1) })}
              {isTrendingUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground font-medium">
              {footerDateText}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
