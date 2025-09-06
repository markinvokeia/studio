
'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { SalesByServiceChartData } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '../ui/skeleton';

const chartConfig = {
  sales: {
    label: 'Sales',
  },
  'Service A': { color: 'hsl(var(--chart-1))' },
  'Service B': { color: 'hsl(var(--chart-2))' },
  'Service C': { color: 'hsl(var(--chart-3))' },
  'Service D': { color: 'hsl(var(--chart-4))' },
  'Service E': { color: 'hsl(var(--chart-5))' },
};

interface SalesByServiceChartProps {
    chartData: SalesByServiceChartData[];
    isLoading?: boolean;
}

export function SalesByServiceChart({ chartData, isLoading }: SalesByServiceChartProps) {
  if (isLoading) {
    return (
        <Card className='lg:col-span-1'>
            <CardHeader>
                <CardTitle>Sales by Service</CardTitle>
                <CardDescription>Top performing services</CardDescription>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[250px] w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className='lg:col-span-1'>
      <CardHeader>
        <CardTitle>Sales by Service</CardTitle>
        <CardDescription>Top performing services</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-square h-full w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              className="w-20"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="sales" radius={5} fill="var(--color-primary)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
