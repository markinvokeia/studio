
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { Cell, Pie, PieChart } from 'recharts';
import { TrendingDownIcon } from '../icons/trending-down-icon';
import { TrendingUpIcon } from '../icons/trending-up-icon';
import { AppointmentAttendanceRate, AverageBilling, PatientDemographics } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { useTranslations } from 'next-intl';

interface KpiRowProps {
    averageBillingData: AverageBilling | null;
    appointmentAttendanceData: AppointmentAttendanceRate | null;
    patientDemographicsData: PatientDemographics | null;
    isLoading?: boolean;
}


export function KpiRow({ averageBillingData, appointmentAttendanceData, patientDemographicsData, isLoading }: KpiRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <AverageBillingCard data={averageBillingData} isLoading={isLoading} />
      <PatientDemographicsCard data={patientDemographicsData} isLoading={isLoading} />
      <AppointmentAttendanceCard data={appointmentAttendanceData} isLoading={isLoading} />
    </div>
  );
}

interface AverageBillingCardProps {
    data: AverageBilling | null;
    isLoading?: boolean;
}
export function AverageBillingCard({ data, isLoading }: AverageBillingCardProps) {
    const t = useTranslations('KpiRow');
    console.log('Translations for KpiRow loaded in AverageBillingCard.');
    if (isLoading || !data) {
        return (
            <Card>
                <CardHeader className="py-4"><CardTitle>{t('avgBilling')}</CardTitle></CardHeader>
                <CardContent className="py-4">
                    <Skeleton className="h-10 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardContent>
            </Card>
        );
    }
    const { value, change, changeType } = data;
    const isPositive = changeType === 'positive';
    const trendColor = isPositive ? 'text-green-500' : 'text-red-500';
    const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;
  
    return (
      <Card>
        <CardHeader className="py-4">
          <CardTitle>{t('avgBilling')}</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="text-4xl font-bold">${value.toFixed(2)}</div>
          <div className={cn("text-xs flex items-center mt-2", trendColor)}>
            <TrendIcon className="h-4 w-4 mr-1" />
            {change.toFixed(1)}% {t('vsPreviousPeriod')}
          </div>
        </CardContent>
      </Card>
    );
}

interface PatientDemographicsCardProps {
    data: PatientDemographics | null;
    isLoading?: boolean;
}
export function PatientDemographicsCard({ data, isLoading }: PatientDemographicsCardProps) {
    const t = useTranslations('KpiRow');
    console.log('Translations for KpiRow loaded in PatientDemographicsCard.');
    if (isLoading || !data) {
        return (
            <Card>
                <CardHeader className="py-4"><CardTitle>{t('newVsRecurring')}</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center py-2">
                    <Skeleton className="h-[120px] w-[120px] rounded-full" />
                </CardContent>
            </Card>
        );
    }

    const { total, data: chartData } = data;
    const chartConfig = {
        New: { label: t('new'), color: 'hsl(var(--chart-1))' },
        Recurrent: { label: t('recurrent'), color: 'hsl(var(--chart-2))' },
    };
    return (
        <Card className="flex flex-col">
            <CardHeader className="py-4">
                <CardTitle>{t('newVsRecurring')}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center py-2">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square h-[120px]"
                >
                <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie data={chartData} dataKey="count" nameKey="type" innerRadius={30} strokeWidth={5}>
                        {chartData.map((entry) => (
                            <Cell key={entry.type} fill={entry.fill} />
                        ))}
                    </Pie>
                </PieChart>
                </ChartContainer>
            </CardContent>
            <div className="flex flex-col items-center justify-center p-4 pt-2">
                 <div className="text-4xl font-bold">{total}</div>
                <p className="text-xs text-muted-foreground">{t('activePatients')}</p>
                <div className="w-full flex justify-center gap-4 mt-2 text-xs">
                    {chartData.map((entry) => (
                        <div key={entry.type} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }}></span>
                            <span>{entry.type}: {entry.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}

interface AppointmentAttendanceCardProps {
    data: AppointmentAttendanceRate | null;
    isLoading?: boolean;
}

export function AppointmentAttendanceCard({ data, isLoading }: AppointmentAttendanceCardProps) {
    const t = useTranslations('KpiRow');
    console.log('Translations for KpiRow loaded in AppointmentAttendanceCard.');
    if (isLoading || !data) {
         return (
            <Card>
                <CardHeader className="py-4"><CardTitle>{t('attendanceRate')}</CardTitle></CardHeader>
                <CardContent className="py-4">
                    <Skeleton className="h-10 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardContent>
            </Card>
        );
    }
    const { value, change, changeType } = data;
    const isPositive = changeType === 'positive';
    const trendColor = isPositive ? 'text-green-500' : 'text-red-500';
    const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;
  
    return (
      <Card>
        <CardHeader className="py-4">
          <CardTitle>{t('attendanceRate')}</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="text-4xl font-bold">{value}%</div>
          <div className={cn("text-xs flex items-center mt-2", trendColor)}>
            <TrendIcon className="h-4 w-4 mr-1" />
            {change.toFixed(1)}% {t('vsPreviousPeriod')}
          </div>
        </CardContent>
      </Card>
    );
}
