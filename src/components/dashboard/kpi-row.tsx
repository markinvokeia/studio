
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
    averageBillingData,
    patientDemographicsData,
    appointmentAttendanceData,
} from '@/lib/data/kpi-data';
import { cn } from '@/lib/utils';
import { Cell, Pie, PieChart } from 'recharts';
import { TrendingDownIcon } from '../icons/trending-down-icon';
import { TrendingUpIcon } from '../icons/trending-up-icon';


export function KpiRow() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <AverageBillingCard />
      <PatientDemographicsCard />
      <AppointmentAttendanceCard />
    </div>
  );
}

export function AverageBillingCard() {
    const { value, change, changeType } = averageBillingData;
    const isPositive = changeType === 'positive';
    const trendColor = isPositive ? 'text-green-500' : 'text-red-500';
    const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;
  
    return (
      <Card>
        <CardHeader>
          <CardDescription>Facturación Promedio por Paciente</CardDescription>
          <CardTitle className="text-4xl">${value}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("text-xs flex items-center", trendColor)}>
            <TrendIcon className="h-4 w-4 mr-1" />
            {change}% vs el período anterior
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


export function AppointmentAttendanceCard() {
    const { value, change, changeType } = appointmentAttendanceData;
    const isPositive = changeType === 'positive';
    const trendColor = isPositive ? 'text-green-500' : 'text-red-500';
    const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;
  
    return (
      <Card>
        <CardHeader>
          <CardDescription>Tasa de Asistencia a Citas</CardDescription>
          <CardTitle className="text-4xl">{value}%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("text-xs flex items-center", trendColor)}>
            <TrendIcon className="h-4 w-4 mr-1" />
            {change}% vs el período anterior
          </div>
        </CardContent>
      </Card>
    );
}
