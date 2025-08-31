import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { statsData } from '@/lib/data';
import { Activity, CreditCard, DollarSign, Users } from 'lucide-react';

const iconMap: { [key: string]: React.ElementType } = {
  'dollar-sign': DollarSign,
  users: Users,
  'credit-card': CreditCard,
  activity: Activity,
};

export function Stats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      {statsData.map((stat, index) => {
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
