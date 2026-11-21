import { format } from 'date-fns';

import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import { screen } from './page';

import type { ReportKpiVoiceBridge, ReportPeriodVoiceBridge, ReportShellVoiceBridge, ReportTableVoiceBridge } from '@/lib/types';

/** Un reporte simulado (lo que publican ReportShell, ReportKPICard, DateRangePresets, ReportDataTable). */
export interface SimReport { shell: ReportShellVoiceBridge; log: string[] }

const OWNER = {};

export function publishSimReport({ allTime = true, withPeriod = true } = {}): SimReport {
  const log: string[] = [];
  const shell: ReportShellVoiceBridge = {
    title: 'Deudores', isLoading: false, hasData: false,
    generate: () => {
      log.push('generate');
      shell.hasData = true;
      publishVoiceBridge<ReportKpiVoiceBridge>('reports.kpi.a', { title: 'Total adeudado', value: '$ 45.300', subtitle: '' }, OWNER);
      publishVoiceBridge<ReportKpiVoiceBridge>('reports.kpi.b', { title: 'Deudores', value: '12', subtitle: '' }, OWNER);
      publishVoiceBridge<ReportTableVoiceBridge>('reports.table', { rowCount: 12 }, OWNER);
    },
    exportPDF: () => log.push('pdf'), exportExcel: () => log.push('excel'), exportCSV: null, print: () => log.push('print'),
    // La barra de filtros, como la del cierre de caja (selectores con sus opciones).
    filtersRoot: () => filters as unknown as HTMLElement,
  };
  const filters = screen.group(
    screen.select('Caja', ['Todas las cajas', 'Caja Principal', 'Caja Recepción Planta Alta', 'Caja Sede Carrasco'], 'Todas las cajas'),
    screen.select('Método de pago', ['Todos los métodos', 'Efectivo', 'Tarjeta de crédito', 'Transferencia'], 'Todos los métodos'),
    screen.select('Moneda', ['Todas', 'UYU', 'USD'], 'Todas'),
    screen.select('Movimiento', ['Ingresos y egresos', 'Solo ingresos', 'Solo egresos'], 'Ingresos y egresos'),
  );
  screen.page(filters);
  publishVoiceBridge('reports.shell', shell, OWNER);
  const period: ReportPeriodVoiceBridge = {
    setRange: (from, to) => log.push(`range:${format(from, 'yyyy-MM-dd')}..${format(to, 'yyyy-MM-dd')}`),
    allTime: allTime ? () => log.push('all-time') : null,
  };
  publishVoiceBridge('reports.period', withPeriod ? period : null, OWNER);
  return { shell, log };
}

export function clearSimReport() {
  for (const key of ['reports.shell', 'reports.period', 'reports.table', 'reports.kpi.a', 'reports.kpi.b']) publishVoiceBridge(key, null, OWNER);
}
