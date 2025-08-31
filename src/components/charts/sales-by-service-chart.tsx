'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';

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
import { salesByServiceData } from '@/lib/data';

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

export function SalesByServiceChart() {
  return (
    <Card className='lg:col-span-1'>
      <CardHeader>
        <CardTitle>Sales by Service</CardTitle>
        <CardDescription>Top performing services</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-square h-full w-full">
          <BarChart data={salesByServiceData} layout="vertical" margin={{ left: 0, right: 20 }}>
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
            <Bar dataKey="sales" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
