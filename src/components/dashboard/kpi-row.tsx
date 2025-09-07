
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
import { patientDemographicsData } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Cell, Pie, PieChart } from 'recharts';
import { TrendingDownIcon } from '../icons/trending-down-icon';
import { TrendingUpIcon } from '../icons/trending-up-icon';
import { AppointmentAttendanceRate, AverageBilling } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

interface KpiRowProps {
    averageBillingData: AverageBilling | null;
    appointmentAttendanceData: AppointmentAttendanceRate | null;
    isLoading?: boolean;
}


export function KpiRow({ averageBillingData, appointmentAttendanceData, isLoading }: KpiRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <AverageBillingCard data={averageBillingData} isLoading={isLoading} />
      <PatientDemographicsCard />
      <AppointmentAttendanceCard data={appointmentAttendanceData} isLoading={isLoading} />
    </div>
  );
}

interface AverageBillingCardProps {
    data: AverageBilling | null;
    isLoading?: boolean;
}
export function AverageBillingCard({ data, isLoading }: AverageBillingCardProps) {
    if (isLoading || !data) {
        return (
            <Card>
                <CardHeader><CardTitle>Facturación Promedio por Paciente</CardTitle></CardHeader>
                <CardContent>
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
        <CardHeader>
          <CardTitle>Facturación Promedio por Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${value.toFixed(2)}</div>
          <div className={cn("text-xs flex items-center mt-2", trendColor)}>
            <TrendIcon className="h-4 w-4 mr-1" />
            {change.toFixed(1)}% vs el período anterior
          </div>
        </CardContent>
      </Card>
    );
}

export function PatientDemographicsCard() {
    const { total, data } = patientDemographicsData;
    const chartConfig = {
        new: { label: 'New', color: 'hsl(var(--chart-1))' },
        recurrent: { label: 'Recurrent', color: 'hsl(var(--chart-2))' },
    };
    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Pacientes Nuevos vs. Recurrentes</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square h-[150px]"
                >
                <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie data={data} dataKey="count" nameKey="type" innerRadius={40} strokeWidth={5}>
                        {data.map((entry) => (
                            <Cell key={entry.type} fill={entry.fill} />
                        ))}
                    </Pie>
                </PieChart>
                </ChartContainer>
            </CardContent>
            <div className="flex flex-col items-center justify-center p-4">
                 <div className="text-4xl font-bold">{total}</div>
                <p className="text-xs text-muted-foreground">Pacientes activos</p>
                <div className="w-full flex justify-center gap-4 mt-4 text-xs">
                    {data.map((entry) => (
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
    if (isLoading || !data) {
         return (
            <Card>
                <CardHeader><CardTitle>Tasa de Asistencia a Citas</CardTitle></CardHeader>
                <CardContent>
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
        <CardHeader>
          <CardTitle>Tasa de Asistencia a Citas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{value}%</div>
          <div className={cn("text-xs flex items-center mt-2", trendColor)}>
            <TrendIcon className="h-4 w-4 mr-1" />
            {change.toFixed(1)}% vs el período anterior
          </div>
        </CardContent>
      </Card>
    );
}
