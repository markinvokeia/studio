
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Stat } from '@/lib/types';
import { Activity, CreditCard, DollarSign, Users, FileText } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const iconMap: { [key: string]: React.ElementType } = {
  'dollar-sign': DollarSign,
  users: Users,
  'credit-card': CreditCard,
  activity: Activity,
  'file-text': FileText,
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
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
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
