'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

import { Can } from '@/components/auth/Can';
import { PatientsPerDayChart } from '@/components/charts/patients-per-day-chart';
import { SalesByServiceChart } from '@/components/charts/sales-by-service-chart';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { formatAmount } from '@/components/dashboard/dashboard-format';
import { MonthlyEvolution } from '@/components/dashboard/monthly-evolution';
import { MonthSummaryCards } from '@/components/dashboard/month-summary-cards';
import { ProductionByBranch } from '@/components/dashboard/production-by-branch';
import { TodayHero } from '@/components/dashboard/today-hero';

import { DashboardFiltersProvider, useDashboardFilters } from '@/context/DashboardFiltersContext';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';
import { DASHBOARD_PERMISSIONS } from '@/constants/permissions';
import type {
  DashboardExecutiveSummary,
  EvolucionMensualResponse,
  PacientesPorDiaResponse,
  ProduccionSucursalResponse,
  VentasPorServicioResponse,
} from '@/lib/types';
import { cn } from '@/lib/utils';

import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

const TOP_SERVICES = 6;
const EVOLUTION_MONTHS = 6;

/**
 * Los webhooks de n8n responden `{ data: … }`, pero algunos flujos devuelven el objeto
 * envuelto en un array de un elemento. Se aceptan las dos formas.
 */
function unwrap<T>(response: unknown): T | null {
  const payload = Array.isArray(response) ? response[0] : response;
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  return ((data ?? payload) as T) ?? null;
}

export default function DashboardPage() {
  return (
    <DashboardFiltersProvider>
      <ManagerialDashboard />
    </DashboardFiltersProvider>
  );
}

function ManagerialDashboard() {
  const t = useTranslations('DashboardGerencial');
  const { hasPermission } = usePermissions();
  const { sedeId, dateRange, currency } = useDashboardFilters();

  const canViewByBranch = hasPermission(DASHBOARD_PERMISSIONS.VIEW_BY_BRANCH);

  const [summary, setSummary] = React.useState<DashboardExecutiveSummary | null>(null);
  const [branches, setBranches] = React.useState<ProduccionSucursalResponse | null>(null);
  const [patientsPerDay, setPatientsPerDay] = React.useState<PacientesPorDiaResponse | null>(null);
  const [salesByService, setSalesByService] = React.useState<VentasPorServicioResponse | null>(null);
  const [evolution, setEvolution] = React.useState<EvolucionMensualResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);

  // El cliente de API no acepta un AbortSignal, así que se descartan las respuestas de
  // cargas que ya quedaron viejas: sin esto, cambiar de filtro rápido puede dejar en
  // pantalla el resultado de la consulta anterior.
  const runIdRef = React.useRef(0);

  React.useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;

    const runId = ++runIdRef.current;
    const isStale = () => runIdRef.current !== runId;

    const range = {
      date_from: format(dateRange.from, 'yyyy-MM-dd'),
      date_to: format(dateRange.to, 'yyyy-MM-dd'),
    };
    const sedeQuery: Record<string, string> = sedeId ? { sede_id: sedeId } : {};

    setIsLoading(true);
    setHasError(false);

    // allSettled y no all: los flujos de n8n se despliegan a mano y por fuera del frontend,
    // así que un endpoint que todavía no existe debe vaciar su propia tarjeta y no tumbar
    // el panel entero. El aviso de error aparece solo si falla todo.
    Promise.allSettled([
      api.get(API_ROUTES.DASHBOARD.EXECUTIVE_SUMMARY, { ...sedeQuery, currency }),
      canViewByBranch
        ? api.get(API_ROUTES.DASHBOARD.PRODUCCION_SUCURSAL, { ...range, currency })
        : Promise.resolve(null),
      api.get(API_ROUTES.DASHBOARD.PACIENTES_POR_DIA, { ...range, ...sedeQuery }),
      api.get(API_ROUTES.DASHBOARD.VENTAS_POR_SERVICIO, {
        ...range,
        ...sedeQuery,
        currency,
        limit: String(TOP_SERVICES),
      }),
      // La evolución mensual no depende del período elegido: siempre mira los últimos
      // meses cerrados, que es lo que responde "cómo venimos de un mes a otro".
      api.get(API_ROUTES.DASHBOARD.EVOLUCION_MENSUAL, {
        ...sedeQuery,
        currency,
        meses: String(EVOLUTION_MONTHS),
      }),
    ]).then((results) => {
      if (isStale()) return;

      const value = <T,>(i: number): T | null => {
        const r = results[i];
        if (r.status === 'rejected') {
          console.error(`Dashboard endpoint ${i} failed:`, r.reason);
          return null;
        }
        return r.value === null ? null : unwrap<T>(r.value);
      };

      setSummary(value<DashboardExecutiveSummary>(0));
      setBranches(value<ProduccionSucursalResponse>(1));
      setPatientsPerDay(value<PacientesPorDiaResponse>(2));
      setSalesByService(value<VentasPorServicioResponse>(3));
      setEvolution(value<EvolucionMensualResponse>(4));

      setHasError(results.every((r) => r.status === 'rejected'));
      setIsLoading(false);
    });
  }, [dateRange, sedeId, currency, canViewByBranch, reloadToken]);

  // Sin permiso de sucursal, esa tarjeta desaparece y la fila queda con una sola:
  // dejarla en dos columnas abriría un hueco vacío.
  const rowColumns = canViewByBranch ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 pr-2">
      <Can permission={DASHBOARD_PERMISSIONS.APPLY_FILTERS}>
        <DashboardFilterBar serverDate={summary?.fecha_servidor} />
      </Can>

      {hasError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">{t('loadError')}</p>
          <Button size="sm" variant="outline" onClick={() => setReloadToken((n) => n + 1)}>
            {t('retry')}
          </Button>
        </div>
      )}

      <Can permission={DASHBOARD_PERMISSIONS.VIEW_EXECUTIVE_SUMMARY}>
        <TodayHero
          data={summary}
          currency={currency}
          isBranchFiltered={!!sedeId}
          isLoading={isLoading}
        />
        <MonthSummaryCards
          data={summary}
          currency={currency}
          isBranchFiltered={!!sedeId}
          isLoading={isLoading}
        />
      </Can>

      <Can permission={DASHBOARD_PERMISSIONS.VIEW_CHARTS}>
        <div className={cn('grid grid-cols-1 gap-3', rowColumns)}>
          <Can permission={DASHBOARD_PERMISSIONS.VIEW_BY_BRANCH}>
            <ProductionByBranch data={branches} currency={currency} isLoading={isLoading} />
          </Can>

          <SalesByServiceChart
            chartData={salesByService?.rows ?? []}
            isLoading={isLoading}
            formatAmount={(sales) => formatAmount(sales, currency)}
          />
        </div>

        {/* Fila propia y a todo el ancho: la serie diaria necesita espacio horizontal para que
            se lean las etiquetas de fecha, que en una columna angosta no entran. */}
        <PatientsPerDayChart data={patientsPerDay} isLoading={isLoading} />
      </Can>

      {/* La comparativa entre meses es lectura de resumen ejecutivo, no un gráfico más:
          va con el mismo permiso y no se crea uno nuevo. */}
      <Can permission={DASHBOARD_PERMISSIONS.VIEW_EXECUTIVE_SUMMARY}>
        <MonthlyEvolution data={evolution} currency={currency} isLoading={isLoading} />
      </Can>
    </div>
  );
}
