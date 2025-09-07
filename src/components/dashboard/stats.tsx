
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Stat } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { ArrowTrendingUpIcon } from '../icons/arrow-trending-up-icon';
import { ChartPieIcon } from '../icons/chart-pie-icon';
import { CurrencyDollarIcon } from '../icons/currency-dollar-icon';
import { UserPlusIcon } from '../icons/user-plus-icon';


const iconMap: { [key: string]: React.ElementType } = {
  'currency-dollar': CurrencyDollarIcon,
  'user-plus': UserPlusIcon,
  'arrow-trending-up': ArrowTrendingUpIcon,
  'chart-pie': ChartPieIcon,
};

interface StatsProps {
  data: Stat[];
}

export function Stats({ data }: StatsProps) {
  if (!data || data.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
           <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-5 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-1/2 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      {data.map((stat, index) => {
        const Icon = iconMap[stat.icon];
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {Icon && (
                <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
