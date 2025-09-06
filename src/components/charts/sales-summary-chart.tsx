
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

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--chart-1))',
  },
};

interface SalesSummaryChartProps {
    salesTrend?: number;
    date?: DateRange;
    chartData: SalesChartData[];
    isLoading?: boolean;
}

export function SalesSummaryChart({ salesTrend = 0, date, chartData, isLoading }: SalesSummaryChartProps) {
  const isTrendingUp = salesTrend >= 0;

  const formatDateRange = (dateRange: DateRange | undefined) => {
    if (!dateRange || !dateRange.from) {
      return 'Showing data for the last 12 months';
    }
    
    const fromYear = dateRange.from.getFullYear();
    
    if (dateRange.to) {
        const toYear = dateRange.to.getFullYear();
        if (fromYear === toYear) {
             return `January - December ${fromYear}`;
        }
        return `January ${fromYear} - December ${toYear}`;
    }

    return `From ${format(dateRange.from, 'PPP')}`;
  };

  const chartDescription = `Showing total revenue for the selected period.`;
  const footerDateText = formatDateRange(date);

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle>Sales Summary</CardTitle>
        <CardDescription>
          {chartDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              <CartesianGrid vertical={false} />
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
                stroke="var(--color-revenue)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium leading-none">
              Trending {isTrendingUp ? 'up' : 'down'} by {Math.abs(salesTrend).toFixed(1)}% this month 
              {isTrendingUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              {footerDateText}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
