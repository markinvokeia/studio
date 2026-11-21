import { format } from 'date-fns';

import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { ReportKpiVoiceBridge, ReportPeriodVoiceBridge, ReportShellVoiceBridge, ReportTableVoiceBridge } from '@/lib/types';

/** Un reporte simulado (lo que publican ReportShell, ReportKPICard, DateRangePresets, ReportDataTable). */
export interface SimReport { shell: ReportShellVoiceBridge; log: string[] }

const OWNER = {};

export function publishSimReport({ allTime = true } = {}): SimReport {
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
  };
  publishVoiceBridge('reports.shell', shell, OWNER);
  const period: ReportPeriodVoiceBridge = {
    setRange: (from, to) => log.push(`range:${format(from, 'yyyy-MM-dd')}..${format(to, 'yyyy-MM-dd')}`),
    allTime: allTime ? () => log.push('all-time') : null,
  };
  publishVoiceBridge('reports.period', period, OWNER);
  return { shell, log };
}

export function clearSimReport() {
  for (const key of ['reports.shell', 'reports.period', 'reports.table', 'reports.kpi.a', 'reports.kpi.b']) publishVoiceBridge(key, null, OWNER);
}
