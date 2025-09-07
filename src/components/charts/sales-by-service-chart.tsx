
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
import { BriefcaseIcon } from '../icons/briefcase-icon';

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
        <div className="flex items-center gap-2">
            <BriefcaseIcon className="h-6 w-6" />
            <CardTitle>Sales by Service</CardTitle>
        </div>
        <CardDescription>Top performing services by percentage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length > 0 ? chartData.map((service) => (
            <div key={service.name} className="space-y-1">
                <div className="flex justify-between items-center text-sm font-medium">
                    <span>{service.name}</span>
                    <span>{service.percentage.toFixed(0)}%</span>
                </div>
                <Progress value={service.percentage} className="h-2" style={{
                    '--progress-color': service.color
                } as React.CSSProperties} />
            </div>
        )) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                No sales data available for this period.
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
