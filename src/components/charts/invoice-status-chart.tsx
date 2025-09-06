
'use client';

import * as React from 'react';
import { Pie, PieChart, Cell } from 'recharts';

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
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import { invoiceStatusData } from '@/lib/data';

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
};

export function InvoiceStatusChart() {
  const totalValue = React.useMemo(() => {
    return invoiceStatusData.reduce((acc, curr) => acc + curr.value, 0);
  }, []);

  return (
    <Card className="flex h-full flex-col lg:col-span-1">
      <CardHeader>
        <CardTitle>Invoice Status</CardTitle>
        <CardDescription>Current state of all invoices</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 pb-0">
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
              data={invoiceStatusData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
            >
              {invoiceStatusData.map((entry, index) => (
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
       <CardContent className="mt-auto flex flex-col items-center justify-center gap-2">
        <div
          className="flex items-center gap-2 text-center text-sm font-medium leading-none text-muted-foreground"
        >
          Total Invoices: {totalValue}
        </div>
      </CardContent>
    </Card>
  );
}
