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
  'currency-dollar': { component: CurrencyDollarIcon, className: '' },
  'user-plus': { component: UserPlusIcon, className: '' },
  'arrow-trending-up': { component: ArrowTrendingUpIcon, className: '' },
  'chart-pie': { component: ChartPieIcon, className: '' },
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
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <Skeleton className="h-5 w-2/3" />
              </div>
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
        const changeColor = {
            positive: 'text-green-600',
            negative: 'text-destructive',
            neutral: 'text-muted-foreground'
        }[stat.changeType];

        return (
          <Card key={index} className="flex flex-col">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className={cn("header-icon-circle h-8 w-8 shrink-0", IconInfo.className)}>
                      <Icon className="h-4 w-4" />
                  </div>
                )}
                <CardTitle className="text-xs font-bold uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="text-xl font-black text-foreground">{stat.value}</div>
              <p className={cn("text-[10px] font-bold mt-0.5", changeColor)}>{stat.change}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
