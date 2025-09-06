'use client';

import * as React from 'react';
import { Pie, PieChart, Cell, RadialBarChart, RadialBar, PolarGrid } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import { patientsData, quoteConversionData, appointmentShowRateData } from '@/lib/data/kpi-data';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const patientsChartConfig = {
  patients: {
    label: 'Pacientes',
  },
  new: {
    label: 'Nuevos',
    color: 'hsl(var(--chart-1))',
  },
  recurring: {
    label: 'Recurrentes',
    color: 'hsl(var(--chart-2))',
  },
};

const conversionChartConfig = {
  rate: {
    label: 'Tasa de Conversión',
  },
  total: {
    label: 'Total',
  },
};

export function KpiRow() {
  const totalPatients = React.useMemo(() => {
    return patientsData.reduce((acc, curr) => acc + curr.value, 0);
  }, []);

  const isTrendingUp = appointmentShowRateData.change >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Card 1: New vs. Recurring Patients */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Pacientes Nuevos vs. Recurrentes</CardTitle>
          <CardDescription>Análisis de la base de pacientes activos</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center pb-0">
          <ChartContainer
            config={patientsChartConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={patientsData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={5}
              >
                <Cell key="cell-0" fill="var(--color-new)" />
                <Cell key="cell-1" fill="var(--color-recurring)" />
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm pt-4">
          <div className="flex w-full items-center justify-center text-center font-medium leading-none">
            Total Pacientes Activos: {totalPatients.toLocaleString()}
          </div>
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            className="flex-wrap gap-2 [&>*]:basis-1/3 [&>*]:justify-center"
          />
        </CardFooter>
      </Card>
      
      {/* Card 2: Quote Conversion Rate */}
       <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Tasa de Conversión</CardTitle>
          <CardDescription>De presupuestos a órdenes confirmadas</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center pb-0">
          <ChartContainer
            config={conversionChartConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <RadialBarChart
              data={[quoteConversionData]}
              startAngle={90}
              endAngle={-270}
              innerRadius="70%"
              outerRadius="100%"
              barSize={20}
            >
              <PolarGrid
                gridType="circle"
                radialLines={false}
                stroke="none"
                className="first:fill-muted last:fill-background"
                polarRadius={[86, 74]}
              />
              <RadialBar dataKey="value" background cornerRadius={10} />
            </RadialBarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm pt-4">
            <div className="text-center font-bold text-4xl text-primary">{`${quoteConversionData.value}%`}</div>
            <div className="text-center text-muted-foreground">
                {quoteConversionData.converted} convertidos de {quoteConversionData.total} presupuestos
            </div>
        </CardFooter>
      </Card>

      {/* Card 3: Appointment Show Rate */}
      <Card className="flex flex-col items-center justify-center">
        <CardHeader className="items-center pb-2">
          <CardTitle>Tasa de Asistencia a Citas</CardTitle>
          <CardDescription>Pacientes que asistieron vs. agendados</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center p-6">
          <p className="text-7xl font-bold text-primary">{`${appointmentShowRateData.rate}%`}</p>
          <div className={cn(
            "mt-2 flex items-center gap-1 text-sm font-medium",
            isTrendingUp ? "text-green-500" : "text-destructive"
          )}>
            {isTrendingUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{appointmentShowRateData.change.toFixed(1)}% vs. período anterior</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
