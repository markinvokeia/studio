
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
import { cn } from '@/lib/utils';


const iconMap: { [key: string]: { component: React.ElementType, className: string } } = {
  'currency-dollar': { component: CurrencyDollarIcon, className: 'text-emerald-500 bg-emerald-500/10' },
  'user-plus': { component: UserPlusIcon, className: 'text-violet-500 bg-violet-500/10' },
  'arrow-trending-up': { component: ArrowTrendingUpIcon, className: 'text-blue-500 bg-blue-500/10' },
  'chart-pie': { component: ChartPieIcon, className: 'text-amber-500 bg-amber-500/10' },
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
        const IconInfo = iconMap[stat.icon];
        const Icon = IconInfo ? IconInfo.component : null;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {Icon && (
                <div className={cn("rounded-lg p-2", IconInfo.className)}>
                    <Icon className="h-6 w-6" />
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
