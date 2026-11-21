import { format } from 'date-fns';

import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { DashboardVoiceBridge } from '@/lib/types';

/** El panel de control simulado (lo que publica src/app/[locale]/page.tsx), con datos fijos. */
export interface SimDashboard { bridge: DashboardVoiceBridge; log: string[] }

const OWNER = {};

export function publishSimDashboard(): SimDashboard {
  const log: string[] = [];
  const bridge: DashboardVoiceBridge = {
    loading: false,
    canFilter: true,
    currency: 'UYU',
    currencies: ['UYU', 'USD'],
    sedes: [{ id: 's1', name: 'Centro' }, { id: 's2', name: 'Pocitos' }],
    sedeId: null,
    range: null,
    summary: {
      fecha_servidor: '2026-11-20', sede_id: null, currency: 'UYU', sede_source: 'actual',
      produccion: { hoy: 45000, mes: 820000, var_dia_pct: 10, var_mes_pct: 12.4, mes_anterior: 730000 },
      cobranza: { hoy: 38000, mes: 700000, var_mes_pct: -3, disponible_por_sede: false },
      gastos: { hoy: 5000, mes: 210000, var_mes_pct: 4, sin_datos: false },
      resultado: { hoy: 33000, mes: 490000, var_mes_pct: 8, sin_datos: false },
      pacientes_atendidos: { hoy: 18, mes: 310, var_dia_abs: 2, var_mes_pct: 5, agendados_hoy: 24 },
      atenciones: { hoy: 20, mes: 345, var_dia_abs: 3, var_mes_pct: 6, agendados_hoy: 24 },
      pacientes_nuevos: { mes: 42, var_pct: 15 },
    },
    branches: [
      { sede_id: 1, name: 'Centro', produccion: 500000, pacientes: 190, no_show: 4, ticket_promedio: 2600, pct: 61 },
      { sede_id: 2, name: 'Pocitos', produccion: 320000, pacientes: 120, no_show: 2, ticket_promedio: 2700, pct: 39 },
    ],
    services: [{ name: 'Consulta', sales: 120000, percentage: 15 }, { name: 'Blanqueamiento', sales: 260000, percentage: 32 }, { name: 'Limpieza', sales: 90000, percentage: 11 }],
    evolution: null,
    setSede: (id) => { bridge.sedeId = id; log.push(`sede:${id ?? 'all'}`); },
    setRange: (from, to) => { bridge.range = { from, to }; log.push(`range:${format(from, 'yyyy-MM-dd')}..${format(to, 'yyyy-MM-dd')}`); },
    setCurrency: (c) => { bridge.currency = c; log.push(`currency:${c}`); },
    reload: () => log.push('reload'),
  };
  publishVoiceBridge('dashboard', bridge, OWNER);
  return { bridge, log };
}

export function clearSimDashboard() {
  publishVoiceBridge('dashboard', null, OWNER);
}
